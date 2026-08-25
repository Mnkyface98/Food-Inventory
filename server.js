const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const db = require('./db');
const auth = require('./auth');
const { parseTranscript } = require('./voiceParser');
const { CATEGORIES, CATEGORY_IDS, guessCategory } = require('./categorize');
const { RECIPE_CATEGORY_IDS } = require('./recipeCategorize');
const { lookupBarcode } = require('./barcode');
const { parseReceiptText } = require('./receiptParser');
const { parseRecipeText } = require('./recipeParser');
const { convert: convertUnit } = require('./unitConvert');
const { parseCsv, stringifyCsv } = require('./csvUtil');

const app = express();
const PORT = process.env.PORT || 3000;

// Trusts the proxy in front of the app (Render/Railway/Fly.io etc. all
// terminate HTTPS at their edge and forward plain HTTP internally) so
// the session cookie's `secure` flag is evaluated correctly instead of
// always looking like a plain-http request.
app.set('trust proxy', 1);

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// --- Accounts --------------------------------------------------------------
//
// Free, self-contained email/password accounts (see auth.js) — every
// item and recipe belongs to whoever's signed in, and every route below
// that reads or writes one requires a valid session. The stateless
// parsing endpoints (voice/receipt/recipe text, barcode lookup) stay
// open — they don't touch anyone's stored data, so there's nothing to
// protect there.

app.post('/api/auth/signup', (req, res) => {
  const { email, password } = req.body || {};
  const validated = auth.validateSignup(email, password);
  if (validated.error) {
    return res.status(400).json({ error: validated.error });
  }
  if (auth.findUserByEmail(validated.email)) {
    return res.status(409).json({ error: 'An account with that email already exists.' });
  }
  let user;
  try {
    user = auth.createUser(validated.email, validated.password);
  } catch (err) {
    // A near-simultaneous signup with the same email can still race past
    // the check above — the column's own UNIQUE constraint is the real
    // guard; this just turns that into the same friendly error.
    return res.status(409).json({ error: 'An account with that email already exists.' });
  }
  const token = auth.createSession(user.id);
  auth.setSessionCookie(res, token);
  res.status(201).json({ id: user.id, email: user.email });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = auth.findUserByEmail(email);
  if (!user || !auth.verifyPassword(user, password)) {
    return res.status(401).json({ error: 'Incorrect email or password.' });
  }
  const token = auth.createSession(user.id);
  auth.setSessionCookie(res, token);
  res.json({ id: user.id, email: user.email });
});

app.post('/api/auth/logout', (req, res) => {
  auth.destroySession(req.cookies && req.cookies[auth.SESSION_COOKIE]);
  auth.clearSessionCookie(res);
  res.status(204).end();
});

// Lets the client check "am I signed in" on load without triggering a
// 401-driven redirect loop the way a requireAuth route would.
app.get('/api/auth/me', (req, res) => {
  const user = auth.getUserForToken(req.cookies && req.cookies[auth.SESSION_COOKIE]);
  if (!user) {
    return res.status(401).json({ error: 'Not signed in.' });
  }
  res.json({ id: user.id, email: user.email });
});

const VALID_LOCATIONS = new Set(['pantry', 'fridge', 'freezer']);
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Accept an expiration date field that may be absent, null, '', or an
// actual "YYYY-MM-DD" string. Returns a clean ISO string or null.
function cleanExpirationDate(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return ISO_DATE_RE.test(trimmed) ? trimmed : null;
}

// When merging quantity into an existing item, keep the SOONER of the two
// expiration dates — that's the batch that needs to be used first.
function mergeExpirationDate(existingDate, incomingDate) {
  if (existingDate && incomingDate) return existingDate < incomingDate ? existingDate : incomingDate;
  return existingDate || incomingDate || null;
}

