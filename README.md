# Pantry & Fridge Inventory Tracker

A simple, mobile-friendly web app for tracking what's in your pantry, fridge,
and freezer. Data is stored in a real SQLite database file, so it persists
across restarts — nothing lives only in browser memory or localStorage.

Every way of updating your inventory — manual buttons, voice/text, barcode
scan, or receipt photo — feeds the same list, with items categorized by food
type and sorted so what's expiring soon or running low surfaces first.

## Features

- Add items with a name, quantity, and unit (e.g. "Rice", 2, "bags")
- Assign each item to Pantry, Fridge, or Freezer
- **"+ Add item" and "− Use item"** — equally prominent full-width
  buttons, and the only thing on the page until you tap one. Every entry
  method stays out of the way until then, so there's nothing to puzzle
  over up front. Tapping **+ Add item** reveals quick text/mic entry,
  barcode scanning, and receipt scanning; **− Use item** reveals all of
  that *and* recipe ingredients too (since a recipe is naturally
  something you use up, not add). ✕ closes it all back down to just the
  two buttons — nothing typed is lost, it's just hidden until you
  reopen the same mode. There's no separate manual-entry form to open —
  the text box (type or speak a sentence, e.g. *"add 2 bottles of olive
  oil"* or just a bare item name) produces the same fully editable
  review card as scanning does, so it doubles as manual entry: type as
  little or as much as you want, then adjust any field before
  confirming. Either way, add new stock or subtract from an existing
  item by that name (an item that doesn't exist yet says so instead of
  guessing)
- **One consistent card, however an item gets entered**: typed, spoken,
  scanned, or parsed from a receipt/recipe photo all land on the same
  review card with the same fields in the same order (Qty/Unit,
  Location/Category, Expiration date, Weight/volume) — nothing about
  reviewing an item looks different depending on how it got there.
  **Unit** is a dropdown of common packaging (bottle, box, piece, can,
  bag, jar, package, carton, stick, bunch); **Weight/volume** is a
  separate amount + unit (oz, fl oz, lb, kg, g, ml, L, cup, tbsp, tsp).
  The instant the typed/spoken/scanned name matches something already
  in your inventory, Unit, Location, Category, and the Weight/volume
  unit all fill themselves in from that item's own record — you're not
  re-describing something the app already knows just because you're
  using it again. Weight/volume itself does double duty depending on
  the card's Add/Use toggle: on **Add** it's the item's size (assumed
  full, so it doubles as both total and current amount); switch to
  **Use** and it relabels to "Weight/volume used," where typing an
  amount deducts that much from the matched item's tracked total
  instead of decrementing its whole-number count
- Quick **+ / −** buttons on each item card to add or use one unit at a time
- **Voice / quick-sentence entry**: tap the mic and say (or type) something
  like *"add two cans of black beans to the pantry"* or *"used the last of
  the milk"* — it's parsed into structured item(s) that you review and edit
  before anything is saved
- **Categorized by food type** (Produce, Dairy & Eggs, Meat & Seafood, Frozen,
  Bakery, Grains & Pasta, Canned Goods, Condiments & Sauces, Spices &
  Baking, Snacks, Beverages, Other) — guessed automatically from the item
  name, editable via a dropdown
- **Expiration dates**: optional, set manually or captured from voice/typed
  phrases like *"expires next Friday"* or *"best by 8/25"*. Items with a
  date sort to the top of their category (soonest first), with "Expires
  today/tomorrow" and "Expired" badges
- Within each category, items with no expiration date sort by
  **lowest quantity first** (with "Low"/"Out" badges) so what needs
  restocking is easy to spot. What counts as "low" (see below) can be
  tailored per item, not just one flat number for everything
- **Barcode scanning**: tap 📷, point your phone's camera at a product
  barcode, and it's looked up automatically (name, category) and dropped
  into the same review flow as voice entry — quantity always starts at 1
  (you scanned one item, not "500" of it); the package size (e.g. "500 ml")
  pre-fills the review card's Weight/volume field automatically instead
  of sitting as inert label text, still editable before you confirm
