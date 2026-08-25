const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

// Store the database in a `data/` directory so it's easy to find, back up,
// or mount as a persistent volume when deploying. The directory and file
// are created automatically on first run.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
const DB_PATH = path.join(DATA_DIR, 'inventory.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    quantity REAL NOT NULL DEFAULT 0,
    unit TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT 'pantry',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Lightweight migrations: add any columns introduced after the initial
// release to existing databases, without touching data already stored.
const existingColumns = new Set(db.prepare('PRAGMA table_info(items)').all().map((c) => c.name));
const MIGRATIONS = [
  ["ALTER TABLE items ADD COLUMN category TEXT NOT NULL DEFAULT 'other'", 'category'],
  ["ALTER TABLE items ADD COLUMN expiration_date TEXT", 'expiration_date'],
  // pack_size: the original count a "pack" started at, for items you want
  // flagged low once they drop to 25% or less of that (e.g. 6 left of 24).
  ["ALTER TABLE items ADD COLUMN pack_size REAL", 'pack_size'],
  // percent_full: how full a single container currently is (0-100),
  // DERIVED from fullness_amount / fullness_total below (never set
  // directly) — kept as its own column since it's what the low-stock
  // check reads. Only meaningful when quantity is 1.
  ["ALTER TABLE items ADD COLUMN percent_full REAL", 'percent_full'],
  // fullness_unit/amount/total: the actual measurement (e.g. "10 oz left
  // of a 16 oz bottle") a container's fullness is entered in, so nobody
  // has to type an abstract percentage. percent_full is computed from
  // amount/total whenever these change.
  ["ALTER TABLE items ADD COLUMN fullness_unit TEXT", 'fullness_unit'],
  ["ALTER TABLE items ADD COLUMN fullness_amount REAL", 'fullness_amount'],
  ["ALTER TABLE items ADD COLUMN fullness_total REAL", 'fullness_total'],
];
for (const [sql, column] of MIGRATIONS) {
  if (!existingColumns.has(column)) {
    db.exec(sql);
  }
}

// User-added recipes for the Suggest recipes feature — separate from the
// bundled recipes.json list (which stays a static file, not DB rows), so
// they can be created/deleted at any time without touching that file.
// ingredients is stored as a JSON array of {name, quantity, unit}.
db.exec(`
  CREATE TABLE IF NOT EXISTS recipes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    ingredients TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// category: meal-type grouping (see recipeCategorize.js) for the
// collapsible category list under Save Recipes — added after the initial
// release, so migrated in the same lightweight way as the items columns
// above rather than baked into the CREATE TABLE.
const existingRecipeColumns = new Set(db.prepare('PRAGMA table_info(recipes)').all().map((c) => c.name));
if (!existingRecipeColumns.has('category')) {
  db.exec("ALTER TABLE recipes ADD COLUMN category TEXT NOT NULL DEFAULT 'other'");
}

module.exports = db;
