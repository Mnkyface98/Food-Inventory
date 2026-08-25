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
  barcode scanning, and receipt scanning — all ways of bringing a new
  product into inventory. **− Use item** reveals text/mic entry and
  recipe ingredients, but not barcode/receipt scanning — a scan only
  ever describes a product you're adding, never one you're using up;
  finding what to use is what the item-name suggestion list is for
  instead (see below). ✕ closes it all back down to just the two
  buttons — nothing typed is lost, it's just hidden until you reopen
  the same mode. There's no separate manual-entry form to open — the
  text box (type or speak a sentence, e.g. *"add 2 bottles of olive
  oil"* or just a bare item name) produces the same fully editable
  review card as scanning does, so it doubles as manual entry: type as
  little or as much as you want, then adjust any field before
  confirming. Either way, add new stock or subtract from an existing
  item by that name (an item that doesn't exist yet says so instead of
  guessing) — under **− Use item**, every card is locked to Use: there's
  no Add toggle to switch to, so there's no way to create a new item
  from that area at all, whether it's a typo'd name or a real item you
  haven't added yet (add it via + Add item first, then use it)
- **One consistent card, however an item gets entered**: typed, spoken,
  scanned, or parsed from a receipt/recipe photo all land on the same
  review card with the same fields in the same order — Item name, Unit,
  Weight/volume (+ its own unit), Quantity, Category, Location, and
  Expiration date on **Add** only (see below) — nothing about reviewing
  an item looks different depending on how it got there. **Quantity**
  is labeled "Quantity being added" or "Quantity being used" depending
  on the card's Add/Use toggle, so it's never ambiguous what typing a
  number there will do — and picking an item's exact name (typed,
  spoken, or from the suggestion list) always defaults it to 1, never
  a stray digit misread out of the name itself. **Unit** is a dropdown
  of common
  packaging (bottle, box, piece, can, bag, jar, package, carton, stick,
  bunch); **Weight/volume** is a separate amount + unit (oz, fl oz, lb,
  kg, g, ml, L, cup, tbsp, tsp), and its label always names the
  selected Unit back — "Weight/volume per bottle," "per box," etc. (or
  "per unit" until one's picked) — so it's never mistaken for a total
  across everything in stock; it's always just the size of one. The
  instant the typed/spoken/scanned name matches something already
  in your inventory, Unit, Location, Category, and the Weight/volume
  unit all fill themselves in from that item's own record — you're not
  re-describing something the app already knows just because you're
  using it again. Weight/volume itself does double duty depending on
  the card's Add/Use toggle: on **Add** it's the item's size (assumed
  full, so it doubles as both total and current amount); switch to
  **Use** and it relabels to "Weight/volume used," where typing an
  amount deducts that much from the matched item's tracked total
  instead of decrementing its whole-number count. On **Use**, the plain
  **Unit** dropdown (bottle, box, piece, etc.) disappears — the matched
  item already tells the card what that is, nothing left to redefine —
  but the **Weight/volume unit** dropdown stays selectable, since the
  unit you're logging a use in doesn't have to match how the item's
  stored: track a bottle in fl oz but log "used 1 cup" and it converts
  automatically (weight ↔ weight, volume ↔ volume) before deducting.
  On **Use**, Quantity and Weight/volume are mutually exclusive — using
  "1 bottle" and logging "6 fl oz used" can't both be true — so the
  card defaults to whole-units mode (Quantity active, Weight/volume
  greyed out and unselectable) with a **"Log a measured amount
  instead"** link to switch: click it to grey out Quantity instead and
  type a partial amount there. The running total itself is never shown
  back to you either way, just the resulting Low/Out badge and, in the
  item's own read-only detail view (tap its name — see below), the
  updated Amount remaining. Both the top typed/spoken text box and the review
  card's item-name field suggest matching names from your current
  inventory as you type a few letters, so picking one from the list —
  rather than retyping it slightly differently each time — keeps "Use"
  matching the item you actually mean. Typing (or speaking) a name
  doesn't even need to be exact: a close spelling — a typo, a missing
  period, an abbreviation like "San Pellegrino" for "S.Pellegrino" —
  still finds the right item, by scoring how closely each typed word
  matches a word in the item's name (allowing roughly a typo's worth
  of difference) and weighting longer, more distinctive words more
  than short filler ones, so "san pelligrino" still finds
  "S.PELLEGRINO Sparkling Natural Mineral Water" even though "san"
  itself doesn't match anything
