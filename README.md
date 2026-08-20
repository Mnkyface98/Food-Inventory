# Pantry & Fridge Inventory Tracker

A simple, mobile-friendly web app for tracking what's in your pantry, fridge,
and freezer. Data is stored in a real SQLite database file, so it persists
across restarts — nothing lives only in browser memory or localStorage.

This is the first milestone: a list view with manual add/use controls.
Voice entry and receipt scanning are planned as follow-ups.

## Features

- Add items with a name, quantity, and unit (e.g. "Rice", 2, "bags")
- Assign each item to Pantry, Fridge, or Freezer
- Quick **+ / −** buttons to add or use one unit at a time
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

## API

| Method | Path                     | Description                             |
| ------ | ------------------------ | ---------------------------------------- |
| GET    | `/api/items`              | List all items                          |
| POST   | `/api/items`               | Add an item (merges into an existing matching item) |
| POST   | `/api/items/:id/adjust`    | Adjust quantity by a delta (+1 / -1)    |
| PUT    | `/api/items/:id`           | Update an item's fields directly        |
| DELETE | `/api/items/:id`           | Remove an item                          |

## Roadmap

- [ ] Voice entry ("add two cans of beans")
- [ ] Receipt scanning / OCR import
- [ ] Low-stock alerts / shopping list export