// packSize: the original count a "pack" started at (e.g. 24), used to
// flag an item low once it drops to 25% or less remaining. Absent/blank/
// invalid all clean to null (no pack-size tracking for this item).
function cleanPackSize(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Fullness of a single container is entered as a real measurement (e.g.
// "10 oz left of a 16 oz bottle"), not a typed-in percentage. percentFull
// is always DERIVED from fullness_amount/fullness_total — never accepted
// directly from a client.
const FULLNESS_UNITS = new Set(['oz', 'fl oz', 'ml', 'L', 'g', 'kg', 'lb']);

function cleanFullnessUnit(value) {
  return typeof value === 'string' && FULLNESS_UNITS.has(value.trim()) ? value.trim() : null;
}

// A positive number (amount remaining / total size), or null if absent/blank/invalid.
function cleanPositiveAmount(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Derive percent-full (0-100) from amount remaining out of total size.
// Needs both to be meaningful; returns null otherwise.
function computePercentFull(amount, total) {
  if (amount == null || total == null || total <= 0) return null;
  return Math.min(100, Math.max(0, (amount / total) * 100));
}

// Weight/volume tracking only describes exactly one container — once a
// quantity change takes an item away from 1 (a second one picked up, or
// the tracked one used up entirely down to 0), that reading no longer
// means anything real, so it's cleared here rather than left stale on
// the card. Called by every endpoint that can change quantity.
function clampFullnessToQuantity(quantity, fullnessUnit, fullnessAmount, fullnessTotal) {
  if (quantity !== 1) {
    return { fullnessUnit: null, fullnessAmount: null, fullnessTotal: null, percentFull: null };
  }
  return {
    fullnessUnit,
    fullnessAmount,
    fullnessTotal,
    percentFull: computePercentFull(fullnessAmount, fullnessTotal),
  };
}

function serializeItem(row) {
  return {
    id: row.id,
    name: row.name,
    quantity: row.quantity,
    unit: row.unit,
    location: row.location,
    category: row.category,
    expirationDate: row.expiration_date || null,
    packSize: row.pack_size ?? null,
    percentFull: row.percent_full ?? null,
    fullnessUnit: row.fullness_unit ?? null,
    fullnessAmount: row.fullness_amount ?? null,
    fullnessTotal: row.fullness_total ?? null,
    updatedAt: row.updated_at,
  };
}

// The list of valid categories, for the client to build its dropdowns from.
app.get('/api/categories', (req, res) => {
  res.json(CATEGORIES);
});

// List all items. Ordered by category first (so all of a category's items
// stay contiguous for grouping/filtering regardless of which location
// they're in); within a category, items with an expiration date sort
// first (soonest first), then items without one sort by quantity
// ascending (low-stock first).
app.get('/api/items', auth.requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `SELECT * FROM items
       WHERE user_id = ?
       ORDER BY
         category,
         CASE WHEN expiration_date IS NOT NULL AND expiration_date != '' THEN 0 ELSE 1 END,
         expiration_date,
         quantity,
         location,
         name COLLATE NOCASE`
    )
    .all(req.user.id);
  res.json(rows.map(serializeItem));
});

// Create a new item, or if an item with the same name/unit/location already
// exists FOR THIS ACCOUNT, add to its quantity instead of creating a
// duplicate row.
app.post('/api/items', auth.requireAuth, (req, res) => {
  const {
    name, quantity, unit, location, category, expirationDate,
    packSize, fullnessUnit, fullnessAmount, fullnessTotal,
  } = req.body || {};

  if (typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Item name is required.' });
  }
  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty < 0) {
    return res.status(400).json({ error: 'Quantity must be a non-negative number.' });
  }
  const cleanUnit = typeof unit === 'string' ? unit.trim() : '';
  const cleanLocation = VALID_LOCATIONS.has(location) ? location : 'pantry';
  const cleanName = name.trim();
  const cleanCategory = CATEGORY_IDS.has(category) ? category : guessCategory(cleanName);
  const cleanExpiration = cleanExpirationDate(expirationDate);
  const cleanPack = cleanPackSize(packSize);
  const cleanFullnessUnitVal = cleanFullnessUnit(fullnessUnit);
  const cleanFullnessAmount = cleanPositiveAmount(fullnessAmount);
  const cleanFullnessTotal = cleanPositiveAmount(fullnessTotal);

  const existing = db
    .prepare(
      `SELECT * FROM items
       WHERE user_id = ? AND name = ? COLLATE NOCASE AND unit = ? COLLATE NOCASE AND location = ?`
    )
    .get(req.user.id, cleanName, cleanUnit, cleanLocation);

  let row;
  if (existing) {
    const newQty = existing.quantity + qty;
    const mergedExpiration = mergeExpirationDate(existing.expiration_date, cleanExpiration);
    // Pack size / fullness describe metadata about the item, not the
    // quantity being added — keep the existing values unless this
    // request explicitly supplies a new fullness reading (amount+total).
    const mergedPack = cleanPack !== null ? cleanPack : existing.pack_size;
    const hasNewFullness = cleanFullnessAmount !== null && cleanFullnessTotal !== null;
    const rawFullnessUnit = hasNewFullness ? cleanFullnessUnitVal : existing.fullness_unit;
    const rawFullnessAmount = hasNewFullness ? cleanFullnessAmount : existing.fullness_amount;
    const rawFullnessTotal = hasNewFullness ? cleanFullnessTotal : existing.fullness_total;
    const clamped = clampFullnessToQuantity(newQty, rawFullnessUnit, rawFullnessAmount, rawFullnessTotal);
    db.prepare(
      `UPDATE items SET quantity = ?, expiration_date = ?, pack_size = ?,
         fullness_unit = ?, fullness_amount = ?, fullness_total = ?, percent_full = ?,
         updated_at = datetime('now') WHERE id = ? AND user_id = ?`
    ).run(
      newQty, mergedExpiration, mergedPack,
      clamped.fullnessUnit, clamped.fullnessAmount, clamped.fullnessTotal, clamped.percentFull,
      existing.id, req.user.id
    );
    row = db.prepare('SELECT * FROM items WHERE id = ?').get(existing.id);
  } else {
    const clamped = clampFullnessToQuantity(qty, cleanFullnessUnitVal, cleanFullnessAmount, cleanFullnessTotal);
    const info = db
      .prepare(
        `INSERT INTO items (user_id, name, quantity, unit, location, category, expiration_date, pack_size,
           fullness_unit, fullness_amount, fullness_total, percent_full)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        req.user.id, cleanName, qty, cleanUnit, cleanLocation, cleanCategory, cleanExpiration, cleanPack,
        clamped.fullnessUnit, clamped.fullnessAmount, clamped.fullnessTotal, clamped.percentFull
      );
    row = db.prepare('SELECT * FROM items WHERE id = ?').get(info.lastInsertRowid);
  }

  res.status(201).json(serializeItem(row));
});

// --- CSV export/import ----------------------------------------------------
//
// Export: a full-fidelity snapshot (every column PUT /api/items/:id
// understands, plus id) you can open and edit in any spreadsheet app.
// Import mirrors the spreadsheet back onto the database: a row with an
// existing id updates that item, a row with no id becomes a new item,
// and — since the spreadsheet is treated as the full picture, not a
// partial patch — any item whose id doesn't appear in the file at all
// gets deleted. Preview and commit run the exact same parsing/diffing
// logic (computeImportPlan), so what you review is exactly what gets
// applied; nothing is written to the database until /commit is called.

const CSV_EXPORT_HEADER = [
  'id', 'name', 'quantity', 'unit', 'location', 'category', 'expirationDate',
  'packSize', 'fullnessUnit', 'fullnessAmount', 'fullnessTotal',
];

app.get('/api/items/export.csv', auth.requireAuth, (req, res) => {
  const rows = db
    .prepare('SELECT * FROM items WHERE user_id = ? ORDER BY category, name COLLATE NOCASE')
    .all(req.user.id);
  const csvRows = [CSV_EXPORT_HEADER];
  for (const row of rows) {
    const item = serializeItem(row);
    csvRows.push([
      item.id, item.name, item.quantity, item.unit, item.location, item.category,
      item.expirationDate ?? '', item.packSize ?? '', item.fullnessUnit ?? '',
      item.fullnessAmount ?? '', item.fullnessTotal ?? '',
    ]);
  }
  const filename = `pantry-inventory-${new Date().toISOString().slice(0, 10)}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(stringifyCsv(csvRows));
});

function csvCol(row, headerIndex, name) {
  const idx = headerIndex[name.toLowerCase()];
  return idx == null || idx >= row.length ? '' : (row[idx] || '').trim();
}

// Parses one data row into either a validated {id, fields} candidate or
// an {error} — never throws, so one bad row doesn't abort the whole
// import; it's just reported back and excluded, same tolerant spirit as
// every other parser in this app (receipt/voice/recipe).
function parseImportRow(headerIndex, row) {
  const name = csvCol(row, headerIndex, 'name');
  if (!name) return { error: 'Missing name' };

  const quantityRaw = csvCol(row, headerIndex, 'quantity');
  const quantity = quantityRaw === '' ? 0 : Number(quantityRaw);
  if (!Number.isFinite(quantity) || quantity < 0) {
    return { error: `Invalid quantity "${quantityRaw}"` };
  }

  const idRaw = csvCol(row, headerIndex, 'id');
  let id = null;
  if (idRaw) {
    const n = Number(idRaw);
    if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
      return { error: `Invalid id "${idRaw}"` };
    }
    id = n;
  }

  const unit = csvCol(row, headerIndex, 'unit');
  const locationRaw = csvCol(row, headerIndex, 'location');
  const location = VALID_LOCATIONS.has(locationRaw) ? locationRaw : 'pantry';
  const categoryRaw = csvCol(row, headerIndex, 'category');
  const category = CATEGORY_IDS.has(categoryRaw) ? categoryRaw : guessCategory(name);
  const expirationDate = cleanExpirationDate(csvCol(row, headerIndex, 'expirationdate'));
  const packSize = cleanPackSize(csvCol(row, headerIndex, 'packsize'));
  const fullnessUnitVal = cleanFullnessUnit(csvCol(row, headerIndex, 'fullnessunit'));
  const fullnessAmount = cleanPositiveAmount(csvCol(row, headerIndex, 'fullnessamount'));
  const fullnessTotal = cleanPositiveAmount(csvCol(row, headerIndex, 'fullnesstotal'));
  const clamped = clampFullnessToQuantity(quantity, fullnessUnitVal, fullnessAmount, fullnessTotal);

  return {
    id,
    fields: {
      name, quantity, unit, location, category, expirationDate, packSize,
      fullnessUnit: clamped.fullnessUnit,
      fullnessAmount: clamped.fullnessAmount,
      fullnessTotal: clamped.fullnessTotal,
      percentFull: clamped.percentFull,
    },
  };
}

// True if any field an import row can actually change is different from
// what's currently stored — an unmodified row (re-exported, then
// re-imported untouched) shouldn't show up as a no-op "update".
function itemFieldsChanged(existing, fields) {
  return (
    existing.name !== fields.name ||
    existing.quantity !== fields.quantity ||
    existing.unit !== fields.unit ||
    existing.location !== fields.location ||
    existing.category !== fields.category ||
    (existing.expiration_date || null) !== fields.expirationDate ||
    (existing.pack_size ?? null) !== fields.packSize ||
    (existing.fullness_unit ?? null) !== fields.fullnessUnit ||
    (existing.fullness_amount ?? null) !== fields.fullnessAmount ||
    (existing.fullness_total ?? null) !== fields.fullnessTotal
  );
}

// Parses + diffs an uploaded CSV against the current database, scoped to
// one account. Read-only — never writes. Shared by /preview and /commit
// so both run identically; /commit just applies the result instead of
// only returning it.
function computeImportPlan(text, userId) {
  const rows = parseCsv(text);
  if (rows.length === 0) {
    return { error: 'The file is empty.' };
  }
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const headerIndex = {};
  header.forEach((h, i) => {
    if (!(h in headerIndex)) headerIndex[h] = i;
  });
  if (headerIndex.name === undefined || headerIndex.quantity === undefined) {
    return { error: 'The file needs at least "name" and "quantity" columns.' };
  }

  const existingItems = db.prepare('SELECT * FROM items WHERE user_id = ?').all(userId);
  const existingById = new Map(existingItems.map((it) => [it.id, it]));
  const seenIds = new Set();

  const toAdd = [];
  const toUpdate = [];
  const errors = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length === 1 && row[0] === '') continue; // a genuinely blank line — skip silently
    const rowNumber = i + 1; // 1-indexed and header-inclusive, matching what a spreadsheet shows
    const parsed = parseImportRow(headerIndex, row);
    if (parsed.error) {
      errors.push({ rowNumber, error: parsed.error });
      continue;
    }
    if (parsed.id != null) {
      const existing = existingById.get(parsed.id);
      if (!existing) {
        errors.push({ rowNumber, error: `No item with id ${parsed.id} — it may already be gone.` });
        continue;
      }
      seenIds.add(parsed.id);
      if (itemFieldsChanged(existing, parsed.fields)) {
        toUpdate.push({ id: parsed.id, name: parsed.fields.name, fields: parsed.fields });
      }
    } else {
      toAdd.push({ fields: parsed.fields });
    }
  }

  // The spreadsheet is treated as the complete picture — any existing
  // item whose id never showed up in the file gets deleted, not just
  // ones the user explicitly marked. This is the whole reason import
  // shows a review before committing anything.
  const toDelete = existingItems
    .filter((it) => !seenIds.has(it.id))
    .map((it) => ({ id: it.id, name: it.name }));

  return { toAdd, toUpdate, toDelete, errors };
}