- **Receipt scanning**: tap 🧾, take/choose a photo of a receipt, and it's
  OCR'd and parsed into a list of candidate items to review — a fast way to
  restock a whole grocery trip at once
- **Recipe ingredients**: tap 📋, then either paste/type an ingredient list
  or upload a photo of a recipe. Each ingredient is parsed and defaults to
  **Use** instead of Add — a recipe consumes inventory, the opposite of a
  receipt. Measurement-based ingredients (e.g. "200 g flour") deduct from a
  matched item's tracked weight/volume when available (converting
  compatible units — weight ↔ weight, volume ↔ volume — never guessing a
  cups-to-ounces conversion, which needs an ingredient-specific density);
  whole-count ingredients (e.g. "3 eggs") just decrement the item's count.
  You only ever say how much was used — the app works out what's left
- **Edit any item after adding it**: tap its name to open an inline edit
  form for name, quantity, unit (dropdown), location, category,
  expiration date, and — under "Low-stock tracking" — pack size,
  weight/volume (the item's size), and amount remaining, all directly
  editable since this form corrects an item's true current state rather
  than logging a transaction. Save commits, Cancel discards
- Delete items you no longer want to track
- Filter by category (tap a tab: All, Produce, Dairy & Eggs, ...) and
  search by name; each item card shows its own Pantry/Fridge/Freezer
  location and category as pills, plus its unit and weight/volume
  reading (e.g. "300/500 ml") when it's tracked — everything you'd
  otherwise have to open the item to see
- In the **All** view, category sections start **collapsed** by default
  (e.g. "▸ Dairy & Eggs (2)") — tap a heading to expand it, tap again to
  collapse. Handy once you've got a lot of categories in play; expanded
  sections reset back to collapsed on a page reload
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

Tap the 🎤 button and speak a sentence, or just type one and tap **Submit**.
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
- **Expiration phrases** are recognized too: "expires <date>", "best by
  <date>", "use by <date>", "good until/till <date>", "sell by <date>".
  `<date>` can be relative ("tomorrow", "next Friday", "in 3 days", "next
  week") or absolute ("8/25", "8/25/2026", "August 25th"). Adding more
  stock of an item that already has a date keeps the **sooner** of the two
  dates, since that's the batch that needs using first.

## Barcode scanning

Tap **📷 Scan a barcode**, point your camera at a product's barcode, and hold
steady for a second. The result goes through the same editable review card
as voice entry — nothing saves until you confirm — with the "Add"/"Use"
toggle available too, so scanning works for using up an item as well as
stocking one.

- **Camera decoding** runs entirely on-device via
  [ZXing](https://github.com/zxing-js/library) (vendored locally in
  `public/vendor/`, no CDN dependency at runtime) — no image is ever
  uploaded anywhere. Needs camera permission and a secure context (HTTPS,
  or `localhost`), same as the mic; the button hides automatically if the
  browser doesn't support it.
- **Product lookup** uses [Open Food Facts](https://world.openfoodfacts.org)
  — a free, keyless public product database. If a barcode isn't found
  there, you get a clear message and an empty review card to fill in
  manually — nothing is guessed at random.
- **Category** for a scanned item is taken from Open Food Facts' own
  category data when available (more accurate for branded/unusual names —
  e.g. "Nutella Hazelnut Spread" correctly lands in Condiments & Sauces
  because OFF tags it as a spread, even though neither word is in the
  keyword list), falling back to the same name-based guess as manual/voice
  entry when OFF has no category data for that product.
- The scanned barcode number itself isn't stored — only the resulting item.

## Receipt scanning

Tap **🧾 Scan a receipt** to take (or choose) a photo of a paper receipt, or
**📸 Use this device's camera** for a live in-browser capture instead. Each
recognized product line becomes an editable review card — same flow as
voice and barcode entry, add-vs-use toggle included, nothing saved until you
confirm.

- **Two ways to get a photo in.** "Scan a receipt" is the device's native
  camera/photo picker — on a phone this opens the camera directly; on a
  desktop browser (no camera picker to fall back to) it's just a file
  browser. "Use this device's camera" opens a live camera preview right
  in the page — a real "take a picture" option on a desktop with a
  webcam, and it works on phones too. It only appears when your browser
  actually supports camera access (`getUserMedia`); recipe photos get
  the same pair of options.
- **OCR runs entirely on-device** via [Tesseract.js](https://github.com/naptha/tesseract.js)
  — engine *and* the English language model are fully vendored locally in
  `public/vendor/tesseract/` (~7 MB total), so it works offline after the
  page has loaded and the photo never leaves your device. First recognition
  on a phone can take some seconds; a status line shows progress.
- **Line parsing** is a free, rule-based parser (`receiptParser.js`) that
  keeps lines ending in a price and drops everything else (store name/
  address, subtotal/tax/total, card/auth info, footers) — real receipts
  use heavily abbreviated names ("GV WHL MILK GAL"), so double-check the
  review cards before confirming. If a line happens to show an expiration/
  sell-by date, that's picked up too.
- OCR accuracy depends a lot on photo quality — flat, well-lit, and
  in-focus works best. A blurry or angled photo may miss items or misread
  names; nothing is guessed beyond what's on the page, and unrecognized
  photos say so rather than fabricating items.

## Recipe ingredients

Tap **− Use item** to reveal **📋 Enter recipe ingredients** (it's Use-only —
a recipe consumes inventory, so it doesn't show up under + Add item), then
tap it to reveal a text box (type or paste a list) and a photo option —
upload a photo or use the same live in-browser camera capture as receipt
scanning (same on-device OCR either way) — use any of them. Each
recognized ingredient becomes a
review card exactly like voice/barcode/receipt entry, except it defaults
to **Use** instead of Add, since a recipe consumes what's in your
inventory rather than restocking it. Switch any card to Add if one
should go the other way.

- **Line parsing** (`recipeParser.js`) understands whole numbers,
  decimals, fractions ("1/2"), and mixed numbers ("1 1/2"), plus common
  cooking units (cups, tbsp, tsp, oz, lb, g, kg, ml, L, pinch, dash,
  clove, can, package, ...). It drops parenthetical asides ("(such as
  Roma)"), prep notes after a comma ("diced", "melted"), section headers
  ("Ingredients:"), and numbered instruction steps ("1. Preheat the
  oven...") — keeping only plausible ingredient lines.
- **Flexible entry**: ingredients can go one per line, comma-separated
  on a single line ("2 cups flour, 1 tsp salt, 3 eggs"), or just spaced
  out on a single line with no punctuation at all ("2 cups flour 1 tsp
  salt 3 eggs") — any mix of the three in the same box works too. Each
  new quantity (a number, a fraction, or a word like "a"/"few") is
  treated as the start of the next ingredient; a comma-separated bit
  with no quantity of its own ("diced", "room temperature") is kept
  attached to the ingredient before it as a prep note, not split out as
  its own item.
- **Deducting**: you only ever say how much was used (e.g. "200 g
  flour") — the app works out what's left, never asking you to enter a
  remaining amount yourself. If the matched inventory item tracks
  weight/volume (see below) and the recipe's unit is compatible
  (same family — weight ↔ weight, like oz/lb/g/kg, or volume ↔ volume,
  like cups/tbsp/tsp/ml/L), it deducts from that container's tracked
  amount. It deliberately never converts across families (e.g. cups to
  ounces), since that needs an ingredient-specific density a free/local
  app can't know — a cup of flour and a cup of butter don't weigh the
  same. When there's no fullness tracking, or the unit doesn't apply
  (e.g. "3 eggs", "2 cans of beans"), it falls back to decrementing the
  item's whole-number count instead — the same behavior as any other
  Use action in the app.

## What counts as "low stock"

Rather than one flat number for every item, each item is checked against
these rules, in order — the first one that applies wins:

1. **Out of stock** — quantity is 0 (or, for a tracked single container,
   0% full) always shows "Out," overriding everything else below.
2. **Weight/volume tracking** — instead of typing an abstract
   percentage, you work with a real measurement: a unit (oz, fl oz, lb,
   kg, g, ml, L, cup, tbsp, or tsp) and the size of a single item, set on
   a review card's "Weight/volume" field (e.g. "16 oz" for one bottle)
   while it's set to **Add** — leave it blank for items you don't need
   this level of tracking for. A newly (re)stocked item is assumed to
   start full, so that's all there is to set; a **barcode scan** fills
   it in automatically from the product's package size (e.g. "500 ml"),
   still editable before you confirm. From there, using some of it is
   just switching the same card to **Use**, which relabels the field to
   "Weight/volume used" — type how much you used and its unit
   (pre-filled on its own the moment the typed name matches a tracked
   item, editable if you're using a different measurement), and the app
   deducts it from that item's running total. You only ever say how
   much was used, never how much is left, and the running total itself
   is never shown back to you, just the result. The app computes the
   percentage remaining and flags it low at **50% full or less** (half
   or more used) — the item's card shows the current reading (e.g.
   "8/16 oz") alongside the badge. Restocking an already-tracked item
   on **Add** without typing a new weight/volume leaves its existing
   reading untouched; typing one always means "this is now a full item
   of that size." Only applies while quantity is exactly 1 *and* no
   pack size is set on the item, since it stops meaning anything with
   2+ items or once you're counting a pack instead.
3. **Pack size tracking** — if you've set a "pack size" (the count it
   started at, e.g. 24) by editing an item, it's flagged low once the
   remaining quantity drops to **25% or less** of that (6 or fewer left
   of a 24-pack). There's no pack-size field on + Add item / − Use item —
   it's a one-time setup you do by tapping an item's name to edit it.
4. **Canned food** (unit "can"/"cans" + category Canned Goods) — low at
   **2 or fewer** cans.
5. **Canned beverages** (unit "can"/"cans" + category Beverages) — low at
   **4 or fewer** cans.
6. **Everything else** — the flat fallback: low at **1 or fewer**.

Pack size and weight/volume are optional and per-item — set them once on
an item you want tracked that way and they stick until you change or
clear them; every other item just uses whichever of rules 4-6 applies.
to full.

## API

| Method | Path                     | Description                             |
| ------ | ------------------------ | ---------------------------------------- |
| GET    | `/api/categories`          | List valid food categories              |
| GET    | `/api/items`              | List all items (grouped by category, low-stock/expiring first) |
| POST   | `/api/items`               | Add an item (merges into an existing matching item; category auto-guessed if omitted; expiration date kept as the sooner of the two on merge) |
| POST   | `/api/items/:id/adjust`    | Adjust quantity by a delta (+1 / -1)    |
| POST   | `/api/items/:id/use`       | Deduct a used amount+unit — converts into the item's tracked weight/volume when compatible, otherwise decrements quantity |
| PUT    | `/api/items/:id`           | Update an item's fields directly        |
| DELETE | `/api/items/:id`           | Remove an item                          |
| POST   | `/api/voice/parse`         | Parse a sentence into structured item(s) (read-only — doesn't write to the DB) |
| GET    | `/api/barcode/:code`       | Look up a barcode via Open Food Facts (read-only) |
| POST   | `/api/receipt/parse`       | Parse OCR'd receipt text into candidate item(s) (read-only) |
| POST   | `/api/recipe/parse`        | Parse typed/OCR'd recipe ingredients into candidate item(s) to use (read-only) |

## Roadmap

- [x] Voice entry ("add two cans of beans")
- [x] Food categories + low-stock/expiring-first sorting within each category
- [x] Expiration date capture (manual + voice/text phrases)
- [x] Barcode scanning
- [x] Receipt scanning / OCR import
- [x] Recipe ingredients (text or photo) deduct from inventory
