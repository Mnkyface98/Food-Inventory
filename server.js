const express = require('express');
const path = require('path');
const db = require('./db');
const { parseTranscript } = require('./voiceParser');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const VALID_LOCATIONS = new Set(['pantry', 'fridge', 'freezer']);

function serializeItem(row) {
  return {
    id: row.id,
    name: row.name,
    quantity: row.quantity,
    unit: row.unit,
    location: row.location,
    updatedAt: row.updated_at,
  };
}

// List all items, most recently updated first.
app.get('/api/items', (req, res) => {
  const rows = db
    .prepare('SELECT * FROM items ORDER BY location, name COLLATE NOCASE')
    .all();
  res.json(rows.map(serializeItem));
});

// Create a new item, or if an item with the same name/unit/location already
// exists, add to its quantity instead of creating a duplicate row.
app.post('/api/items', (req, res) => {
  const { name, quantity, unit, location } = req.body || {};

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

  const existing = db
    .prepare(
      `SELECT * FROM items
       WHERE name = ? COLLATE NOCASE AND unit = ? COLLATE NOCASE AND location = ?`
    )
    .get(cleanName, cleanUnit, cleanLocation);

  let row;
  if (existing) {
    db.prepare(
      `UPDATE items SET quantity = quantity + ?, updated_at = datetime('now') WHERE id = ?`
    ).run(qty, existing.id);
    row = db.prepare('SELECT * FROM items WHERE id = ?').get(existing.id);
  } else {
    const info = db
      .prepare(
        `INSERT INTO items (name, quantity, unit, location) VALUES (?, ?, ?, ?)`
      )
      .run(cleanName, qty, cleanUnit, cleanLocation);
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
  const qty = req.body.quantity !== undefined ? Number(req.body.quantity) : existing.quantity;
  if (!Number.isFinite(qty) || qty < 0) {
    return res.status(400).json({ error: 'Quantity must be a non-negative number.' });
  }

  db.prepare(
    `UPDATE items SET name = ?, quantity = ?, unit = ?, location = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(name, qty, unit, location, id);
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
      .map((item) => ({
        name: typeof item.name === 'string' ? item.name.trim() : '',
        quantity: Number.isFinite(Number(item.quantity)) ? Math.max(0, Number(item.quantity)) : 1,
        unit: typeof item.unit === 'string' ? item.unit.trim() : '',
        location: VALID_LOCATIONS.has(item.location) ? item.location : 'pantry',
        action: item.action === 'use' ? 'use' : 'add',
      }))
      .filter((item) => item.name);

    if (cleaned.length === 0) {
      return res.status(422).json({ error: "Couldn't find any items in that. Try rephrasing." });
    }
    res.json({ items: cleaned });
  } catch (err) {
    res.status(422).json({ error: err.message });
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