- **Voice / quick-sentence entry**: tap the mic and say (or type) something
  like *"add two cans of black beans to the pantry"* or *"used the last of
  the milk"* — it's parsed into structured item(s) that you review and edit
  before anything is saved
- **Categorized by food type** (Produce, Dairy & Eggs, Meat & Seafood, Frozen,
  Bakery, Grains & Pasta, Canned Goods, Condiments & Sauces, Spices &
  Baking, Snacks, Beverages, Other) — guessed automatically from the item
  name, editable via a dropdown
- **Expiration dates**: optional, set manually or captured from voice/typed
  phrases like *"expires next Friday"* or *"best by 8/25"*, with "Expires
  today/tomorrow" and "Expired" badges (see below for how this affects
  list order). The Expiration date field only appears on the review
  card's **Add** side — using some of an item doesn't change when
  what's left expires, so it's hidden on **Use**
- "Low"/"Out" badges flag items that need restocking (see below for
  what counts as "low"), tailored per item rather than one flat number
  for everything
- **Barcode scanning**: tap 📷, point your phone's camera at a product
  barcode, and every field the lookup actually knows is filled in
  automatically, dropped into the same review flow as voice entry —
  name, category, and Location (guessed from the name, e.g. "milk" →
  Fridge, same as receipt scanning); quantity always starts at 1 (you
  scanned one item, not "500" of it); the package size (e.g. "500 ml")
  pre-fills the Weight/volume field; and Unit is guessed from the
  product's own packaging data when available (e.g. "glass jar" → Jar,
  "tetra pak" → Carton). Nothing here is invented when the barcode
  database doesn't actually have it — a field it has nothing for is
  left blank for you to fill in, same as manual entry, rather than
  forcing a guess. Every field is still editable before you confirm
- **Receipt scanning**: tap 🧾, take/choose a photo of a receipt, and it's
  OCR'd and parsed into a list of candidate items to review — a fast way to
  restock a whole grocery trip at once. A package size printed as part of
  the product title (e.g. "ELMHURST UNSWEETENED ALMOND MILK 32 FL OZ", or
  "OLIPOP ... (12 fl oz)") is pulled out automatically into the review
  card's Weight/volume field, the same way a barcode scan's package size
  does — a size in parentheses is preferred when there is one, so an
  early, similar-looking marketing callout ("9g Fiber") earlier in the
  name doesn't get mistaken for the actual package size later in it.
  Quantity is read from a leading count on the item's own line ("2 Black
  Beans") when present, or, on receipts that print it on its own line
  instead (common on digital order confirmations, e.g. "OLIPOP ... (12 fl
  oz)" followed by "4 x $2.79"), from that line right below it — either
  way, you shouldn't need to retype the name, size, or quantity a receipt
  already told you. Since on-device OCR can occasionally misread a
  digit (a common one: "1" read as "7"), a receipt-scanned Quantity of
  **6 or more** shows an amber double-check note right on the review
  card — not blocking anything, just a nudge to glance at that one
  number before confirming; it clears itself the moment you edit the
  quantity below that
- **Recipe ingredients deduct, not add**: using a recipe — via **Use this
  recipe** under Search Recipes, or **− Use Ingredients from Recipe**
  right on the − Use item panel (see below) — always lands as **Use**,
  never Add, since a recipe consumes inventory, the opposite of a receipt.
  Measurement-based ingredients (e.g. "200 g flour") deduct from a matched
  item's tracked weight/volume when available (converting compatible units
  — weight ↔ weight, volume ↔ volume — never guessing a cups-to-ounces
  conversion, which needs an ingredient-specific density); whole-count
  ingredients (e.g. "3 eggs") just decrement the item's count. The amount
  deducted is always what the recipe calls for, not what you happen to
  have — the app works out what's left
