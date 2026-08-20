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
];
for (const [sql, column] of MIGRATIONS) {
  if (!existingColumns.has(column)) {
    db.exec(sql);
  }
}

module.exports = db;
