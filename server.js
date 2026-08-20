const express = require('express');
const path = require('path');
const db = require('./db');
const { parseTranscript } = require('./voiceParser');
const { CATEGORIES, CATEGORY_IDS, guessCategory } = require('./categorize');
const { lookupBarcode } = require('./barcode');

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

function serializeItem(row) {
  return {
    id: row.id,
    name: row.name,
    quantity: row.quantity,
    unit: row.unit,
    location: row.location,
    category: row.category,
    expirationDate: row.expiration_date || null,
    updatedAt: row.updated_at,
  };
}

// The list of valid categories, for the client to build its dropdowns from.
app.get('/api/categories', (req, res) => {
  res.json(CATEGORIES);
});

// List all items. Ordered by location, then category; within a category,
// items with an expiration date sort first (soonest first), then items
// without one sort by quantity ascending (low-stock first).
app.get('/api/items', (req, res) => {
  const rows = db
    .prepare(
      `SELECT * FROM items
       ORDER BY
         location,
         category,
         CASE WHEN expiration_date IS NOT NULL AND expiration_date != '' THEN 0 ELSE 1 END,
         expiration_date,
         quantity,
         name COLLATE NOCASE`
    )
    .all();
  res.json(rows.map(serializeItem));
});

// Create a new item, or if an item with the same name/unit/location already
// exists, add to its quantity instead of creating a duplicate row.
app.post('/api/items', (req, res) => {
  const { name, quantity, unit, location, category, expirationDate } = req.body || {};

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

  const existing = db
    .prepare(
      `SELECT * FROM items
       WHERE name = ? COLLATE NOCASE AND unit = ? COLLATE NOCASE AND location = ?`
    )
    .get(cleanName, cleanUnit, cleanLocation);

  let row;
  if (existing) {
    const mergedExpiration = mergeExpirationDate(existing.expiration_date, cleanExpiration);
    db.prepare(
      `UPDATE items SET quantity = quantity + ?, expiration_date = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(qty, mergedExpiration, existing.id);
    row = db.prepare('SELECT * FROM items WHERE id = ?').get(existing.id);
  } else {
    const info = db
      .prepare(
        `INSERT INTO items (name, quantity, unit, location, category, expiration_date) VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(cleanName, qty, cleanUnit, cleanLocation, cleanCategory, cleanExpiration);
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
  db.prepare(
    `UPDATE items SET quantity = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(newQty, id);
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
  // expirationDate: omit the field to leave it unchanged; send '' or null to clear it.
  const expirationDate = 'expirationDate' in req.body
    ? cleanExpirationDate(req.body.expirationDate)
    : existing.expiration_date;
  const qty = req.body.quantity !== undefined ? Number(req.body.quantity) : existing.quantity;
  if (!Number.isFinite(qty) || qty < 0) {
    return res.status(400).json({ error: 'Quantity must be a non-negative number.' });
  }

  db.prepare(
    `UPDATE items SET name = ?, quantity = ?, unit = ?, location = ?, category = ?, expiration_date = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(name, qty, unit, location, category, expirationDate, id);
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