app.post('/api/items/import/preview', auth.requireAuth, (req, res) => {
  const text = typeof req.body?.csv === 'string' ? req.body.csv : '';
  if (!text.trim()) {
    return res.status(400).json({ error: 'csv is required.' });
  }
  const plan = computeImportPlan(text, req.user.id);
  if (plan.error) {
    return res.status(400).json({ error: plan.error });
  }
  res.json(plan);
});

app.post('/api/items/import/commit', auth.requireAuth, (req, res) => {
  const text = typeof req.body?.csv === 'string' ? req.body.csv : '';
  if (!text.trim()) {
    return res.status(400).json({ error: 'csv is required.' });
  }
  // Re-parses and re-diffs against the database's current state right
  // before writing, rather than trusting a plan computed moments earlier
  // during /preview — closes the (small but real) window where something
  // else could have changed the database in between.
  const plan = computeImportPlan(text, req.user.id);
  if (plan.error) {
    return res.status(400).json({ error: plan.error });
  }

  const insertStmt = db.prepare(
    `INSERT INTO items (user_id, name, quantity, unit, location, category, expiration_date, pack_size,
       fullness_unit, fullness_amount, fullness_total, percent_full)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const updateStmt = db.prepare(
    `UPDATE items SET name = ?, quantity = ?, unit = ?, location = ?, category = ?, expiration_date = ?,
       pack_size = ?, fullness_unit = ?, fullness_amount = ?, fullness_total = ?, percent_full = ?,
       updated_at = datetime('now') WHERE id = ? AND user_id = ?`
  );
  const deleteStmt = db.prepare('DELETE FROM items WHERE id = ? AND user_id = ?');

  const applyImport = db.transaction(() => {
    for (const { fields: f } of plan.toAdd) {
      insertStmt.run(
        req.user.id, f.name, f.quantity, f.unit, f.location, f.category, f.expirationDate, f.packSize,
        f.fullnessUnit, f.fullnessAmount, f.fullnessTotal, f.percentFull
      );
    }
    for (const { id, fields: f } of plan.toUpdate) {
      updateStmt.run(
        f.name, f.quantity, f.unit, f.location, f.category, f.expirationDate, f.packSize,
        f.fullnessUnit, f.fullnessAmount, f.fullnessTotal, f.percentFull, id, req.user.id
      );
    }
    for (const { id } of plan.toDelete) {
      deleteStmt.run(id, req.user.id);
    }
  });
  applyImport();

  res.json({ added: plan.toAdd.length, updated: plan.toUpdate.length, deleted: plan.toDelete.length });
});

// Adjust an item's quantity up or down (used by the +/- and "Use" buttons).
app.post('/api/items/:id/adjust', auth.requireAuth, (req, res) => {
  const { id } = req.params;
  const delta = Number(req.body && req.body.delta);
  if (!Number.isFinite(delta)) {
    return res.status(400).json({ error: 'delta must be a number.' });
  }

  const existing = db.prepare('SELECT * FROM items WHERE id = ? AND user_id = ?').get(id, req.user.id);
  if (!existing) {
    return res.status(404).json({ error: 'Item not found.' });
  }

  const newQty = Math.max(0, existing.quantity + delta);
  const clamped = clampFullnessToQuantity(newQty, existing.fullness_unit, existing.fullness_amount, existing.fullness_total);
  db.prepare(
    `UPDATE items SET quantity = ?, fullness_unit = ?, fullness_amount = ?, fullness_total = ?,
       percent_full = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?`
  ).run(newQty, clamped.fullnessUnit, clamped.fullnessAmount, clamped.fullnessTotal, clamped.percentFull, id, req.user.id);
  const row = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
  res.json(serializeItem(row));
});

// Deduct a used amount from an item — smarter than /adjust for a
// measurement-based amount (e.g. from a recipe: "used 2 cups of flour").
// If the item tracks container fullness and the given unit converts to
// the item's fullness unit (same family — weight or volume; cups never
// convert to oz, since that needs an ingredient-specific density), it
// deducts from the tracked fullness instead of the whole-number
// quantity. Otherwise (no fullness tracking, or an incompatible/absent
// unit — e.g. "3" eggs) it falls back to a plain quantity decrement, same
// as /adjust. You only ever say how much was USED; the app computes
// what's left.
app.post('/api/items/:id/use', auth.requireAuth, (req, res) => {
  const { id } = req.params;
  const amount = Number(req.body && req.body.amount);
  const unit = typeof req.body?.unit === 'string' ? req.body.unit.trim() : '';
  if (!Number.isFinite(amount) || amount < 0) {
    return res.status(400).json({ error: 'amount must be a non-negative number.' });
  }

  const existing = db.prepare('SELECT * FROM items WHERE id = ? AND user_id = ?').get(id, req.user.id);
  if (!existing) {
    return res.status(404).json({ error: 'Item not found.' });
  }

  // Beverages can only ever be used a whole bottle/can at a time — no
  // measured (weight/volume) deduction, enforced here too (not just in
  // the client's review card) so it holds regardless of what called
  // this — a recipe referencing a beverage by volume, for instance —
  // rather than only when the review card's own toggle was used.
  const isBeverage = existing.category === 'beverages';
  const hasFullness = !isBeverage && existing.fullness_amount != null && existing.fullness_total != null && existing.fullness_unit;
  const converted = hasFullness && unit ? convertUnit(amount, unit, existing.fullness_unit) : null;

  if (converted != null) {
    const newFullnessAmount = Math.max(0, existing.fullness_amount - converted);
    const newPercent = computePercentFull(newFullnessAmount, existing.fullness_total);
    db.prepare(
      `UPDATE items SET fullness_amount = ?, percent_full = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?`
    ).run(newFullnessAmount, newPercent, id, req.user.id);
  } else {
    const newQty = Math.max(0, existing.quantity - amount);
    const clamped = clampFullnessToQuantity(newQty, existing.fullness_unit, existing.fullness_amount, existing.fullness_total);
    db.prepare(
      `UPDATE items SET quantity = ?, fullness_unit = ?, fullness_amount = ?, fullness_total = ?,
         percent_full = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?`
    ).run(newQty, clamped.fullnessUnit, clamped.fullnessAmount, clamped.fullnessTotal, clamped.percentFull, id, req.user.id);
  }

  const row = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
  res.json(serializeItem(row));
});

// Update an item's fields directly (rename, retype unit/location, set quantity).
app.put('/api/items/:id', auth.requireAuth, (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM items WHERE id = ? AND user_id = ?').get(id, req.user.id);
  if (!existing) {
    return res.status(404).json({ error: 'Item not found.' });
  }

  const name = typeof req.body.name === 'string' && req.body.name.trim()
    ? req.body.name.trim()
    : existing.name;
  const unit = typeof req.body.unit === 'string' ? req.body.unit.trim() : existing.unit;
  const location = VALID_LOCATIONS.has(req.body.location) ? req.body.location : existing.location;
  const category = CATEGORY_IDS.has(req.body.category) ? req.body.category : existing.category;
  // expirationDate / packSize / fullness*: omit a field to leave it
  // unchanged; send '' or null to clear it. percentFull is always
  // recomputed from the resulting fullness amount/total, never set directly.
  const expirationDate = 'expirationDate' in req.body
    ? cleanExpirationDate(req.body.expirationDate)
    : existing.expiration_date;
  const packSize = 'packSize' in req.body ? cleanPackSize(req.body.packSize) : existing.pack_size;
  const fullnessUnit = 'fullnessUnit' in req.body
    ? cleanFullnessUnit(req.body.fullnessUnit)
    : existing.fullness_unit;
  const fullnessAmount = 'fullnessAmount' in req.body
    ? cleanPositiveAmount(req.body.fullnessAmount)
    : existing.fullness_amount;
  const fullnessTotal = 'fullnessTotal' in req.body
    ? cleanPositiveAmount(req.body.fullnessTotal)
    : existing.fullness_total;
  const qty = req.body.quantity !== undefined ? Number(req.body.quantity) : existing.quantity;
  if (!Number.isFinite(qty) || qty < 0) {
    return res.status(400).json({ error: 'Quantity must be a non-negative number.' });
  }
  const clamped = clampFullnessToQuantity(qty, fullnessUnit, fullnessAmount, fullnessTotal);

  db.prepare(
    `UPDATE items SET name = ?, quantity = ?, unit = ?, location = ?, category = ?, expiration_date = ?,
       pack_size = ?, fullness_unit = ?, fullness_amount = ?, fullness_total = ?, percent_full = ?,
       updated_at = datetime('now') WHERE id = ? AND user_id = ?`
  ).run(
    name, qty, unit, location, category, expirationDate, packSize,
    clamped.fullnessUnit, clamped.fullnessAmount, clamped.fullnessTotal, clamped.percentFull,
    id, req.user.id
  );
  const row = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
  res.json(serializeItem(row));
});

// Parse a spoken or typed sentence into structured item changes.
// Does NOT write to the database — the client reviews/edits the result
// and then calls the existing add/adjust endpoints to commit it.
app.post('/api/voice/parse', (req, res) => {
  const transcript = typeof req.body?.transcript === 'string' ? req.body.transcript.trim() : '';
  if (!transcript) {
    return res.status(400).json({ error: 'transcript is required.' });
  }

  try {
    const { items } = parseTranscript(transcript);
    const cleaned = items
      .map((item) => {
        const name = typeof item.name === 'string' ? item.name.trim() : '';
        return {
          name,
          quantity: Number.isFinite(Number(item.quantity)) ? Math.max(0, Number(item.quantity)) : 1,
          unit: typeof item.unit === 'string' ? item.unit.trim() : '',
          location: VALID_LOCATIONS.has(item.location) ? item.location : 'pantry',
          category: guessCategory(name),
          action: item.action === 'use' ? 'use' : 'add',
          expirationDate: cleanExpirationDate(item.expirationDate),
        };
      })
      .filter((item) => item.name);

    if (cleaned.length === 0) {
      return res.status(422).json({ error: "Couldn't find any items in that. Try rephrasing." });
    }
    res.json({ items: cleaned });
  } catch (err) {
    res.status(422).json({ error: err.message });
  }
});

// Look up a scanned barcode against a free product database (Open Food
// Facts). Read-only — doesn't write to the DB; the client reviews the
// result the same way it reviews a voice-parsed item before saving.
app.get('/api/barcode/:code', async (req, res) => {
  const { code } = req.params;
  if (!/^\d{6,14}$/.test(code)) {
    return res.status(400).json({ error: "That doesn't look like a valid barcode." });
  }

  try {
    const product = await lookupBarcode(code);
    res.json(product);
  } catch (err) {
    const status = err.code === 'NOT_FOUND' ? 404 : 502;
    res.status(status).json({ error: err.message });
  }
});

// Parse raw OCR'd receipt text into candidate items. Read-only — the
// client reviews/edits each item before it's saved, same as voice and
// barcode entry.
app.post('/api/receipt/parse', (req, res) => {
  const text = typeof req.body?.text === 'string' ? req.body.text : '';
  if (!text.trim()) {
    return res.status(400).json({ error: 'text is required.' });
  }

  const { items } = parseReceiptText(text);
  const cleaned = items
    .map((item) => ({
      name: typeof item.name === 'string' ? item.name.trim() : '',
      quantity: Number.isFinite(Number(item.quantity)) ? Math.max(0, Number(item.quantity)) : 1,
      unit: typeof item.unit === 'string' ? item.unit.trim() : '',
      location: VALID_LOCATIONS.has(item.location) ? item.location : 'pantry',
      category: CATEGORY_IDS.has(item.category) ? item.category : guessCategory(item.name),
      action: 'add',
      expirationDate: cleanExpirationDate(item.expirationDate),
      // The receipt parser pulls a package size (e.g. "32 fl oz") out of
      // the product title when there is one, so it drives the review
      // card's Weight/volume field automatically instead of the user
      // having to retype it — same treatment a scanned barcode gets.
      fullnessUnit: cleanFullnessUnit(item.fullnessUnit),
      fullnessAmount: cleanPositiveAmount(item.fullnessAmount),
      fullnessTotal: cleanPositiveAmount(item.fullnessTotal),
      // Tags this item as receipt-derived so the client can flag an
      // unusually high quantity as worth double-checking — OCR
      // occasionally misreads a single digit (e.g. "1" as "7"), and a
      // wrong quantity here isn't self-evidently wrong the way a
      // garbled name is.
      source: 'receipt',
    }))
    .filter((item) => item.name);

  if (cleaned.length === 0) {
    return res.status(422).json({
      error: "Couldn't find any items on that receipt. Try a clearer photo, or add items manually.",
    });
  }
  res.json({ items: cleaned });
});

// Parse a recipe's ingredient list (typed/pasted text, or OCR'd from a
// photo) into candidate items to USE from inventory — a recipe consumes
// ingredients, the opposite of a receipt. Read-only — the client
// reviews/edits each item (including switching it to Add) before
// anything is saved.
app.post('/api/recipe/parse', (req, res) => {
  const text = typeof req.body?.text === 'string' ? req.body.text : '';
  if (!text.trim()) {
    return res.status(400).json({ error: 'text is required.' });
  }

  const { items } = parseRecipeText(text);
  const cleaned = items
    .map((item) => ({
      name: typeof item.name === 'string' ? item.name.trim() : '',
      quantity: Number.isFinite(Number(item.quantity)) ? Math.max(0, Number(item.quantity)) : 1,
      unit: typeof item.unit === 'string' ? item.unit.trim() : '',
      location: VALID_LOCATIONS.has(item.location) ? item.location : 'pantry',
      category: CATEGORY_IDS.has(item.category) ? item.category : guessCategory(item.name),
      action: 'use',
      expirationDate: null,
    }))
    .filter((item) => item.name);

  if (cleaned.length === 0) {
    return res.status(422).json({
      error: "Couldn't find any ingredients in that. Try a clearer photo, or type them in instead.",
    });
  }
  res.json({ items: cleaned });
});

// User-added recipes for the Suggest recipes feature — kept separate
// from the bundled public/recipes.json list, which stays a static file
// served directly rather than DB rows. The client merges both into one
// pool and tags each with where it came from.
function serializeRecipe(row) {
  let ingredients;
  try {
    ingredients = JSON.parse(row.ingredients);
  } catch {
    ingredients = [];
  }
  return { id: row.id, name: row.name, ingredients, category: row.category || 'other' };
}

app.get('/api/recipes', auth.requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM recipes WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  res.json(rows.map(serializeRecipe));
});

app.post('/api/recipes', auth.requireAuth, (req, res) => {
  const { name, ingredients, category } = req.body || {};
  if (typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Recipe name is required.' });
  }
  if (!Array.isArray(ingredients)) {
    return res.status(400).json({ error: 'ingredients must be an array.' });
  }
  const cleanedIngredients = ingredients
    .map((ing) => ({
      name: typeof ing?.name === 'string' ? ing.name.trim() : '',
      quantity: Number.isFinite(Number(ing?.quantity)) && Number(ing.quantity) > 0 ? Number(ing.quantity) : 1,
      unit: typeof ing?.unit === 'string' ? ing.unit.trim() : '',
    }))
    .filter((ing) => ing.name);
  if (cleanedIngredients.length === 0) {
    return res.status(400).json({ error: 'At least one ingredient with a name is required.' });
  }
  const cleanCategory = RECIPE_CATEGORY_IDS.has(category) ? category : 'other';

  const info = db
    .prepare('INSERT INTO recipes (user_id, name, ingredients, category) VALUES (?, ?, ?, ?)')
    .run(req.user.id, name.trim(), JSON.stringify(cleanedIngredients), cleanCategory);
  const row = db.prepare('SELECT * FROM recipes WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(serializeRecipe(row));
});

app.delete('/api/recipes/:id', auth.requireAuth, (req, res) => {
  const info = db.prepare('DELETE FROM recipes WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  if (info.changes === 0) {
    return res.status(404).json({ error: 'Recipe not found.' });
  }
  res.status(204).end();
});

// Delete an item entirely.
app.delete('/api/items/:id', auth.requireAuth, (req, res) => {
  const { id } = req.params;
  const info = db.prepare('DELETE FROM items WHERE id = ? AND user_id = ?').run(id, req.user.id);
  if (info.changes === 0) {
    return res.status(404).json({ error: 'Item not found.' });
  }
  res.status(204).end();
});

app.listen(PORT, () => {
  console.log(`Pantry inventory tracker running at http://localhost:${PORT}`);
});
