# Pantry & Fridge Inventory Tracker

A simple, mobile-friendly web app for tracking what's in your pantry, fridge,
and freezer. Data is stored in a real SQLite database file, so it persists
across restarts — nothing lives only in browser memory or localStorage.

Milestones so far: a list view with manual add/use controls, plus voice /
quick-sentence entry. Receipt scanning is planned as a follow-up.

## Features

- Add items with a name, quantity, and unit (e.g. "Rice", 2, "bags")
- Assign each item to Pantry, Fridge, or Freezer
- Quick **+ / −** buttons to add or use one unit at a time
- **Voice / quick-sentence entry**: tap the mic and say (or type) something
  like *"add two cans of black beans to the pantry"* or *"used the last of
  the milk"* — it's parsed into structured item(s) that you review and edit
  before anything is saved
- Delete items you no longer want to track
- Filter by location and search by name
- Responsive, large-tap-target layout designed for phone browsers
- Persistent storage via SQLite (survives server restarts)

## Getting started

```bash
npm install
npm start
```

The app runs at `http://localhost:3000` by default (set `PORT` to change it).

To use it from your phone on the same network, find your computer's LAN IP
(e.g. `192.168.1.23`) and visit `http://<that-ip>:3000` from your phone's
browser.

## Data storage

Data is stored in `data/inventory.db` (created automatically on first run).
This file is the source of truth for your inventory — back it up if you
care about the data, and don't delete the `data/` directory unless you want
to start fresh.

If you deploy this app somewhere, make sure the `data/` directory (or
whatever you set `DATA_DIR` to) is on a **persistent disk/volume** — on
platforms with ephemeral filesystems (e.g. most default container/PaaS
setups), point `DATA_DIR` at a mounted volume so data isn't wiped on
redeploy.

## Voice / quick-sentence entry

Tap the 🎤 button and speak a sentence, or just type one and tap **Parse it**.
It's split into item(s) with a guessed name, quantity, unit, location, and
whether you're adding or using it — you review and edit each one before it's
saved, so nothing is written on a bad guess.

- **Speech capture** uses the browser's built-in Web Speech API — free, no
  API key, no audio sent to any server. It's well supported in Chrome
  (desktop and Android). **Safari (iOS) doesn't support it**, so the mic
  button is hidden there automatically; type instead, or use your iPhone
  keyboard's built-in dictation button in the text field — that still gets
  parsed the same way.
- **Parsing** is a free, rule-based parser on the server (`voiceParser.js`)
  — keyword/pattern matching for quantities ("two", "a dozen", "a few"),
  units, locations, and add-vs-use verbs. No external API or cost, but it's
  not an LLM: unusual phrasing may need a quick edit in the review card.
- For "use" entries, it matches against your existing items by name; if it
  can't find a match it tells you rather than silently creating a phantom
  item.

## API

| Method | Path                     | Description                             |
| ------ | ------------------------ | ---------------------------------------- |
| GET    | `/api/items`              | List all items                          |
| POST   | `/api/items`               | Add an item (merges into an existing matching item) |
| POST   | `/api/items/:id/adjust`    | Adjust quantity by a delta (+1 / -1)    |
| PUT    | `/api/items/:id`           | Update an item's fields directly        |
| DELETE | `/api/items/:id`           | Remove an item                          |
| POST   | `/api/voice/parse`         | Parse a sentence into structured item(s) (read-only — doesn't write to the DB) |

## Roadmap

- [x] Voice entry ("add two cans of beans")
- [ ] Receipt scanning / OCR import
- [ ] Low-stock alerts / shopping list export