- **Recipes span three top-level buttons**, next to + Add item / − Use
  item, all sharing one recipe pool: a small bundled list
  (`public/recipes.json` — free and fully offline, same as everything
  else in this app, no API key or network call) merged with whatever
  you've saved yourself. A **⭐** before a recipe's name (wherever one
  shows up — search results, the saved-recipes list, the shopping-list
  selection) is the only thing that distinguishes yours from the
  bundled ones; matching and ranking treat them identically
  - **⭐ Save Recipes**: save a recipe of your own — a name, a meal-type
    category (Breakfast, Sandwiches & Wraps, Soups & Salads, Main
    Dishes, Sides & Snacks, Desserts & Baking, Beverages, or Other —
    picked from a dropdown, defaulting to Other if you don't change
    it) plus an ingredient list typed or pasted the same free-text way
    as "Enter recipe ingredients" used to work (parsed the same way,
    then just the name/quantity/unit kept; each ingredient's own
    storage location/category — pantry vs. fridge, produce vs. dairy —
    gets resolved fresh against whatever matches at suggestion time,
    not fixed when you save it, which is a separate thing from the
    recipe's own meal-type category). It's stored in the database (not
    the bundled recipes.json file). Below the save form, every
    available recipe — bundled and yours together — is browsable as a
    collapsible list grouped by that meal-type category (same
    collapsible-heading style as the main inventory list's "All"
    view); a **⭐** marks the ones you added, each with a **✕** to
    delete it (with a confirm, same as deleting an item elsewhere in
    the app) — bundled recipes have neither, since they can't be
    deleted
  - **🔍 Search Recipes**: two ways to find something —
    - Type a name and matching recipe names appear as you type (any
      recipe, any match percentage — a deliberate name lookup isn't a
      suggestion, so this bypasses the match bar below entirely).
      Tapping one shows its full card regardless of how much you have
      on hand
    - Below that, ranked suggestions from what you can actually make
      right now: a recipe only qualifies once **65% or more** of its
      ingredients are on hand; below that it's never shown, no matter
      how few recipes clear the bar (down to none, with a note saying
      so, rather than padding the list with something you're a third
      short on). Toggle between two ranking modes any time: **Best
      match** (the most complete matches first) or **Use up
      expiring/low** (weighted toward recipes that use ingredients
      that are expiring soon or already flagged Low, still only among
      65%+ matches). Only items with quantity above 0 count as
      "available" — Out items don't. With fewer than **20 items** in
      inventory, a hint appears above the results explaining that a
      wider variety makes it more likely something clears the 65% bar
      — recipe matching is naturally sparse against a small pantry, so
      this isn't presented as a bug

    Either way, each card lists every ingredient with a ✓ (have) or ✗
    (missing) mark and how much the recipe calls for. **A recipe can
    only be Used once every one of its ingredients is in stock** — no
    more partial deductions that quietly skip whatever's missing. Tap
    **Use this recipe** and one of two things happens:
    - **Everything's on hand** → it feeds every ingredient, at the
      amount the recipe calls for, into the same editable review-card
      flow as every other entry method: same "used 3, not how much is
      left" deduction, same Delete item button.
    - **Anything's missing** → instead of a partial Use, it adds the
      recipe straight to your **Create Shopping List** selection (the
      same thing "Add missing to shopping list" does) and takes you
      there — a toast says how many ingredients were missing. **Add
      missing to shopping list** still works as its own separate
      button too, for queuing a recipe's gaps without attempting to
      use it at all (toggles to **✓ Added — remove**; add as many
      recipes as you like, they accumulate).
    
    Ingredient matching uses a stricter version of the app's usual
    close-spelling matching (since nothing here gets a human glancing
    at it character by character the way typing a name does) — strict
    enough that "Bell Pepper" won't get silently matched to a jar of
    "Black Pepper" just because they share the word "pepper"
  - **− Use Ingredients from Recipe**: the same name-lookup-and-use
    flow as **Use this recipe** above, but reachable without leaving
    the − Use item panel — its own row below the main text/mic
    input, only shown in Use mode. Type a few letters (or tap 🎤 and
    say the name — fills the box, doesn't auto-submit) and matching
    recipe names appear as you type; tap one to fill in its exact
    name, or just type/say the full name yourself, then tap
    **Submit**. It looks up that recipe by exact name — any recipe,
    any match percentage, same as the name search above — and applies
    the exact same all-or-nothing rule: every ingredient in stock
    opens a real Use review at the recipe's own amounts; anything
    missing sends you to Create Shopping List with the recipe already
    added, instead of opening a partial review
  - **🛒 Create Shopping List**: builds one deduped, alphabetized list
    from three sources — missing ingredients from every recipe you
    added via "Add missing to shopping list," plus everything
    currently flagged Low or Out, plus everything expiring soon. Tap
    **Generate shopping list** to build it fresh from whatever's
    currently selected/flagged (nothing here is saved — recipes you
    picked are lost on reload, by design, so the list always reflects
    your inventory right now, not a stale snapshot). The result shows
    on screen in a plain-text box you can **📋 Copy to clipboard** and
    paste into a texting app, notes app, or anywhere else — this app
    doesn't send texts itself, since actually delivering an SMS needs a
    paid third-party service, which would break its free/fully-offline
    design
- **The main inventory list is entirely view-only**: each card shows
  just the item's name, a "Low"/"Out" flag if it's triggered, and its
  expiration badge — but only once expiration is within **2 weeks** (or
  already past), and never at all once the item is **Out**, since
  there's nothing left to expire; further out (or Out), the date isn't
  shown at all, keeping the card down to what actually needs attention
  right now. No location, category, unit, or amount-left details, and
  no quick add/use controls directly on the card
- **Tap a name to see its details, rename it, or delete it**: expands
  into a small detail view with the exact expiration date (e.g.
  "12/25/2026," not just a relative badge) and how much is actually
  left — a weight/volume reading (e.g. "30/32 fl oz"), a pack-size
  fraction, or a plain quantity+unit count, whichever applies to that
  item — plus an editable **item name** field with its own **Rename**
  button. The name is the only field correctable here; quantity, unit,
  location, category, and weight/volume are all set through + Add item
  / − Use item instead, never rewritten in place. A **Delete item**
  button removes the item entirely — its confirmation is explicit that
  this deletes the whole item, not just one unit of it, and can't be
  undone (the same button and wording also live on the − Use item
  review card, for deleting an item while you're already there). Tap
  the name again, or **Close**, to collapse the detail view back. A
  weight/volume reading always reflects deductions from every path that
  can change quantity, and clears itself the moment quantity moves away
  from 1, since a reading like "300/500 ml" stops meaning anything once
  there's no longer exactly one tracked container
- **Ordered by urgency within each category**: Out first, then expiring
  within 2 weeks, then Low, then everything else — the same tiers the
  badges themselves use, so the list never disagrees with what it's
  flagging as needing attention
- Filter by category (tap a tab: All, Produce, Dairy & Eggs, ...) and
  search by name
- In the **All** view, category sections start **collapsed** by default
  (e.g. "▸ Dairy & Eggs (2)") — tap a heading to expand it, tap again to
  collapse. Handy once you've got a lot of categories in play; expanded
  sections reset back to collapsed on a page reload. Searching
  auto-expands any section with a match, so a result never sits hidden
  behind a heading you haven't tapped — clearing the search reverts
  every section to however you last left it
- Responsive, large-tap-target layout designed for phone browsers
- Persistent storage via SQLite (survives server restarts)
- **⬇️ Export CSV / ⬆️ Import CSV** (below the search box): download your
  whole inventory as a spreadsheet, edit it anywhere, and upload it back
  — see below for exactly how the round trip works

## Getting started

```bash
npm install
npm start
```

The app runs at `http://localhost:3000` by default (set `PORT` to change it).

To use it from your phone on the same network, find your computer's LAN IP
(e.g. `192.168.1.23`) and visit `http://<that-ip>:3000` from your phone's
browser.

The first thing you'll see is a login/signup screen (see **Accounts**
below) — create an account with any email and an 8+ character password to
get started; there's no email verification step.

## Accounts

The app sits behind a login screen, and every item and recipe belongs to
whoever's signed in — sign up with anyone else (a family member, a
friend you shared the link with) and they get their own separate,
private inventory, not yours. There's no "household" or shared-inventory
concept; if two people want to see the same list, they currently need to
share one login.

- **Sign up** with any email address and a password (8+ characters
  minimum) — no email verification, no confirmation link, since this
  is a self-hosted personal tool, not a service sending you email.
- **Passwords are hashed** (bcrypt) before they're ever written to the
  database — the app never stores or logs your actual password.
- Signing in sets a secure, `httpOnly` session cookie (not a token
  you'll ever see or need to copy) that stays signed in for 30 days.
  **Log out** (top right, once signed in) ends that session
  immediately; if it's ever missing or expired, you're bounced back to
  the login screen instead of the app quietly failing.
- There's currently no "forgot password" flow — if you lose a
  password, someone with access to the server can reset it directly in
  the database (there's no UI for this yet).

## Data storage

Data is stored in `data/inventory.db` (created automatically on first run)
— accounts, sessions, and every item/recipe, all in one SQLite file. This
file is the source of truth for everyone's inventory — back it up if you
care about the data, and don't delete the `data/` directory unless you want
to start fresh (which deletes every account along with it, not just one).

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

Tap **+ Add item** to reveal **📷 Scan a barcode**, point your camera at a
product's barcode, and hold steady for a second. The result goes through the
same editable review card as voice entry — nothing saves until you confirm —
with the "Add"/"Use" toggle available on the card itself, so a scan can still
log using up an item, not just stocking one, even though the scan button
lives under + Add item.

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

Tap **+ Add item** to reveal **🧾 Scan a receipt**, which takes (or chooses) a
photo of a paper receipt, or **📸 Use this device's camera** for a live
in-browser capture instead. Each recognized product line becomes an editable
review card — same flow as voice and barcode entry, add-vs-use toggle
included, nothing saved until you confirm.

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

There's no separate "type or paste a recipe to use right now" flow
anymore — instead, the ingredient text box under **⭐ Save Recipes**
(type or paste a list) is where free-text ingredients get parsed, once,
into a stored recipe; **actually using** one against your inventory
happens by name lookup — either **Use this recipe** on a card under
**🔍 Search Recipes**, or **− Use Ingredients from Recipe** right on
the − Use item panel (see above for both). Both only actually open a
Use review once every one of the recipe's ingredients is in stock —
otherwise the recipe goes to your Create Shopping List selection
instead of a partial deduction. Once it does open, it feeds the
recipe's own stated ingredients and amounts straight into the same
review-card flow as voice/barcode/receipt entry, defaulting to **Use**
instead of Add, since a recipe consumes what's in your inventory
rather than restocking it. Switch any card to Add if one should go the
other way.

- **Line parsing** (`recipeParser.js`), used when you save a recipe,
  understands whole numbers,
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
- **Deducting**: whatever amount the recipe states (e.g. "200 g
  flour") is what gets deducted — the app works out what's left, never
  asking you to enter a remaining amount yourself. If the matched inventory item tracks
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

## CSV export/import

A full round trip between your inventory and any spreadsheet app —
Excel, Google Sheets, Numbers, whatever you have. Both live below the
search box on the home view.

- **⬇️ Export CSV** downloads a snapshot of your whole inventory as-is
  — every column the app tracks (name, quantity, unit, location,
  category, expiration date, pack size, weight/volume) plus a hidden
  `id` column that's how the app recognizes "this is the same item"
  when you upload it back, even if you've retyped its name slightly.
- Edit it however you like: fix quantities after a big shopping trip,
  correct an expiration date, add a new row for something you just
  bought — no app needed for any of that part.
- **⬆️ Import CSV** uploads the edited file back. Nothing saves
  immediately — first you get a review screen, the same "confirm
  before anything's written" pattern every other entry method in this
  app already uses, listing exactly what will happen:
  - A row with an **id** matching an existing item **updates** it —
    only if something on that row actually differs from what's
    currently stored, so re-importing an unedited export shows no
    changes at all.
  - A row with a **blank id** is a **new item**.
  - **The spreadsheet is treated as the complete picture, not a
    partial patch**: any item currently in your inventory that isn't
    in the file at all gets **deleted**. This is the one genuinely
    destructive part of the whole app that isn't a single explicit
    "delete this item" tap, so it gets its own clearly-marked section
    in the review (styled like the delete button elsewhere) and a
    second, explicit confirmation naming exactly what's about to be
    removed before anything is actually applied.
  - A row with a problem (a bad quantity, an id that no longer
    exists, no name at all) is skipped and listed separately — it's
    never applied, but **if it references an existing item, that
    item still counts as "missing from the file" and gets deleted
    unless you fix the row and re-upload**. Worth reading that
    section of the review closely for exactly this reason.
- The category column accepts the same ids used elsewhere in the app
  (`dairy_eggs`, `beverages`, ...) — an unrecognized or blank category
  falls back to guessing one from the name, the same as every other
  entry method.

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
3. **Pack size tracking** — set a "Pack size" (the count it started at,
   e.g. 24) on **+ Add item**'s review card, next to Weight/volume;
   it's flagged low once the remaining quantity drops to **25% or
   less** of that (6 or fewer left of a 24-pack). It's never guessed
   from a parsed quantity — adding "24 cans of X" doesn't by itself
   set a pack size of 24, since a quantity of 24 today doesn't mean
   every future restock is also 24. Restocking an already-tracked item
   without retyping it leaves the existing pack size untouched (same
   restock behavior as weight/volume above); typing a new one updates
   it. Hidden on − Use item, same as Weight/volume's total-size field —
   it's a property you set once when adding a pack, not something you
   touch when using from it.
4. **Canned food** (unit "can"/"cans" + category Canned Goods) — low at
   **2 or fewer** cans.
5. **Canned beverages** (unit "can"/"cans" + category Beverages) — low at
   **4 or fewer** cans.
6. **Bottled beverages** (unit "bottle"/"bottles" + category Beverages) —
   low at **fewer than 6** bottles. Beverages are also restricted to
   whole-bottle Use only (see below) — a bottle count is the one number
   that actually reflects what's left, so it's flagged low well before
   running out.
7. **Everything else** — the flat fallback: low at **1 or fewer**.

**Beverages can only be used a whole bottle/can at a time** — no
measured (weight/volume) deduction. On a beverage's − Use item review
card, the "Log a measured amount instead" option doesn't appear at all;
only a whole-number Quantity. This holds even for a beverage with a
tracked size (e.g. "12 fl oz" set on Add) — that size is still
recorded, it just can't be partially deducted from. Enforced on the
server too, not just hidden in the UI, so it applies no matter what
triggers the use (a recipe referencing a beverage by volume, for
instance, still decrements it a whole bottle at a time). Every other
category keeps the existing behavior — a single bottle of anything
else can still be used in measured amounts.

Pack size and weight/volume are optional and per-item — set them once on
an item you want tracked that way and they stick until you change or
clear them; every other item just uses whichever of rules 4-6 applies.
to full.

## API

| Method | Path                     | Description                             |
| ------ | ------------------------ | ---------------------------------------- |
| POST   | `/api/auth/signup`         | Create an account (email + 8+ char password), signs you in |
| POST   | `/api/auth/login`          | Sign in to an existing account          |
| POST   | `/api/auth/logout`         | End the current session                 |
| GET    | `/api/auth/me`              | Who's currently signed in (401 if no one) |
| GET    | `/api/categories`          | List valid food categories              |
| GET    | `/api/items`              | List the signed-in account's items (grouped by category, low-stock/expiring first) — **requires being signed in**, as do every other `/api/items*` and `/api/recipes*` route below |
| POST   | `/api/items`               | Add an item (merges into an existing matching item; category auto-guessed if omitted; expiration date kept as the sooner of the two on merge) |
| POST   | `/api/items/:id/adjust`    | Adjust quantity by a delta (+1 / -1)    |
| POST   | `/api/items/:id/use`       | Deduct a used amount+unit — converts into the item's tracked weight/volume when compatible, otherwise decrements quantity |
| PUT    | `/api/items/:id`           | Update an item's fields directly        |
| DELETE | `/api/items/:id`           | Remove an item                          |
| GET    | `/api/items/export.csv`    | Download the whole inventory as CSV (with an `id` column) |
| POST   | `/api/items/import/preview` | Parse+diff an uploaded CSV against current inventory (read-only — returns what would change) |
| POST   | `/api/items/import/commit` | Re-parses/re-diffs the same CSV and applies it: adds/updates matched rows, deletes anything missing from the file |
| POST   | `/api/voice/parse`         | Parse a sentence into structured item(s) (read-only — doesn't write to the DB) |
| GET    | `/api/barcode/:code`       | Look up a barcode via Open Food Facts (read-only) |
| POST   | `/api/receipt/parse`       | Parse OCR'd receipt text into candidate item(s) (read-only) |
| POST   | `/api/recipe/parse`        | Parse typed/OCR'd recipe ingredients into candidate item(s) to use (read-only) |
| GET    | `/api/recipes`             | List user-added recipes (name + ingredients) for Search Recipes |
| POST   | `/api/recipes`             | Save a new user recipe |
| DELETE | `/api/recipes/:id`         | Delete a user recipe |

## Roadmap

- [x] Voice entry ("add two cans of beans")
- [x] Food categories + low-stock/expiring-first sorting within each category
- [x] Expiration date capture (manual + voice/text phrases)
- [x] Barcode scanning
- [x] Receipt scanning / OCR import
- [x] Recipe ingredients (text or photo) deduct from inventory
- [x] Search recipes from what's currently in stock, save your own, and
      build a shopping list from what's missing
- [x] CSV export/import — full round trip through any spreadsheet app
- [x] Accounts — everyone who signs up gets their own private inventory
- [ ] Shared/household inventories (multiple accounts, one list)
- [ ] Password reset flow
