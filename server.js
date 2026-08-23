const express = require('express');
const path = require('path');
const db = require('./db');
const { parseTranscript } = require('./voiceParser');
const { CATEGORIES, CATEGORY_IDS, guessCategory } = require('./categorize');
const { lookupBarcode } = require('./barcode');
const { parseReceiptText } = require('./receiptParser');
const { parseRecipeText } = require('./recipeParser');
const { convert: convertUnit } = require('./unitConvert');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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
app.get('/api/items', (req, res) => {
  const rows = db
    .prepare(
      `SELECT * FROM items
       ORDER BY
         category,
         CASE WHEN expiration_date IS NOT NULL AND expiration_date != '' THEN 0 ELSE 1 END,
         expiration_date,
         quantity,
         location,
         name COLLATE NOCASE`
    )
    .all();
  res.json(rows.map(serializeItem));
});

// Create a new item, or if an item with the same name/unit/location already
// exists, add to its quantity instead of creating a duplicate row.
app.post('/api/items', (req, res) => {
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
       WHERE name = ? COLLATE NOCASE AND unit = ? COLLATE NOCASE AND location = ?`
    )
    .get(cleanName, cleanUnit, cleanLocation);

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
         updated_at = datetime('now') WHERE id = ?`
    ).run(
      newQty, mergedExpiration, mergedPack,
      clamped.fullnessUnit, clamped.fullnessAmount, clamped.fullnessTotal, clamped.percentFull,
      existing.id
    );
    row = db.prepare('SELECT * FROM items WHERE id = ?').get(existing.id);
  } else {
    const clamped = clampFullnessToQuantity(qty, cleanFullnessUnitVal, cleanFullnessAmount, cleanFullnessTotal);
    const info = db
      .prepare(
        `INSERT INTO items (name, quantity, unit, location, category, expiration_date, pack_size,
           fullness_unit, fullness_amount, fullness_total, percent_full)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        cleanName, qty, cleanUnit, cleanLocation, cleanCategory, cleanExpiration, cleanPack,
        clamped.fullnessUnit, clamped.fullnessAmount, clamped.fullnessTotal, clamped.percentFull
      );
    row = db.prepare('SELECT * FROM items WHERE id = ?').get(info.lastInsertRowid);
  }

  res.status(201).json(serializeItem(row));
});

// Adjust an item's quantity up or down (used by the +/- and "Use" buttons).
app.post('/api/items/:id/adjust', (req, res) => {
  const { id } = req.params;
  const delta = Number(req.body && req.body.delta);
  if (!Number.isFinite(delta)) {
    return res.status(400).json({ error: 'delta must be a number.' });
  }

  const existing = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Item not found.' });
  }

  const newQty = Math.max(0, existing.quantity + delta);
  const clamped = clampFullnessToQuantity(newQty, existing.fullness_unit, existing.fullness_amount, existing.fullness_total);
  db.prepare(
    `UPDATE items SET quantity = ?, fullness_unit = ?, fullness_amount = ?, fullness_total = ?,
       percent_full = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(newQty, clamped.fullnessUnit, clamped.fullnessAmount, clamped.fullnessTotal, clamped.percentFull, id);
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
app.post('/api/items/:id/use', (req, res) => {
  const { id } = req.params;
  const amount = Number(req.body && req.body.amount);
  const unit = typeof req.body?.unit === 'string' ? req.body.unit.trim() : '';
  if (!Number.isFinite(amount) || amount < 0) {
    return res.status(400).json({ error: 'amount must be a non-negative number.' });
  }

  const existing = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Item not found.' });
  }

  const hasFullness = existing.fullness_amount != null && existing.fullness_total != null && existing.fullness_unit;
  const converted = hasFullness && unit ? convertUnit(amount, unit, existing.fullness_unit) : null;

  if (converted != null) {
    const newFullnessAmount = Math.max(0, existing.fullness_amount - converted);
    const newPercent = computePercentFull(newFullnessAmount, existing.fullness_total);
    db.prepare(
      `UPDATE items SET fullness_amount = ?, percent_full = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(newFullnessAmount, newPercent, id);
  } else {
    const newQty = Math.max(0, existing.quantity - amount);
    const clamped = clampFullnessToQuantity(newQty, existing.fullness_unit, existing.fullness_amount, existing.fullness_total);
    db.prepare(
      `UPDATE items SET quantity = ?, fullness_unit = ?, fullness_amount = ?, fullness_total = ?,
         percent_full = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(newQty, clamped.fullnessUnit, clamped.fullnessAmount, clamped.fullnessTotal, clamped.percentFull, id);
  }

  const row = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
  res.json(serializeItem(row));
});

// Update an item's fields directly (rename, retype unit/location, set quantity).
app.put('/api/items/:id', (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
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
       updated_at = datetime('now') WHERE id = ?`
  ).run(
    name, qty, unit, location, category, expirationDate, packSize,
    clamped.fullnessUnit, clamped.fullnessAmount, clamped.fullnessTotal, clamped.percentFull,
    id
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

// Delete an item entirely.
app.delete('/api/items/:id', (req, res) => {
  const { id } = req.params;
  const info = db.prepare('DELETE FROM items WHERE id = ?').run(id);
  if (info.changes === 0) {
    return res.status(404).json({ error: 'Item not found.' });
  }
  res.status(204).end();
});

app.listen(PORT, () => {
  console.log(`Pantry inventory tracker running at http://localhost:${PORT}`);
});
