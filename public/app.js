(() => {
  const listEl = document.getElementById('item-list');
  const emptyStateEl = document.getElementById('empty-state');
  const statusLineEl = document.getElementById('status-line');
  const entryModeButtons = document.getElementById('entry-mode-buttons');
  // The category tabs, search box, and item list — only relevant on the
  // home view; every entry-mode panel (Add, Use, Save/Search Recipes,
  // Create Shopping List) hides it the same way it hides
  // entryModeButtons, and both come back together when a panel closes.
  const inventoryBrowserEl = document.getElementById('inventory-browser');
  const modeAddBtn = document.getElementById('mode-add-btn');
  const modeUseBtn = document.getElementById('mode-use-btn');
  const quickInputPanel = document.getElementById('quick-input-panel');
  const entryFormTitle = document.getElementById('entry-form-title');
  const entryCancelBtn = document.getElementById('entry-cancel-btn');
  const tabsEl = document.getElementById('category-tabs');
  const searchInput = document.getElementById('search');
  const toastEl = document.getElementById('toast');

  const importCsvBtn = document.getElementById('import-csv-btn');
  const importCsvInput = document.getElementById('import-csv-input');
  const importReviewModal = document.getElementById('import-review-modal');
  const importReviewSummary = document.getElementById('import-review-summary');
  const importReviewScroll = document.getElementById('import-review-scroll');
  const importConfirmBtn = document.getElementById('import-confirm-btn');
  const importCancelBtn = document.getElementById('import-cancel-btn');

  const voiceForm = document.getElementById('voice-form');
  const voiceTextInput = document.getElementById('voice-text');
  const micBtn = document.getElementById('mic-btn');
  const micHint = document.getElementById('mic-hint');
  const voiceReviewEl = document.getElementById('voice-review');
  const nameOptionsEl = document.getElementById('item-name-options');

  const useRecipeSectionEl = document.getElementById('use-recipe-section');
  const useRecipeInput = document.getElementById('use-recipe-input');
  const useRecipeMicBtn = document.getElementById('use-recipe-mic-btn');
  const useRecipeSubmitBtn = document.getElementById('use-recipe-submit-btn');
  const useRecipeMatchesEl = document.getElementById('use-recipe-matches');

  const barcodeBtn = document.getElementById('barcode-btn');
  const barcodeHint = document.getElementById('barcode-hint');
  const barcodeModal = document.getElementById('barcode-modal');
  const barcodeVideo = document.getElementById('barcode-video');
  const barcodeStatus = document.getElementById('barcode-status');
  const barcodeCancelBtn = document.getElementById('barcode-cancel');

  const receiptInput = document.getElementById('receipt-input');
  const receiptLabel = document.getElementById('receipt-label');
  const receiptCameraBtn = document.getElementById('receipt-camera-btn');
  const receiptStatus = document.getElementById('receipt-status');

  const photoCaptureModal = document.getElementById('photo-capture-modal');
  const photoCaptureVideo = document.getElementById('photo-capture-video');
  const photoCaptureCanvas = document.getElementById('photo-capture-canvas');
  const photoCaptureStatus = document.getElementById('photo-capture-status');
  const photoCaptureBtn = document.getElementById('photo-capture-btn');
  const photoCaptureCancelBtn = document.getElementById('photo-capture-cancel');

  const modeSaveRecipeBtn = document.getElementById('mode-save-recipe-btn');
  const saveRecipePanel = document.getElementById('save-recipe-panel');
  const saveRecipeCancelBtn = document.getElementById('save-recipe-cancel-btn');
  const newRecipeNameInput = document.getElementById('new-recipe-name');
  const newRecipeCategorySelect = document.getElementById('new-recipe-category');
  const newRecipeIngredientsInput = document.getElementById('new-recipe-ingredients');
  const addRecipeNote = document.getElementById('add-recipe-note');
  const saveRecipeBtn = document.getElementById('save-recipe-btn');
  const savedRecipesListEl = document.getElementById('saved-recipes-list');

  const modeSearchRecipeBtn = document.getElementById('mode-search-recipe-btn');
  const searchRecipePanel = document.getElementById('search-recipe-panel');
  const searchRecipeCancelBtn = document.getElementById('search-recipe-cancel-btn');
  const recipeSearchInput = document.getElementById('recipe-search-input');
  const recipeSearchMatchesEl = document.getElementById('recipe-search-matches');
  const searchRankMatchBtn = document.getElementById('search-rank-match');
  const searchRankUrgentBtn = document.getElementById('search-rank-urgent');
  const searchRecipeResultsEl = document.getElementById('search-recipe-results');

  const modeShoppingListBtn = document.getElementById('mode-shopping-list-btn');
  const shoppingListPanel = document.getElementById('shopping-list-panel');
  const shoppingListCancelBtn = document.getElementById('shopping-list-cancel-btn');
  const shoppingListSelectedRecipesEl = document.getElementById('shopping-list-selected-recipes');
  const generateShoppingListBtn = document.getElementById('generate-shopping-list-btn');
  const shoppingListOutputEl = document.getElementById('shopping-list-output');
  const shoppingListTextEl = document.getElementById('shopping-list-text');
  const copyShoppingListBtn = document.getElementById('copy-shopping-list-btn');
  const shoppingListCopyNote = document.getElementById('shopping-list-copy-note');

  let items = [];
  let categories = []; // [{id, label}], loaded from the server
  let categoryLabels = {};
  let activeCategory = 'all';
  let searchTerm = '';
  let toastTimer = null;
  let editingId = null; // id of the item currently expanded into its read-only detail view, if any
  const collapsedCategories = {}; // categoryId -> true if its section is collapsed in the "All" view
  let entryMode = null; // 'add' | 'use' | null (fields hidden until one is chosen)
  let recipesData = null; // loaded once from recipes.json, then cached
  let recipesLoadPromise = null;
  let searchRecipeRankMode = 'match'; // 'match' | 'urgent' — how the 3 suggestions are ranked

  // Low-stock rules, checked in priority order by getLowStockBadge() below:
  // an item's own pack-size/%-full tracking (if set) wins over the
  // canned-food/beverage defaults, which win over the flat fallback.
  const LOW_STOCK_THRESHOLD = 1; // fallback for anything not covered below
  const PACK_LOW_FRACTION = 0.25; // pack-tracked items: low at <=25% of the original pack left
  const BOTTLE_LOW_PERCENT = 50; // single-container items: low at <=50% full (i.e. half or more used)
  const CANNED_FOOD_LOW_QTY = 2; // canned food: low at 2 or fewer cans
  const CANNED_BEVERAGE_LOW_QTY = 4; // canned beverages: low at 4 or fewer cans
  const BOTTLED_BEVERAGE_LOW_QTY = 5; // bottled beverages: low at fewer than 6 bottles
  // An item expiring within this many days gets the amber "soon" badge.
  const EXPIRING_SOON_DAYS = 3;
  // The main list card only shows an expiration badge at all once it's
  // this close (or already past) — further out, it's not worth the
  // clutter on a card that's otherwise just name/low-stock flag.
  const EXPIRY_BADGE_VISIBLE_DAYS = 14;
  // A receipt-scanned quantity at or above this is flagged for a second
  // look — most single grocery line items run 1-4, and OCR occasionally
  // misreads one digit for another (a common one: "1" read as "7"),
  // silently turning a plausible-looking wrong number into what looks
  // like a normal purchase. Not enforced — just a nudge to check before
  // confirming, same "review before it's saved" spirit as everything
  // else a scan/parse produces.
  const SUSPICIOUS_RECEIPT_QTY = 6;

  // Returns 'Out', 'Low', or null (not low) for an item's low-stock badge.
  function getLowStockBadge(item) {
    if (item.quantity <= 0) return 'Out';

    // % full only applies while there's exactly one container to speak
    // of — with 2+ bottles, "how full is THE bottle" stops making sense.
    if (item.percentFull != null && item.quantity === 1) {
      if (item.percentFull <= 0) return 'Out';
      return item.percentFull <= BOTTLE_LOW_PERCENT ? 'Low' : null;
    }

    if (item.packSize != null && item.packSize > 0) {
      return item.quantity <= item.packSize * PACK_LOW_FRACTION ? 'Low' : null;
    }

    const unit = (item.unit || '').trim().toLowerCase();
    if (unit === 'can' || unit === 'cans') {
      if (item.category === 'canned_goods') return item.quantity <= CANNED_FOOD_LOW_QTY ? 'Low' : null;
      if (item.category === 'beverages') return item.quantity <= CANNED_BEVERAGE_LOW_QTY ? 'Low' : null;
    }
    // Beverages can only ever be used a whole bottle at a time (see
    // renderReview()'s beverage-only whole-unit restriction below), so
    // a bottle count is the one number that actually reflects what's
    // left — flagged low well before running out, since going through
    // 6 happens fast a bottle at a time.
    if ((unit === 'bottle' || unit === 'bottles') && item.category === 'beverages') {
      return item.quantity <= BOTTLED_BEVERAGE_LOW_QTY ? 'Low' : null;
    }

    return item.quantity <= LOW_STOCK_THRESHOLD ? 'Low' : null;
  }

  function daysUntil(dateStr) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [y, m, d] = dateStr.split('-').map(Number);
    const target = new Date(y, m - 1, d);
    return Math.round((target - today) / 86400000);
  }

  // Sort key for ordering items within a category: Out first, then
  // expiring soon (within the same window the list's expiration badge
  // itself uses), then Low, then everything else — the same tiers the
  // badges already show, just used to order the list too, so the two
  // never disagree about what counts as urgent.
  function itemSortPriority(item) {
    const lowLabel = getLowStockBadge(item);
    if (lowLabel === 'Out') return 0;
    if (item.expirationDate && daysUntil(item.expirationDate) <= EXPIRY_BADGE_VISIBLE_DAYS) return 1;
    if (lowLabel === 'Low') return 2;
    return 3;
  }

  function formatExpiration(dateStr) {
    const days = daysUntil(dateStr);
    let className = 'expiry-ok';
    let text;
    if (days < 0) {
      className = 'expiry-expired';
      text = days === -1 ? 'Expired yesterday' : `Expired ${-days}d ago`;
    } else if (days === 0) {
      className = 'expiry-soon';
      text = 'Expires today';
    } else if (days === 1) {
      className = 'expiry-soon';
      text = 'Expires tomorrow';
    } else if (days <= EXPIRING_SOON_DAYS) {
      className = 'expiry-soon';
      text = `Expires in ${days}d`;
    } else {
      const [, m, d] = dateStr.split('-').map(Number);
      text = `Exp ${m}/${d}`;
    }
    return { text, className };
  }

  async function loadCategories() {
    try {
      categories = await api('/api/categories');
      categoryLabels = Object.fromEntries(categories.map((c) => [c.id, c.label]));
      for (const cat of categories) {
        const tabBtn = document.createElement('button');
        tabBtn.type = 'button';
        tabBtn.className = 'tab';
        tabBtn.dataset.category = cat.id;
        tabBtn.textContent = cat.label;
        tabsEl.appendChild(tabBtn);

        // Category sections in the "All" view start collapsed; tapping a
        // heading expands it.
        collapsedCategories[cat.id] = true;
      }
    } catch (err) {
      // Non-fatal: category dropdown/tabs just stay at "Auto"/"All" if this fails.
      console.error('Failed to load categories', err);
    }
  }

  function formatQty(qty) {
    // Trim trailing zeros for whole numbers but keep decimals like 1.5
    return Number.isInteger(qty) ? String(qty) : String(Math.round(qty * 100) / 100);
  }

  // Shared dropdown option lists — the same choices wherever an item's
  // unit or weight/volume unit is picked (the review card and the
  // inline edit form), so every card looks and behaves the same way.
  const UNIT_OPTIONS = [
    ['', 'Unit'], ['bottle', 'Bottle'], ['box', 'Box'], ['piece', 'Piece'],
    ['can', 'Can'], ['bag', 'Bag'], ['jar', 'Jar'], ['package', 'Package'],
    ['carton', 'Carton'], ['stick', 'Stick'], ['bunch', 'Bunch'],
  ];
  const WEIGHT_VOLUME_UNIT_OPTIONS = [
    ['', 'Unit'], ['oz', 'oz'], ['fl oz', 'fl oz'], ['lb', 'lb'], ['kg', 'kg'],
    ['g', 'g'], ['ml', 'ml'], ['L', 'L'], ['cup', 'cup'], ['tbsp', 'tbsp'], ['tsp', 'tsp'],
  ];
  // For labeling "Weight/volume per <unit>" — e.g. picking Bottle as the
  // Unit makes the Weight/volume field read "per bottle," so it's never
  // mistaken for a grand total across every bottle in stock.
  const UNIT_LABELS = Object.fromEntries(UNIT_OPTIONS);

  // Builds a <select> from one of the option lists above, pre-selecting
  // `currentValue`. A value that isn't one of the listed options (e.g.
  // "cans" saved from an older receipt/voice entry) still shows up as
  // its own selected option, rather than being silently dropped.
  function buildDropdown(options, currentValue, ariaLabel) {
    const select = document.createElement('select');
    select.setAttribute('aria-label', ariaLabel);
    options.forEach(([value, label]) => {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = label;
      if (value === (currentValue || '')) opt.selected = true;
      select.appendChild(opt);
    });
    if (currentValue && !options.some(([v]) => v === currentValue)) {
      const opt = document.createElement('option');
      opt.value = currentValue;
      opt.textContent = currentValue;
      opt.selected = true;
      select.appendChild(opt);
    }
    return select;
  }
  function buildUnitSelect(currentValue) {
    return buildDropdown(UNIT_OPTIONS, currentValue, 'Unit');
  }
  function buildWeightVolumeUnitSelect(currentValue, ariaLabel) {
    return buildDropdown(WEIGHT_VOLUME_UNIT_OPTIONS, currentValue, ariaLabel);
  }

  // Sets a <select>'s value after the fact (e.g. auto-filling from a
  // matched item) — adding a fallback option first if the value isn't
  // one of the dropdown's own choices, same as buildDropdown does at
  // construction time, so nothing is silently dropped.
  function setDropdownValue(selectEl, value) {
    if (!value) return;
    if (![...selectEl.options].some((o) => o.value === value)) {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = value;
      selectEl.appendChild(opt);
    }
    selectEl.value = value;
  }

  // The quick-input methods stay out of the way until a mode is picked.
  // Add reveals text/mic/submit, barcode scanning, and receipt scanning
  // — all ways of bringing a new product into inventory. Use reveals
  // just text/mic/submit plus "Use Ingredients from Recipe": finding an
  // item to use is what the item-name suggestion list (see
  // updateItemNameOptions()) is for, not a fresh scan — scanning a
  // barcode or receipt would only ever describe a product you're
  // adding, never one you're using up.
  // Every method funnels into the same editable review card, which is
  // the only "entry form" in the app — see renderReview().
  function openEntryForm(mode) {
    entryMode = mode;
    const isAdd = mode === 'add';
    entryModeButtons.classList.add('hidden');
    inventoryBrowserEl.classList.add('hidden');
    quickInputPanel.classList.remove('hidden');
    barcodeBtn.classList.toggle('hidden', !isAdd || !hasCamera || !hasZXing);
    barcodeHint.classList.toggle('hidden', !isAdd || (hasCamera && hasZXing));
    receiptLabel.classList.toggle('hidden', !isAdd);
    receiptCameraBtn.classList.toggle('hidden', !isAdd || !hasCamera || !hasTesseract);
    useRecipeSectionEl.classList.toggle('hidden', isAdd);
    if (!isAdd) {
      useRecipeInput.value = '';
      useRecipeMatchesEl.classList.add('hidden');
      useRecipeMatchesEl.innerHTML = '';
      loadRecipesData().catch(() => {}); // pre-warm so typing/Submit doesn't have to wait
    }
    entryFormTitle.textContent = isAdd ? '+ Add item' : '− Use item';
    voiceTextInput.focus();
  }

  function closeEntryForm() {
    entryMode = null;
    quickInputPanel.classList.add('hidden');
    entryModeButtons.classList.remove('hidden');
    inventoryBrowserEl.classList.remove('hidden');
  }

  modeAddBtn.addEventListener('click', () => openEntryForm('add'));
  modeUseBtn.addEventListener('click', () => openEntryForm('use'));
  entryCancelBtn.addEventListener('click', closeEntryForm);

  function showToast(message) {
    toastEl.textContent = message;
    toastEl.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.add('hidden'), 1800);
  }

  async function api(path, options) {
    const res = await fetch(path, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Request failed (${res.status})`);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  async function loadItems() {
    statusLineEl.textContent = 'Loading…';
    statusLineEl.classList.remove('hidden');
    try {
      items = await api('/api/items');
      statusLineEl.classList.add('hidden');
      render();
    } catch (err) {
      statusLineEl.textContent = `Couldn't load inventory: ${err.message}`;
      statusLineEl.classList.remove('hidden');
    }
  }

  // Keeps the review card's item-name suggestion list in sync with
  // what's actually in inventory, so typing a few letters of
  // "S. Pellegrino" offers the exact stored name to pick — avoiding the
  // mismatched-name errors that come from retyping it slightly
  // differently (punctuation, spacing, a typo) each time, especially
  // for Use item where an exact match is what makes deduction work.
  function updateItemNameOptions() {
    const seen = new Set();
    const names = [];
    for (const item of items) {
      const key = item.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      names.push(item.name);
    }
    names.sort((a, b) => a.localeCompare(b));
    nameOptionsEl.textContent = '';
    for (const n of names) {
      const option = document.createElement('option');
      option.value = n;
      nameOptionsEl.appendChild(option);
    }
  }

  function render() {
    updateItemNameOptions();
    const filtered = items.filter((item) => {
      const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
      const matchesSearch = !searchTerm || item.name.toLowerCase().includes(searchTerm);
      return matchesCategory && matchesSearch;
    });

    listEl.innerHTML = '';

    if (filtered.length === 0) {
      emptyStateEl.classList.remove('hidden');
      emptyStateEl.textContent = items.length === 0
        ? 'Nothing here yet. Add your first item above.'
        : 'No items match your filters.';
      return;
    }
    emptyStateEl.classList.add('hidden');

    // When a single category tab is already active, every item is that
    // category, so a heading would just repeat the tab you clicked —
    // render the flat list with no grouping/collapsing. Still sorted by
    // urgency (see itemSortPriority()).
    if (activeCategory !== 'all') {
      const sorted = [...filtered].sort((a, b) => itemSortPriority(a) - itemSortPriority(b));
      for (const item of sorted) {
        listEl.appendChild(item.id === editingId ? renderItemDetail(item) : renderItem(item));
      }
      return;
    }

    // "All" view: group by category, with a clickable, collapsible
    // heading per group so a long category list can be tucked away
    // without leaving the "All" view. Within each group, sorted by
    // urgency: Out, then expiring soon, then Low, then everything else
    // (a stable sort, so same-priority items keep the server's own
    // secondary ordering — soonest expiration, then lowest quantity).
    const groups = new Map();
    for (const item of filtered) {
      if (!groups.has(item.category)) groups.set(item.category, []);
      groups.get(item.category).push(item);
    }
    for (const groupItems of groups.values()) {
      groupItems.sort((a, b) => itemSortPriority(a) - itemSortPriority(b));
    }

    for (const [category, groupItems] of groups) {
      // A search in progress auto-expands every group with a match —
      // otherwise a result sits behind a collapsed heading with no hint
      // it's there (groups start collapsed by default; see
      // loadCategories()). This doesn't touch the stored collapse state,
      // so clearing the search reverts every group to however the user
      // last left it.
      const collapsed = !!collapsedCategories[category] && !searchTerm;

      const headingLi = document.createElement('li');
      headingLi.className = 'category-heading-row';
      const headingBtn = document.createElement('button');
      headingBtn.type = 'button';
      headingBtn.className = 'category-heading';
      const arrow = document.createElement('span');
      arrow.className = 'category-heading-arrow';
      arrow.textContent = collapsed ? '▸' : '▾';
      const label = document.createElement('span');
      label.textContent = `${categoryLabels[category] || 'Other'} (${groupItems.length})`;
      headingBtn.appendChild(arrow);
      headingBtn.appendChild(label);
      headingBtn.addEventListener('click', () => {
        collapsedCategories[category] = !collapsed;
        render();
      });
      headingLi.appendChild(headingBtn);
      listEl.appendChild(headingLi);

      if (!collapsed) {
        for (const item of groupItems) {
          listEl.appendChild(item.id === editingId ? renderItemDetail(item) : renderItem(item));
        }
      }
    }
  }

  function renderItem(item) {
    const li = document.createElement('li');
    li.className = 'item-card';
    li.dataset.id = item.id;

    const info = document.createElement('div');
    info.className = 'item-info';

    const nameEl = document.createElement('button');
    nameEl.type = 'button';
    nameEl.className = 'item-name item-name-btn';
    nameEl.textContent = item.name;
    nameEl.setAttribute('aria-label', `Show details for ${item.name}`);
    nameEl.addEventListener('click', () => {
      editingId = item.id;
      render();
    });

    // View-only glance card: name, expiration, and a low-stock flag if
    // triggered — nothing else. No quantity/location/category/unit/
    // amount and no quick add/use controls; tap the name to open the
    // read-only detail view (renderItemDetail()) for the rest, plus
    // renaming and deleting the item entirely.
    const metaEl = document.createElement('div');
    metaEl.className = 'item-meta';
    const lowLabel = getLowStockBadge(item);
    if (lowLabel) {
      const lowBadge = document.createElement('span');
      lowBadge.className = 'low-stock-badge';
      lowBadge.textContent = lowLabel;
      metaEl.appendChild(lowBadge);
    }
    // No expiration badge once an item is Out — there's nothing left to
    // expire, so the date isn't useful information at that point.
    if (
      lowLabel !== 'Out' &&
      item.expirationDate &&
      daysUntil(item.expirationDate) <= EXPIRY_BADGE_VISIBLE_DAYS
    ) {
      const { text, className } = formatExpiration(item.expirationDate);
      const expBadge = document.createElement('span');
      expBadge.className = `expiry-badge ${className}`;
      expBadge.textContent = text;
      metaEl.appendChild(expBadge);
    }

    info.appendChild(nameEl);
    info.appendChild(metaEl);

    li.appendChild(info);
    return li;
  }

  // Inline edit form shown in place of an item card when its name is
  // tapped. Same fields as the Add form, pre-filled with the item's
  // current values. Nothing is saved until Save is pressed.
  // Full "M/D/YYYY" rendering of an ISO date — the detail view below
  // shows the exact date, not the relative "Exp 3/16"-style badge text.
  function formatFullDate(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return `${m}/${d}/${y}`;
  }

  // Same three-way "what's actually left" logic the list card itself
  // used before it went view-only: a tracked weight/volume reading, a
  // pack-size fraction, or a plain quantity+unit count — whichever
  // applies to this item.
  function describeAmountRemaining(item) {
    const unitSuffix = item.unit ? ` ${item.unit}` : '';
    if (item.fullnessAmount != null && item.fullnessTotal != null) {
      const fullnessSuffix = item.fullnessUnit ? ` ${item.fullnessUnit}` : '';
      return `${formatQty(item.fullnessAmount)}/${formatQty(item.fullnessTotal)}${fullnessSuffix}`;
    }
    if (item.packSize != null && item.packSize > 0) {
      return `${formatQty(item.quantity)}/${formatQty(item.packSize)}${unitSuffix}`;
    }
    return `${formatQty(item.quantity)}${unitSuffix}`;
  }

  // Tapping an item's name opens this read-only detail view, not an
  // edit form — the main list is a lookup surface, not a place to
  // rewrite an item's record. It shows exactly the two facts the card
  // itself doesn't have room for: the exact expiration date, and how
  // much is actually left (as a unit count and/or weight/volume
  // reading). Tap the name again, or Close, to collapse it back.
  function renderItemDetail(item) {
    const li = document.createElement('li');
    li.className = 'item-card item-detail-card';
    li.dataset.id = item.id;

    // The name is the one thing directly editable here — everything
    // else (quantity, unit, location, category, weight/volume) is set
    // through + Add item / − Use item, not rewritten in place.
    const nameRow = document.createElement('div');
    nameRow.className = 'field-row two-up';
    const nameInputEl = document.createElement('input');
    nameInputEl.type = 'text';
    nameInputEl.value = item.name;
    nameInputEl.setAttribute('aria-label', 'Item name');
    const renameBtn = document.createElement('button');
    renameBtn.type = 'button';
    renameBtn.className = 'btn btn-secondary';
    renameBtn.textContent = 'Rename';
    nameRow.appendChild(nameInputEl);
    nameRow.appendChild(renameBtn);
    li.appendChild(nameRow);

    const note = document.createElement('p');
    note.className = 'review-note hidden';

    renameBtn.addEventListener('click', async () => {
      const newName = nameInputEl.value.trim();
      note.classList.add('hidden');
      if (!newName) {
        note.textContent = 'Item name is required.';
        note.classList.remove('hidden');
        return;
      }
      if (newName === item.name) return;
      renameBtn.disabled = true;
      try {
        const updated = await api(`/api/items/${item.id}`, {
          method: 'PUT',
          body: JSON.stringify({ name: newName }),
        });
        const idx = items.findIndex((i) => i.id === updated.id);
        if (idx !== -1) items[idx] = updated;
        render(); // stays expanded — editingId is unchanged
        showToast(`Renamed to ${updated.name}`);
      } catch (err) {
        note.textContent = err.message;
        note.classList.remove('hidden');
      } finally {
        renameBtn.disabled = false;
      }
    });

    const rows = document.createElement('div');
    rows.className = 'item-detail-rows';

    const expRow = document.createElement('p');
    expRow.className = 'item-detail-row';
    const expLabel = document.createElement('span');
    expLabel.className = 'field-label';
    expLabel.textContent = 'Expiration date';
    const expValue = document.createElement('span');
    expValue.textContent = item.expirationDate ? formatFullDate(item.expirationDate) : 'Not set';
    expRow.appendChild(expLabel);
    expRow.appendChild(expValue);

    const amountRow = document.createElement('p');
    amountRow.className = 'item-detail-row';
    const amountLabel = document.createElement('span');
    amountLabel.className = 'field-label';
    amountLabel.textContent = 'Amount remaining';
    const amountValue = document.createElement('span');
    amountValue.textContent = describeAmountRemaining(item);
    amountRow.appendChild(amountLabel);
    amountRow.appendChild(amountValue);

    rows.appendChild(expRow);
    rows.appendChild(amountRow);
    li.appendChild(rows);
    li.appendChild(note);

    const buttons = document.createElement('div');
    buttons.className = 'review-card-buttons';
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'btn btn-secondary';
    closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', () => {
      editingId = null;
      render();
    });
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn btn-danger';
    deleteBtn.textContent = 'Delete item';
    // deleteItem()'s own confirm() dialog spells out that this removes
    // the item entirely, not one unit of it — same wording wherever
    // deletion happens (also the − Use item review card's Delete item).
    deleteBtn.addEventListener('click', async () => {
      const deleted = await deleteItem(item.id, item.name);
      if (deleted) editingId = null;
    });
    buttons.appendChild(closeBtn);
    buttons.appendChild(deleteBtn);
    li.appendChild(buttons);

    return li;
  }

  // Returns true if the item was actually deleted, false if the user
  // backed out of the confirm dialog or the request failed — callers
  // that do follow-up work (e.g. dismissing a review card) check this
  // rather than assuming deletion always went through.
  async function deleteItem(id, name) {
    if (!confirm(`Delete "${name}" completely from your inventory? This removes the whole item — not just one unit of it — and can't be undone.`)) {
      return false;
    }
    const prevItems = items;
    items = items.filter((i) => i.id !== id);
    render();
    try {
      await api(`/api/items/${id}`, { method: 'DELETE' });
      showToast(`Removed ${name}`);
      return true;
    } catch (err) {
      items = prevItems;
      render();
      showToast(`Couldn't remove: ${err.message}`);
      return false;
    }
  }

  function setActiveCategory(category) {
    activeCategory = category;
    [...tabsEl.children].forEach((c) => c.classList.toggle('active', c.dataset.category === category));
    render();
  }

  tabsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab');
    if (!btn) return;
    setActiveCategory(btn.dataset.category);
  });

  searchInput.addEventListener('input', () => {
    searchTerm = searchInput.value.trim().toLowerCase();
    render();
  });

  // --- Voice / quick-sentence entry -----------------------------------
  //
  // Flow: capture a sentence (typed, or spoken via the browser's built-in
  // Web Speech API — free, no server key needed) -> send it to the server
  // for free, rule-based parsing into structured items -> show an
  // editable review card per item -> user confirms each one, which then
  // goes through the normal add/adjust endpoints. Nothing is written to
  // the database until the user confirms.

  const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;

  if (SpeechRecognitionCtor) {
    micBtn.classList.remove('hidden');
    recognition = new SpeechRecognitionCtor();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.addEventListener('start', () => {
      micBtn.classList.add('listening');
    });
    recognition.addEventListener('end', () => {
      micBtn.classList.remove('listening');
    });
    recognition.addEventListener('error', (e) => {
      micBtn.classList.remove('listening');
      if (e.error !== 'aborted' && e.error !== 'no-speech') {
        showToast(`Mic error: ${e.error}`);
      }
    });
    recognition.addEventListener('result', (e) => {
      const transcript = e.results[0][0].transcript;
      voiceTextInput.value = transcript;
      parseVoiceText(transcript);
    });

    micBtn.addEventListener('click', () => {
      if (micBtn.classList.contains('listening')) {
        recognition.stop();
      } else {
        voiceTextInput.value = '';
        recognition.start();
      }
    });
  } else {
    micHint.classList.remove('hidden');
  }

  // --- Use Ingredients from Recipe (Use item only) -----------------------
  //
  // A quick way to load a recipe's ingredients without leaving − Use item
  // for Search Recipes: type a few letters or say the name, pick it from
  // the live matches (or just leave the exact name typed/spoken), then
  // Submit — reuses tryUseRecipe(), the same all-ingredients-in-stock
  // rule (missing anything routes to the shopping list instead) Search
  // Recipes' "Use this recipe" uses. Bypasses the 65% match bar
  // entirely, same as Search Recipes' own name search — a deliberate
  // name lookup isn't a suggestion.

  function findRecipeByExactName(name) {
    if (!recipesData) return null;
    const normalized = name.trim().toLowerCase();
    if (!normalized) return null;
    return recipesData.find((r) => r.name.toLowerCase() === normalized) || null;
  }

  function renderUseRecipeMatches() {
    const term = useRecipeInput.value.trim().toLowerCase();
    useRecipeMatchesEl.innerHTML = '';
    if (!term || !recipesData) {
      useRecipeMatchesEl.classList.add('hidden');
      return;
    }
    const matches = recipesData.filter((r) => r.name.toLowerCase().includes(term)).slice(0, 8);
    if (matches.length === 0) {
      useRecipeMatchesEl.classList.add('hidden');
      return;
    }
    useRecipeMatchesEl.classList.remove('hidden');
    for (const recipe of matches) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'recipe-search-match-btn';
      btn.textContent = recipe.source === 'user' ? `⭐ ${recipe.name}` : recipe.name;
      btn.addEventListener('click', () => {
        useRecipeInput.value = recipe.name;
        useRecipeMatchesEl.classList.add('hidden');
        useRecipeMatchesEl.innerHTML = '';
      });
      useRecipeMatchesEl.appendChild(btn);
    }
  }

  useRecipeInput.addEventListener('input', renderUseRecipeMatches);

  async function submitUseRecipe() {
    const name = useRecipeInput.value.trim();
    if (!name) {
      showToast('Type or say a recipe name first.');
      return;
    }
    if (!recipesData) {
      await loadRecipesData().catch(() => {});
    }
    const recipe = findRecipeByExactName(name);
    if (!recipe) {
      showToast("Couldn't find a recipe by that name — pick one from the list as you type.");
      return;
    }
    // tryUseRecipe() closes this panel either way and navigates to
    // wherever it decides — the Use item review (which resets this
    // search box itself via openEntryForm) if every ingredient is in
    // stock, Create Shopping List otherwise.
    tryUseRecipe(recipe, closeEntryForm);
  }

  useRecipeSubmitBtn.addEventListener('click', submitUseRecipe);

  let useRecipeRecognition = null;
  if (SpeechRecognitionCtor) {
    useRecipeMicBtn.classList.remove('hidden');
    useRecipeRecognition = new SpeechRecognitionCtor();
    useRecipeRecognition.lang = 'en-US';
    useRecipeRecognition.interimResults = false;
    useRecipeRecognition.maxAlternatives = 1;

    useRecipeRecognition.addEventListener('start', () => {
      useRecipeMicBtn.classList.add('listening');
    });
    useRecipeRecognition.addEventListener('end', () => {
      useRecipeMicBtn.classList.remove('listening');
    });
    useRecipeRecognition.addEventListener('error', (e) => {
      useRecipeMicBtn.classList.remove('listening');
      if (e.error !== 'aborted' && e.error !== 'no-speech') {
        showToast(`Mic error: ${e.error}`);
      }
    });
    useRecipeRecognition.addEventListener('result', (e) => {
      // Fills the box and refreshes matches, same as typing — Submit is
      // still a separate, explicit step, not an auto-confirm.
      const transcript = e.results[0][0].transcript;
      useRecipeInput.value = transcript;
      renderUseRecipeMatches();
    });

    useRecipeMicBtn.addEventListener('click', () => {
      if (useRecipeMicBtn.classList.contains('listening')) {
        useRecipeRecognition.stop();
      } else {
        useRecipeInput.value = '';
        useRecipeRecognition.start();
      }
    });
  }

  // --- Barcode scanning -------------------------------------------------
  //
  // Camera decoding runs entirely on-device via ZXing (vendored locally,
  // no CDN dependency) — no image is ever uploaded anywhere. Once a
  // barcode is decoded, the server looks it up against Open Food Facts
  // (a free, keyless public product database) and the result goes through
  // the same review-card flow as voice entry, so nothing is saved until
  // the user confirms.

  const hasCamera = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  const hasZXing = typeof window.ZXing !== 'undefined';
  let codeReader = null;

  if (hasCamera && hasZXing) {
    barcodeBtn.classList.remove('hidden');
  } else {
    barcodeHint.classList.remove('hidden');
  }

  function stopScanning() {
    if (codeReader) {
      try {
        codeReader.reset();
      } catch (err) {
        // ignore — reader may already be stopped
      }
    }
    barcodeModal.classList.add('hidden');
  }

  barcodeBtn.addEventListener('click', async () => {
    barcodeModal.classList.remove('hidden');
    barcodeStatus.textContent = 'Point your camera at a barcode…';
    codeReader = new window.ZXing.BrowserMultiFormatReader();
    try {
      await codeReader.decodeFromConstraints(
        { video: { facingMode: 'environment' } },
        barcodeVideo,
        (result) => {
          if (result) {
            const code = result.getText();
            stopScanning();
            handleBarcodeResult(code);
          }
          // Per-frame "not found" errors are expected while scanning and
          // are intentionally ignored — decodeFromConstraints calls this
          // callback continuously until reset().
        }
      );
    } catch (err) {
      stopScanning();
      showToast(`Camera error: ${err.message}`);
    }
  });

  barcodeCancelBtn.addEventListener('click', stopScanning);

  async function handleBarcodeResult(code) {
    voiceReviewEl.classList.remove('hidden');
    try {
      const product = await api(`/api/barcode/${encodeURIComponent(code)}`);
      renderReview([
        {
          name: product.name,
          quantity: product.quantity,
          unit: product.unit,
          location: product.location,
          category: product.category,
          action: 'add',
          expirationDate: null,
          fullnessUnit: product.fullnessUnit,
          fullnessAmount: product.fullnessAmount,
          fullnessTotal: product.fullnessTotal,
        },
      ]);
      showToast(`Found: ${product.name}`);
    } catch (err) {
      showToast(err.message);
      // Still let the user add it manually — pre-fill an empty review card.
      renderReview([
        {
          name: '',
          quantity: 1,
          unit: '',
          location: 'pantry',
          category: 'other',
          action: 'add',
          expirationDate: null,
        },
      ]);
    }
  }

  // --- Receipt scanning ---------------------------------------------------
  //
  // Two ways to get a photo in: the device's native camera/photo picker
  // (a plain file input — on a phone, this opens the camera directly; on
  // desktop it's just a file browser with no camera option), or a live
  // in-browser camera capture (below) for devices — desktops with a
  // webcam, mainly — where the native picker doesn't offer one. Either
  // way, OCR runs entirely on-device via Tesseract.js, fully vendored
  // locally (engine + English language data) so it works offline after
  // the page has loaded and nothing is uploaded anywhere. The recognized
  // text is sent to the server for free, rule-based line parsing, then
  // goes through the same review-card flow as voice and barcode entry.

  const hasTesseract = typeof window.Tesseract !== 'undefined';
  if (!hasTesseract) {
    receiptInput.disabled = true;
  }

  // Shared by receipt scanning and recipe-photo entry: runs on-device OCR
  // over an image file and returns the recognized text. `statusEl` gets
  // live progress text; the caller is responsible for hiding it after.
  async function runOcr(file, statusEl) {
    if (!hasTesseract) throw new Error('Photo scanning is not available in this browser.');
    statusEl.classList.remove('hidden');
    statusEl.textContent = 'Reading photo… this can take a few seconds.';
    let worker = null;
    try {
      worker = await window.Tesseract.createWorker('eng', window.Tesseract.OEM.LSTM_ONLY, {
        workerPath: 'vendor/tesseract/worker.min.js',
        corePath: 'vendor/tesseract/tesseract-core-lstm.wasm.js',
        langPath: 'vendor/tesseract',
        gzip: true,
        logger: (m) => {
          if (m.status && typeof m.progress === 'number') {
            statusEl.textContent = `${m.status}… ${Math.round(m.progress * 100)}%`;
          }
        },
      });
      const { data } = await worker.recognize(file);
      return data.text;
    } finally {
      if (worker) {
        try {
          await worker.terminate();
        } catch (err) {
          // ignore — worker may already be gone
        }
      }
    }
  }

  // Live in-browser camera capture, shared by receipt and recipe photo
  // entry — an alternative to the native camera/file picker for whenever
  // that doesn't offer a live camera option at all (chiefly desktop
  // browsers with a webcam; also works on mobile). Resolves with a
  // captured JPEG Blob, or null if the user cancels or the camera fails.
  function captureFromCamera(statusText) {
    return new Promise((resolve) => {
      let stream = null;
      let settled = false;

      function onCapture() {
        const { videoWidth, videoHeight } = photoCaptureVideo;
        photoCaptureCanvas.width = videoWidth;
        photoCaptureCanvas.height = videoHeight;
        photoCaptureCanvas.getContext('2d').drawImage(photoCaptureVideo, 0, 0, videoWidth, videoHeight);
        photoCaptureCanvas.toBlob((blob) => finish(blob), 'image/jpeg', 0.92);
      }

      function onCancel() {
        finish(null);
      }

      function finish(result) {
        if (settled) return;
        settled = true;
        if (stream) stream.getTracks().forEach((t) => t.stop());
        photoCaptureVideo.srcObject = null;
        photoCaptureModal.classList.add('hidden');
        photoCaptureBtn.removeEventListener('click', onCapture);
        photoCaptureCancelBtn.removeEventListener('click', onCancel);
        resolve(result);
      }

      photoCaptureBtn.addEventListener('click', onCapture);
      photoCaptureCancelBtn.addEventListener('click', onCancel);

      photoCaptureModal.classList.remove('hidden');
      photoCaptureStatus.textContent = statusText;

      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: 'environment' } })
        .then((s) => {
          stream = s;
          photoCaptureVideo.srcObject = stream;
          return photoCaptureVideo.play();
        })
        .catch((err) => {
          showToast(`Camera error: ${err.message}`);
          finish(null);
        });
    });
  }

  async function processReceiptFile(file) {
    if (!file) return;
    try {
      const text = await runOcr(file, receiptStatus);
      receiptStatus.textContent = 'Finding items…';
      const result = await api('/api/receipt/parse', {
        method: 'POST',
        body: JSON.stringify({ text }),
      });

      voiceReviewEl.classList.remove('hidden');
      renderReview(result.items);
      showToast(`Found ${result.items.length} item${result.items.length === 1 ? '' : 's'} on the receipt`);
    } catch (err) {
      showToast(`Couldn't read that receipt: ${err.message}`);
    } finally {
      receiptStatus.classList.add('hidden');
    }
  }

  receiptInput.addEventListener('change', async () => {
    const file = receiptInput.files && receiptInput.files[0];
    if (!file) return;
    await processReceiptFile(file);
    receiptInput.value = ''; // allow re-selecting the same file
  });

  if (hasCamera && hasTesseract) {
    receiptCameraBtn.classList.remove('hidden');
  }
  receiptCameraBtn.addEventListener('click', async () => {
    const blob = await captureFromCamera('Line up the receipt, then tap Capture');
    if (blob) await processReceiptFile(blob);
  });

  // Recipes span three top-level modes, separate from + Add item /
  // − Use item: Save Recipes (add your own), Search Recipes (find what
  // you can make, browse any by name), Create Shopping List (assemble
  // what's missing). All three share one recipe pool — the bundled
  // dataset (public/recipes.json — free, offline, no API key, same
  // philosophy as the rest of this app's parsing) merged with whatever
  // the user has added themselves (recipes table via the API), tagged
  // source: 'bundled' | 'user' and distinguished only by a ⭐ on the
  // card (see renderRecipeSuggestionCard()). Fetched once and cached.
  function loadRecipesData() {
    if (recipesData) return Promise.resolve(recipesData);
    if (!recipesLoadPromise) {
      recipesLoadPromise = Promise.all([
        fetch('recipes.json').then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        }),
        api('/api/recipes'),
      ])
        .then(([bundled, userRecipes]) => {
          // A stable, collision-proof key for the shopping-list Map
          // (keyed by recipe, not by array position) — bundled entries
          // have no id of their own, and two different recipes (a
          // bundled one and one you saved, or two of your own) can
          // share the same name, so the name alone isn't safe to key
          // by. Namespaced by source so "bundled:Chicken Curry" and
          // "user:Chicken Curry" never collide even with an identical name.
          const data = [
            ...bundled.map((r) => ({ ...r, source: 'bundled', key: `bundled:${r.name}` })),
            ...userRecipes.map((r) => ({ ...r, source: 'user', key: `user:${r.id}` })),
          ];
          recipesData = data;
          return data;
        })
        .catch((err) => {
          recipesLoadPromise = null; // allow retrying on the next open
          throw err;
        });
    }
    return recipesLoadPromise;
  }

  // Only items actually in stock count as "available" — an Out item
  // isn't something you can cook with, even though findMatchingItem()
  // (used elsewhere for Use/Delete) doesn't care about quantity.
  // Stricter than FUZZY_MATCH_THRESHOLD (0.6, used for typed Use-item
  // lookups): this runs unattended over every recipe's ingredient list
  // with no character-by-character human review the way typing a name
  // gets, so a marginal match reads as a confident "you have this" —
  // e.g. "Bell Pepper" vs "Black Pepper" shares enough weight in
  // "pepper" alone to clear 0.6, which would silently claim a spice
  // jar as a vegetable. 0.75 still catches real typos in a stored name
  // while rejecting look-alikes like that.
  const RECIPE_INGREDIENT_MATCH_THRESHOLD = 0.75;

  function findAvailableIngredientMatch(ingredientName) {
    const inStock = items.filter((i) => i.quantity > 0);
    const normalized = normalizeForMatch(ingredientName);
    const exact = inStock.find((i) => normalizeForMatch(i.name) === normalized);
    if (exact) return exact;
    let best = null;
    let bestScore = RECIPE_INGREDIENT_MATCH_THRESHOLD;
    for (const item of inStock) {
      const score = fuzzyMatchScore(ingredientName, item.name);
      if (score < bestScore) continue;
      best = item;
      bestScore = score;
    }
    return best;
  }

  // Matches every ingredient against current stock, then scores the
  // recipe two ways: matchRatio (how much of it you can make right
  // now) for "Best match" mode, and urgencyScore — weighting matched
  // ingredients by how urgently they need using (expiring soon > Low >
  // everything else, the exact same tiers itemSortPriority() uses for
  // the list) — for "Use up expiring/low" mode.
  function scoreRecipe(recipe) {
    const matches = recipe.ingredients.map((ingredient) => ({
      ingredient,
      matchedItem: findAvailableIngredientMatch(ingredient.name),
    }));
    const matchedCount = matches.filter((m) => m.matchedItem).length;
    const total = recipe.ingredients.length;
    let urgencyScore = 0;
    for (const m of matches) {
      if (!m.matchedItem) continue;
      const expiringSoon =
        m.matchedItem.expirationDate && daysUntil(m.matchedItem.expirationDate) <= EXPIRY_BADGE_VISIBLE_DAYS;
      const lowLabel = getLowStockBadge(m.matchedItem);
      if (expiringSoon) urgencyScore += 3;
      else if (lowLabel === 'Low' || lowLabel === 'Out') urgencyScore += 2;
      else urgencyScore += 1;
    }
    return { recipe, matches, matchedCount, total, matchRatio: total ? matchedCount / total : 0, urgencyScore };
  }

  // A recipe can only actually be Used once EVERY one of its ingredients
  // is in stock — no more silently deducting just the ones you happen to
  // have and quietly dropping the rest. If anything's missing, this adds
  // the recipe to the shopping list (the same mechanism "Add missing to
  // shopping list" uses) and takes you straight to Create Shopping List
  // instead of opening a partial Use review. Shared by "Use this recipe"
  // (Search Recipes) and "Use Ingredients from Recipe" (the Use item
  // panel) so both apply the exact same all-or-nothing rule.
  // `closeCurrentPanel` closes whichever panel this was called from —
  // called either way, since the app always navigates somewhere next
  // (the Use item review or the shopping list), never stays put.
  function tryUseRecipe(recipe, closeCurrentPanel) {
    const { matches, matchedCount, total } = scoreRecipe(recipe);
    const missingCount = total - matchedCount;
    closeCurrentPanel();

    if (missingCount > 0) {
      shoppingListRecipes.set(recipe.key, recipe);
      openShoppingListPanel();
      showToast(
        `Missing ${missingCount} ingredient${missingCount === 1 ? '' : 's'} for ${recipe.name} — ` +
        `added it to your shopping list instead.`
      );
      return false;
    }

    openEntryForm('use');
    const reviewItems = matches.map((m) => ({
      name: m.matchedItem.name,
      quantity: m.ingredient.quantity,
      unit: m.ingredient.unit,
      location: m.matchedItem.location,
      category: m.matchedItem.category,
      action: 'use',
      expirationDate: null,
    }));
    voiceReviewEl.classList.remove('hidden');
    renderReview(reviewItems);
    showToast(`Loaded ${reviewItems.length} ingredient${reviewItems.length === 1 ? '' : 's'} from ${recipe.name}`);
    return true;
  }

  // A recipe only counts as suggestible once at least 65% of its
  // ingredients are actually on hand — no relaxing that if fewer than
  // 3 recipes clear it; better to show 0-2 real suggestions than pad
  // the list with something you're missing a third of. Searching by
  // name (below) bypasses this entirely — a deliberate lookup isn't a
  // suggestion, so it shows the recipe regardless of match %.
  const RECIPE_MIN_MATCH_RATIO = 0.65;
  // Below this many total items in inventory, matches are naturally
  // sparse — a hint to that effect, not a hard block, shown alongside
  // whatever (if anything) still qualifies.
  const MIN_ITEMS_FOR_GOOD_RECIPE_MATCHES = 20;

  // Recipes added to the shopping list via "Add missing to shopping
  // list" (in Search Recipes) — keyed by recipe name, since bundled
  // recipes.json entries have no id. Accumulates across multiple
  // recipes; cleared only by removing them individually or a page
  // reload — no server persistence, this is deliberately session-only.
  const shoppingListRecipes = new Map();

  function pickTopRecipes(rankMode) {
    const scored = recipesData.map(scoreRecipe);
    const candidates = scored.filter((s) => s.matchRatio >= RECIPE_MIN_MATCH_RATIO);
    const sorted = [...candidates].sort((a, b) => {
      if (rankMode === 'urgent') {
        return b.urgencyScore - a.urgencyScore || b.matchRatio - a.matchRatio;
      }
      return b.matchRatio - a.matchRatio || b.matchedCount - a.matchedCount || a.total - b.total;
    });
    return sorted.slice(0, 3);
  }

  function renderSearchRecipeResults() {
    searchRecipeResultsEl.innerHTML = '';
    if (!recipesData) {
      searchRecipeResultsEl.innerHTML = '<p class="status-line">Loading recipes…</p>';
      return;
    }
    if (items.length < MIN_ITEMS_FOR_GOOD_RECIPE_MATCHES) {
      const hint = document.createElement('p');
      hint.className = 'review-note';
      hint.textContent =
        `You have ${items.length} item${items.length === 1 ? '' : 's'} in your inventory — ` +
        `more inventory is needed for good recipe matches (a wider variety makes it much more ` +
        `likely a recipe clears the 65% bar below).`;
      searchRecipeResultsEl.appendChild(hint);
    }
    const top = pickTopRecipes(searchRecipeRankMode);
    if (top.length === 0) {
      const note = document.createElement('p');
      note.className = 'review-note';
      note.textContent = "Nothing in the recipe list has 65% or more of its ingredients in your inventory right now.";
      searchRecipeResultsEl.appendChild(note);
      return;
    }
    for (const scored of top) {
      searchRecipeResultsEl.appendChild(renderRecipeSuggestionCard(scored));
    }
  }

  // Deletes a user-added recipe (shared by every place a delete button
  // for one appears — the Search Recipes card, the Save Recipes list).
  // Returns true on success so callers know whether to re-render.
  async function deleteUserRecipe(recipe) {
    if (!confirm(`Delete your recipe "${recipe.name}"? This can't be undone.`)) return false;
    try {
      await api(`/api/recipes/${recipe.id}`, { method: 'DELETE' });
      if (recipesData) recipesData = recipesData.filter((r) => !(r.source === 'user' && r.id === recipe.id));
      shoppingListRecipes.delete(recipe.key);
      showToast(`Deleted ${recipe.name}`);
      return true;
    } catch (err) {
      showToast(`Couldn't delete: ${err.message}`);
      return false;
    }
  }

  function renderRecipeSuggestionCard(scored) {
    const { recipe, matches, matchedCount, total } = scored;
    const card = document.createElement('div');
    card.className = 'recipe-suggestion-card';

    const isUserRecipe = recipe.source === 'user';

    const nameRow = document.createElement('div');
    nameRow.className = 'recipe-suggestion-name-row';
    const nameEl = document.createElement('h3');
    nameEl.className = 'recipe-suggestion-name';
    // ⭐ distinguishes a recipe you added yourself from the bundled
    // list — same recipe pool and matching either way, just a visual
    // "this one's yours" marker, per the star the user asked for.
    nameEl.textContent = isUserRecipe ? `⭐ ${recipe.name}` : recipe.name;
    if (isUserRecipe) nameEl.setAttribute('aria-label', `${recipe.name} (your recipe)`);
    nameRow.appendChild(nameEl);

    if (isUserRecipe) {
      const deleteRecipeBtn = document.createElement('button');
      deleteRecipeBtn.type = 'button';
      deleteRecipeBtn.className = 'recipe-delete-btn';
      deleteRecipeBtn.setAttribute('aria-label', `Delete your recipe ${recipe.name}`);
      deleteRecipeBtn.textContent = '✕';
      deleteRecipeBtn.addEventListener('click', async () => {
        if (await deleteUserRecipe(recipe)) {
          card.remove();
          renderShoppingListSelectedRecipes();
        }
      });
      nameRow.appendChild(deleteRecipeBtn);
    }
    card.appendChild(nameRow);

    const countEl = document.createElement('p');
    countEl.className = 'recipe-suggestion-count';
    countEl.textContent = `${matchedCount} of ${total} ingredients on hand`;
    card.appendChild(countEl);

    const list = document.createElement('ul');
    list.className = 'recipe-ingredient-list';
    for (const { ingredient, matchedItem } of matches) {
      const li = document.createElement('li');
      li.className = matchedItem ? 'have' : 'missing';
      const amount = ingredient.quantity ? `${formatQty(ingredient.quantity)}${ingredient.unit ? ' ' + ingredient.unit : ''} ` : '';
      li.textContent = matchedItem ? `${amount}${ingredient.name}` : `${amount}${ingredient.name} (missing)`;
      list.appendChild(li);
    }
    card.appendChild(list);

    const buttons = document.createElement('div');
    buttons.className = 'review-card-buttons';

    const useBtn = document.createElement('button');
    useBtn.type = 'button';
    useBtn.className = 'btn btn-primary';
    useBtn.textContent = 'Use this recipe';
    useBtn.addEventListener('click', () => {
      // tryUseRecipe() decides where this actually goes: the Use item
      // review (openEntryForm('use') sets entryMode so the resulting
      // cards are locked to Use) if every ingredient is in stock, or
      // straight to Create Shopping List otherwise — see its own comment.
      tryUseRecipe(recipe, closeSearchRecipePanel);
    });
    buttons.appendChild(useBtn);

    // Toggle button: adds/removes this recipe's missing ingredients
    // from the shopping list (see computeShoppingList()). A recipe
    // with nothing missing has nothing useful to add — button stays
    // hidden in that case.
    const missingCount = total - matchedCount;
    if (missingCount > 0) {
      const shoppingBtn = document.createElement('button');
      shoppingBtn.type = 'button';
      shoppingBtn.className = 'btn btn-secondary';
      function refreshShoppingBtn() {
        const added = shoppingListRecipes.has(recipe.key);
        shoppingBtn.textContent = added ? '✓ Added — remove' : 'Add missing to shopping list';
        shoppingBtn.classList.toggle('active', added);
      }
      refreshShoppingBtn();
      shoppingBtn.addEventListener('click', () => {
        if (shoppingListRecipes.has(recipe.key)) {
          shoppingListRecipes.delete(recipe.key);
        } else {
          shoppingListRecipes.set(recipe.key, recipe);
        }
        refreshShoppingBtn();
        renderShoppingListSelectedRecipes();
      });
      buttons.appendChild(shoppingBtn);
    }

    card.appendChild(buttons);

    return card;
  }

  // Live "recipe names appear as you type" search, independent of the
  // 65% match bar — a deliberate name lookup, not a suggestion. Shows
  // up to 8 matching names; clicking one replaces the results area
  // with that single recipe's full card (any match %).
  function renderRecipeSearchMatches() {
    const term = recipeSearchInput.value.trim().toLowerCase();
    if (!term) {
      recipeSearchMatchesEl.classList.add('hidden');
      recipeSearchMatchesEl.innerHTML = '';
      renderSearchRecipeResults();
      return;
    }
    if (!recipesData) return; // still loading; the input is inert until it resolves
    const matches = recipesData.filter((r) => r.name.toLowerCase().includes(term)).slice(0, 8);
    recipeSearchMatchesEl.innerHTML = '';
    if (matches.length === 0) {
      recipeSearchMatchesEl.classList.add('hidden');
      searchRecipeResultsEl.innerHTML = '<p class="review-note">No recipe names match that.</p>';
      return;
    }
    recipeSearchMatchesEl.classList.remove('hidden');
    for (const recipe of matches) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'recipe-search-match-btn';
      btn.textContent = recipe.source === 'user' ? `⭐ ${recipe.name}` : recipe.name;
      btn.addEventListener('click', () => {
        recipeSearchMatchesEl.classList.add('hidden');
        recipeSearchMatchesEl.innerHTML = '';
        searchRecipeResultsEl.innerHTML = '';
        searchRecipeResultsEl.appendChild(renderRecipeSuggestionCard(scoreRecipe(recipe)));
      });
      recipeSearchMatchesEl.appendChild(btn);
    }
  }

  function openSearchRecipePanel() {
    entryModeButtons.classList.add('hidden');
    inventoryBrowserEl.classList.add('hidden');
    searchRecipePanel.classList.remove('hidden');
    recipeSearchInput.value = '';
    recipeSearchMatchesEl.classList.add('hidden');
    recipeSearchMatchesEl.innerHTML = '';
    renderSearchRecipeResults(); // renders real results if already cached, else the loading state
    if (!recipesData) {
      loadRecipesData()
        .then(renderSearchRecipeResults)
        .catch(() => {
          searchRecipeResultsEl.innerHTML =
            '<p class="review-note">Couldn\'t load the recipe list. Try again.</p>';
        });
    }
  }

  function closeSearchRecipePanel() {
    searchRecipePanel.classList.add('hidden');
    entryModeButtons.classList.remove('hidden');
    inventoryBrowserEl.classList.remove('hidden');
  }

  modeSearchRecipeBtn.addEventListener('click', openSearchRecipePanel);
  searchRecipeCancelBtn.addEventListener('click', closeSearchRecipePanel);
  recipeSearchInput.addEventListener('input', renderRecipeSearchMatches);
  searchRankMatchBtn.addEventListener('click', () => {
    searchRecipeRankMode = 'match';
    searchRankMatchBtn.classList.add('active');
    searchRankUrgentBtn.classList.remove('active');
    renderSearchRecipeResults();
  });
  searchRankUrgentBtn.addEventListener('click', () => {
    searchRecipeRankMode = 'urgent';
    searchRankUrgentBtn.classList.add('active');
    searchRankMatchBtn.classList.remove('active');
    renderSearchRecipeResults();
  });

  // Save Recipes — its own top-level panel now, not nested behind a
  // toggle button, since it's no longer a sub-feature of Search Recipes.
  //
  // Below the save form, every available recipe (bundled + yours) is
  // browsable as a collapsible list grouped by category — same
  // collapsible-heading pattern the main inventory list uses for its
  // "All" view (see render()), just over recipes instead of items.
  const RECIPE_CATEGORY_LABELS = {
    breakfast: 'Breakfast',
    sandwiches_wraps: 'Sandwiches & Wraps',
    soups_salads: 'Soups & Salads',
    main_dishes: 'Main Dishes',
    sides_snacks: 'Sides & Snacks',
    desserts_baking: 'Desserts & Baking',
    beverages: 'Beverages',
    other: 'Other',
  };
  const RECIPE_CATEGORY_ORDER = Object.keys(RECIPE_CATEGORY_LABELS);
  // categoryId -> true if its section is collapsed; every section starts
  // collapsed (same as the main list's "All" view) so the full ~40+ bundled
  // recipes don't all dump onto the screen at once.
  const collapsedRecipeCategories = Object.fromEntries(RECIPE_CATEGORY_ORDER.map((id) => [id, true]));

  function renderSavedRecipeRow(recipe) {
    const row = document.createElement('div');
    row.className = 'saved-recipe-row';
    const nameEl = document.createElement('span');
    const count = recipe.ingredients.length;
    const isUserRecipe = recipe.source === 'user';
    nameEl.textContent =
      `${isUserRecipe ? '⭐ ' : ''}${recipe.name} (${count} ingredient${count === 1 ? '' : 's'})`;
    row.appendChild(nameEl);
    if (isUserRecipe) {
      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'recipe-delete-btn';
      deleteBtn.setAttribute('aria-label', `Delete ${recipe.name}`);
      deleteBtn.textContent = '✕';
      deleteBtn.addEventListener('click', async () => {
        if (await deleteUserRecipe(recipe)) {
          renderRecipeCategoryGroups();
          renderShoppingListSelectedRecipes();
        }
      });
      row.appendChild(deleteBtn);
    }
    return row;
  }

  function renderRecipeCategoryGroups() {
    savedRecipesListEl.innerHTML = '';
    if (!recipesData) return;
    if (recipesData.length === 0) {
      savedRecipesListEl.innerHTML = '<p class="review-note">No recipes available yet.</p>';
      return;
    }

    const groups = new Map();
    for (const recipe of recipesData) {
      const cat = recipe.category && RECIPE_CATEGORY_LABELS[recipe.category] ? recipe.category : 'other';
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat).push(recipe);
    }
    for (const groupRecipes of groups.values()) {
      groupRecipes.sort((a, b) => a.name.localeCompare(b.name));
    }
    // Fixed category order (RECIPE_CATEGORY_ORDER), skipping any category
    // with nothing in it — same as the main list only showing sections
    // for categories that actually have items.
    const orderedCats = RECIPE_CATEGORY_ORDER.filter((cat) => groups.has(cat));

    for (const cat of orderedCats) {
      const groupRecipes = groups.get(cat);
      const collapsed = !!collapsedRecipeCategories[cat];

      const headingRow = document.createElement('div');
      headingRow.className = 'category-heading-row';
      const headingBtn = document.createElement('button');
      headingBtn.type = 'button';
      headingBtn.className = 'category-heading';
      const arrow = document.createElement('span');
      arrow.className = 'category-heading-arrow';
      arrow.textContent = collapsed ? '▸' : '▾';
      const label = document.createElement('span');
      label.textContent = `${RECIPE_CATEGORY_LABELS[cat]} (${groupRecipes.length})`;
      headingBtn.appendChild(arrow);
      headingBtn.appendChild(label);
      headingBtn.addEventListener('click', () => {
        collapsedRecipeCategories[cat] = !collapsed;
        renderRecipeCategoryGroups();
      });
      headingRow.appendChild(headingBtn);
      savedRecipesListEl.appendChild(headingRow);

      if (!collapsed) {
        for (const recipe of groupRecipes) savedRecipesListEl.appendChild(renderSavedRecipeRow(recipe));
      }
    }
  }

  function closeAddRecipeForm() {
    newRecipeNameInput.value = '';
    newRecipeCategorySelect.value = 'other';
    newRecipeIngredientsInput.value = '';
    addRecipeNote.classList.add('hidden');
  }

  function openSaveRecipePanel() {
    entryModeButtons.classList.add('hidden');
    inventoryBrowserEl.classList.add('hidden');
    saveRecipePanel.classList.remove('hidden');
    closeAddRecipeForm();
    savedRecipesListEl.innerHTML = '<p class="status-line">Loading…</p>';
    loadRecipesData()
      .then(renderRecipeCategoryGroups)
      .catch(() => {
        savedRecipesListEl.innerHTML = '<p class="review-note">Couldn\'t load recipes. Try again.</p>';
      });
  }

  function closeSaveRecipePanel() {
    saveRecipePanel.classList.add('hidden');
    entryModeButtons.classList.remove('hidden');
    inventoryBrowserEl.classList.remove('hidden');
  }

  modeSaveRecipeBtn.addEventListener('click', openSaveRecipePanel);
  saveRecipeCancelBtn.addEventListener('click', closeSaveRecipePanel);

  // Reuses /api/recipe/parse — the same free-text ingredient parser
  // "Enter recipe ingredients" already uses — so pasting a recipe here
  // works the same way; only name/quantity/unit are kept, since a
  // saved recipe's location/category get resolved fresh against
  // whatever matches at suggestion time, not fixed at save time.
  saveRecipeBtn.addEventListener('click', async () => {
    const name = newRecipeNameInput.value.trim();
    const category = newRecipeCategorySelect.value;
    const ingredientsText = newRecipeIngredientsInput.value.trim();
    addRecipeNote.classList.add('hidden');
    if (!name) {
      addRecipeNote.textContent = 'Recipe name is required.';
      addRecipeNote.classList.remove('hidden');
      return;
    }
    if (!ingredientsText) {
      addRecipeNote.textContent = 'Enter at least one ingredient.';
      addRecipeNote.classList.remove('hidden');
      return;
    }
    saveRecipeBtn.disabled = true;
    try {
      const parsed = await api('/api/recipe/parse', {
        method: 'POST',
        body: JSON.stringify({ text: ingredientsText }),
      });
      const ingredients = parsed.items.map((i) => ({ name: i.name, quantity: i.quantity, unit: i.unit }));
      const saved = await api('/api/recipes', {
        method: 'POST',
        body: JSON.stringify({ name, category, ingredients }),
      });
      if (recipesData) recipesData.push({ ...saved, source: 'user', key: `user:${saved.id}` });
      closeAddRecipeForm();
      renderRecipeCategoryGroups();
      showToast(`Saved "${saved.name}"`);
    } catch (err) {
      addRecipeNote.textContent = err.message;
      addRecipeNote.classList.remove('hidden');
    } finally {
      saveRecipeBtn.disabled = false;
    }
  });

  // Create Shopping List — assembles one deduped list from: missing
  // ingredients of every recipe added via "Add missing to shopping
  // list" above, plus every item currently Low or Out, plus every item
  // expiring soon (same tiers/thresholds the badges themselves use).
  // Recomputed fresh each time — nothing here is saved server-side.
  function renderShoppingListSelectedRecipes() {
    shoppingListSelectedRecipesEl.innerHTML = '';
    if (shoppingListRecipes.size === 0) {
      shoppingListSelectedRecipesEl.innerHTML =
        '<p class="review-note">No recipes added yet — in Search Recipes, tap "Add missing to shopping list" on one you want to make.</p>';
      return;
    }
    for (const recipe of shoppingListRecipes.values()) {
      const row = document.createElement('div');
      row.className = 'saved-recipe-row';
      const nameEl = document.createElement('span');
      nameEl.textContent = recipe.source === 'user' ? `⭐ ${recipe.name}` : recipe.name;
      row.appendChild(nameEl);
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'recipe-delete-btn';
      removeBtn.setAttribute('aria-label', `Remove ${recipe.name} from shopping list`);
      removeBtn.textContent = '✕';
      removeBtn.addEventListener('click', () => {
        shoppingListRecipes.delete(recipe.key);
        renderShoppingListSelectedRecipes();
      });
      row.appendChild(removeBtn);
      shoppingListSelectedRecipesEl.appendChild(row);
    }
  }

  function computeShoppingList() {
    const seen = new Map(); // normalized name -> display text, so casing/whitespace doesn't duplicate an entry
    function add(name) {
      const key = normalizeForMatch(name);
      if (key && !seen.has(key)) seen.set(key, name);
    }
    for (const recipe of shoppingListRecipes.values()) {
      const { matches } = scoreRecipe(recipe);
      for (const m of matches) {
        if (!m.matchedItem) add(m.ingredient.name);
      }
    }
    for (const item of items) {
      const lowLabel = getLowStockBadge(item);
      if (lowLabel === 'Low' || lowLabel === 'Out') add(item.name);
    }
    for (const item of items) {
      if (item.expirationDate && daysUntil(item.expirationDate) <= EXPIRY_BADGE_VISIBLE_DAYS) add(item.name);
    }
    return [...seen.values()].sort((a, b) => a.localeCompare(b));
  }

  function openShoppingListPanel() {
    entryModeButtons.classList.add('hidden');
    inventoryBrowserEl.classList.add('hidden');
    shoppingListPanel.classList.remove('hidden');
    shoppingListOutputEl.classList.add('hidden');
    renderShoppingListSelectedRecipes();
  }

  function closeShoppingListPanel() {
    shoppingListPanel.classList.add('hidden');
    entryModeButtons.classList.remove('hidden');
    inventoryBrowserEl.classList.remove('hidden');
  }

  modeShoppingListBtn.addEventListener('click', openShoppingListPanel);
  shoppingListCancelBtn.addEventListener('click', closeShoppingListPanel);

  generateShoppingListBtn.addEventListener('click', () => {
    const list = computeShoppingList();
    shoppingListOutputEl.classList.remove('hidden');
    shoppingListCopyNote.classList.add('hidden');
    shoppingListTextEl.value =
      list.length === 0 ? 'Nothing to shop for right now!' : list.map((name) => `- ${name}`).join('\n');
  });

  // navigator.clipboard needs a secure context; falls back to
  // selecting the text so Ctrl/Cmd+C still works everywhere else.
  copyShoppingListBtn.addEventListener('click', async () => {
    shoppingListCopyNote.classList.add('hidden');
    try {
      await navigator.clipboard.writeText(shoppingListTextEl.value);
      shoppingListCopyNote.textContent = 'Copied!';
      shoppingListCopyNote.classList.remove('hidden');
    } catch {
      shoppingListTextEl.select();
      shoppingListCopyNote.textContent = "Couldn't auto-copy — text is selected, press Ctrl+C (or Cmd+C).";
      shoppingListCopyNote.classList.remove('hidden');
    }
  });

  voiceForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = voiceTextInput.value.trim();
    if (!text) return;
    parseVoiceText(text);
  });

  async function parseVoiceText(text) {
    voiceReviewEl.innerHTML = '';
    voiceReviewEl.classList.remove('hidden');

    // Under − Use item, typing (or picking from the suggestion list) an
    // item's exact name is just a lookup, not a sentence to parse — skip
    // the NLP parser entirely and default straight to "use 1 of this."
    // Otherwise a name that happens to contain a digit of its own (e.g.
    // an old "... 10 Fl Oz" leftover in a stored name) gets misread as a
    // typed quantity by the general-purpose sentence parser below, which
    // is built for phrases like "used 2 cans of black beans" and has no
    // way to tell a name's own digit apart from an intended one. A
    // fuzzy (not just exact) match isn't used for this shortcut — a
    // phrase like "use 3 olive oil" can fuzzy-match "Olive Oil" well
    // enough to trigger it, silently dropping the "3" the user typed.
    if (entryMode === 'use') {
      const exactMatch = findExactItemMatch(text);
      if (exactMatch) {
        renderReview([
          {
            name: exactMatch.name,
            quantity: 1,
            unit: exactMatch.unit,
            location: exactMatch.location,
            category: exactMatch.category,
            action: 'use',
            expirationDate: null,
          },
        ]);
        return;
      }
    }

    voiceReviewEl.innerHTML = '<p class="status-line">Parsing…</p>';
    try {
      const result = await api('/api/voice/parse', {
        method: 'POST',
        body: JSON.stringify({ transcript: text }),
      });
      renderReview(result.items);
    } catch (err) {
      voiceReviewEl.innerHTML = `<p class="review-note">${err.message}</p>`;
    }
  }

  // Lowercases, replaces anything that isn't a letter/digit with a space,
  // and collapses runs of whitespace — "S.PELLEGRINO Sparkling..." and
  // "s pellegrino sparkling..." normalize to the same tokens.
  function normalizeForMatch(str) {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  // Standard edit-distance: how many single-character insertions,
  // deletions, or substitutions turn `a` into `b`.
  function levenshtein(a, b) {
    const rows = a.length + 1;
    const cols = b.length + 1;
    const dp = Array.from({ length: rows }, () => new Array(cols).fill(0));
    for (let i = 0; i < rows; i++) dp[i][0] = i;
    for (let j = 0; j < cols; j++) dp[0][j] = j;
    for (let i = 1; i < rows; i++) {
      for (let j = 1; j < cols; j++) {
        dp[i][j] = a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
      }
    }
    return dp[a.length][b.length];
  }

  // Two words count as "close" if they're identical, or a typo's worth
  // of edits apart relative to their length (roughly one edit per 4
  // characters, minimum 1) — "pelligrino" vs "pellegrino" (1 edit)
  // passes; unrelated words don't. Single-character words are excluded
  // since they're too short to fuzzy-match reliably (any word starting
  // with that letter would otherwise "match").
  function wordsAreClose(a, b) {
    if (a === b) return true;
    if (a.length < 2 || b.length < 2) return false;
    const threshold = Math.max(1, Math.floor(Math.max(a.length, b.length) / 4));
    return levenshtein(a, b) <= threshold;
  }

  // How well a typed name matches an item's name, from 0 to 1. Each
  // typed word looks for a close counterpart among the item's words;
  // the score is the fraction of typed *characters* (not word count)
  // covered by matched words, so a short common word like "san" barely
  // moves the score while a long distinctive word like "pelligrino"
  // matching "pellegrino" carries it — close spellings of the name that
  // actually identifies the item find it, without a filler word failing
  // to match sinking an otherwise-clear match.
  function fuzzyMatchScore(typedName, itemName) {
    const typedWords = normalizeForMatch(typedName).split(' ').filter(Boolean);
    const itemWords = normalizeForMatch(itemName).split(' ').filter(Boolean);
    if (!typedWords.length) return 0;
    let matched = 0;
    let total = 0;
    for (const word of typedWords) {
      total += word.length;
      if (itemWords.some((iw) => wordsAreClose(word, iw))) matched += word.length;
    }
    return total ? matched / total : 0;
  }

  const FUZZY_MATCH_THRESHOLD = 0.6;

  // Any item whose (normalized) name matches `name` exactly, regardless
  // of location. No fuzzy scoring here — used where a partial or
  // sentence-like typed phrase must NOT count as a match (see
  // parseVoiceText()'s use of this for "don't invent a quantity out of
  // a name lookup").
  function findExactItemMatch(name) {
    const normalized = normalizeForMatch(name);
    if (!normalized) return undefined;
    return items.find((i) => normalizeForMatch(i.name) === normalized);
  }

  // Exact (normalized) match wins first, same as before; a typo'd or
  // partial name (e.g. "san pelligrino" for "S.Pellegrino...") falls
  // back to the closest fuzzy match, if any clears the threshold —
  // preferring the current location, then highest score, same
  // tie-breaking priority as the exact-match path always had.
  function findMatchingItem(name, location) {
    const normalized = normalizeForMatch(name);
    if (!normalized) return undefined;
    const exact = (list) => list.find((i) => normalizeForMatch(i.name) === normalized);
    const sameLocation = items.filter((i) => i.location === location);
    const exactMatch = exact(sameLocation) || findExactItemMatch(name);
    if (exactMatch) return exactMatch;

    let best = null;
    let bestScore = FUZZY_MATCH_THRESHOLD;
    for (const item of items) {
      const score = fuzzyMatchScore(name, item.name);
      if (score < bestScore) continue;
      // Prefer a same-location item over an equally-good one elsewhere.
      const better = !best || score > bestScore || (score === bestScore && item.location === location && best.location !== location);
      if (better) {
        best = item;
        bestScore = score;
      }
    }
    return best || undefined;
  }

  function renderReview(parsedItems) {
    voiceReviewEl.innerHTML = '';

    // Under − Use item, every card is locked to Use — no way to create
    // a new item from that area. (Under + Add item, or when entryMode
    // is otherwise unset — e.g. a card left over from a previous mode
    // — both actions stay available.)
    const lockedToUse = entryMode === 'use';

    parsedItems.forEach((parsed, idx) => {
      const state = { ...parsed };
      if (lockedToUse) state.action = 'use';
      // Defaults to whole-units mode on Use — see refreshToggle().
      state.useByAmount = false;
      const card = document.createElement('div');
      card.className = 'review-card';

      const header = document.createElement('div');
      header.className = 'review-card-header';

      const nameInputEl = document.createElement('input');
      nameInputEl.type = 'text';
      nameInputEl.value = state.name;
      nameInputEl.setAttribute('aria-label', 'Item name');
      nameInputEl.setAttribute('list', 'item-name-options');
      nameInputEl.style.flex = '1';
      nameInputEl.addEventListener('input', () => {
        state.name = nameInputEl.value;
        // syncFieldsFromMatch() is declared further down (once its
        // target fields exist) but not called until a real "input"
        // event fires, by which point everything's in place.
        syncFieldsFromMatch();
      });

      const toggle = document.createElement('div');
      toggle.className = 'action-toggle';
      const addToggleBtn = document.createElement('button');
      addToggleBtn.type = 'button';
      addToggleBtn.dataset.action = 'add';
      addToggleBtn.textContent = 'Add';
      const useToggleBtn = document.createElement('button');
      useToggleBtn.type = 'button';
      useToggleBtn.dataset.action = 'use';
      useToggleBtn.textContent = 'Use';
      // Weight/volume stays visible either way — same field, different
      // meaning: on Add it's the item's size (assumed full, doubling as
      // both total and current amount); on Use it's how much of it you
      // used. On Use, using whole units and logging a measured amount
      // are mutually exclusive — "1 bottle" and "6 fl oz used" can't both
      // be true — so only one of Quantity / Weight-volume is ever active;
      // state.useByAmount (toggled via useModeToggleBtn) picks which.
      // Declared further down, but not called until after every element
      // it touches exists.
      function refreshToggle() {
        addToggleBtn.classList.toggle('active', state.action === 'add');
        useToggleBtn.classList.toggle('active', state.action === 'use');
        const isAdd = state.action === 'add';
        // On Add, name the label after the selected Unit ("per bottle",
        // "per box", ...) so it's never mistaken for a grand total across
        // every bottle in stock — it's always just the size of one.
        const perUnitLabel = (UNIT_LABELS[state.unit] || 'unit').toLowerCase();
        // On Use, the plain Qty unit (bottle/box/piece) is already known
        // from the matched item — nothing to redefine there.
        unitEl.classList.toggle('hidden', !isAdd);
        useModeToggleBtn.classList.toggle('hidden', isAdd);
        // Expiration date only means something for stock you're adding —
        // using some of an item doesn't change when what's left expires.
        expRow.classList.toggle('hidden', !isAdd);
        // Pack size is a property you set when adding a new pack, not
        // something you interact with when using some of it.
        packSizeRow.classList.toggle('hidden', !isAdd);
        if (!isAdd) {
          packSizeEl.value = '';
          state.packSize = null;
        }
        if (!isAdd) {
          expEl.value = '';
          state.expirationDate = null;
        }
        if (isAdd) {
          weightVolLabel.textContent = `Weight/volume per ${perUnitLabel} (optional)`;
          wvAmountEl.placeholder = `Amount per ${perUnitLabel}`;
          qtyLabel.textContent = 'Quantity being added';
          qtyEl.disabled = false;
          wvAmountEl.disabled = false;
          wvUnitEl.disabled = false;
          const val = wvAmountEl.value || null;
          state.fullnessTotal = val;
          state.fullnessAmount = val;
          state.weightVolumeUsedAmount = null;
        } else {
          weightVolLabel.textContent = 'Weight/volume used (optional)';
          wvAmountEl.placeholder = 'Amount used';
          qtyLabel.textContent = 'Quantity being used';
          // Beverages can only ever be used a whole bottle at a time —
          // no measured (weight/volume) deduction, so there's no mode
          // to switch into at all; force whole-units and hide the toggle.
          const isBeverage = state.category === 'beverages';
          if (isBeverage) state.useByAmount = false;
          useModeToggleBtn.classList.toggle('hidden', isBeverage);
          if (!isBeverage) {
            useModeToggleBtn.textContent = state.useByAmount
              ? 'Use whole units instead'
              : 'Log a measured amount instead';
          }
          qtyEl.disabled = state.useByAmount;
          wvAmountEl.disabled = !state.useByAmount;
          wvUnitEl.disabled = !state.useByAmount;
          state.weightVolumeUsedAmount = state.useByAmount ? (wvAmountEl.value || null) : null;
          state.fullnessTotal = null;
          state.fullnessAmount = null;
        }
        updateQtyWarning(); // the nudge only ever applies on Add — re-check on every toggle
      }
      addToggleBtn.addEventListener('click', () => {
        state.action = 'add';
        refreshToggle();
      });
      useToggleBtn.addEventListener('click', () => {
        state.action = 'use';
        refreshToggle();
      });
      // Locked to Use: no Add button at all, so there's no way to end
      // up creating a new item from the − Use item area.
      if (!lockedToUse) toggle.appendChild(addToggleBtn);
      toggle.appendChild(useToggleBtn);

      header.appendChild(nameInputEl);
      header.appendChild(toggle);

      // Field order: name (header, above), Unit, Weight/volume (+ its
      // unit), Quantity, Category, Location, Expiration date.
      const unitRow = document.createElement('div');
      unitRow.className = 'field-row';

      const unitEl = buildUnitSelect(state.unit);
      unitEl.addEventListener('change', () => {
        state.unit = unitEl.value;
        refreshToggle(); // keeps the "Weight/volume per <unit>" label in sync
      });
      unitRow.appendChild(unitEl);

      const qtyRow = document.createElement('div');
      qtyRow.className = 'field-row';

      const qtyLabel = document.createElement('label');
      qtyLabel.className = 'field-label';
      qtyLabel.textContent = 'Quantity being added';

      const qtyEl = document.createElement('input');
      qtyEl.type = 'number';
      qtyEl.min = '0';
      qtyEl.step = 'any';
      qtyEl.value = state.quantity;
      qtyEl.placeholder = 'Qty';
      qtyEl.setAttribute('aria-label', 'Quantity');

      const qtyWarning = document.createElement('p');
      qtyWarning.className = 'qty-warning hidden';
      qtyWarning.textContent =
        "That's a lot for one receipt line — double-check it wasn't misread (e.g. \"1\" as \"7\").";

      // Only receipt-scanned Add quantities get this nudge — OCR is the
      // failure mode being guarded against, not a quantity you typed or
      // spoke yourself (or a Use amount, which this field doesn't drive).
      function updateQtyWarning() {
        const suspicious =
          state.source === 'receipt' &&
          state.action === 'add' &&
          Number(qtyEl.value) >= SUSPICIOUS_RECEIPT_QTY;
        qtyWarning.classList.toggle('hidden', !suspicious);
      }
      qtyEl.addEventListener('input', () => {
        state.quantity = Number(qtyEl.value);
        updateQtyWarning();
      });
      updateQtyWarning();

      qtyRow.appendChild(qtyLabel);
      qtyRow.appendChild(qtyEl);
      qtyRow.appendChild(qtyWarning);

      const catLocRow = document.createElement('div');
      catLocRow.className = 'field-row two-up';

      const catEl = document.createElement('select');
      catEl.setAttribute('aria-label', 'Category');
      const autoOpt = document.createElement('option');
      autoOpt.value = '';
      autoOpt.textContent = 'Category: Auto';
      catEl.appendChild(autoOpt);
      categories.forEach((cat) => {
        const opt = document.createElement('option');
        opt.value = cat.id;
        opt.textContent = cat.label;
        if (cat.id === state.category) opt.selected = true;
        catEl.appendChild(opt);
      });
      catEl.addEventListener('change', () => {
        state.category = catEl.value;
        refreshToggle(); // beverages restrict Use to whole units — recheck on every change
      });

      const locEl = document.createElement('select');
      locEl.setAttribute('aria-label', 'Location');
      ['pantry', 'fridge', 'freezer'].forEach((loc) => {
        const opt = document.createElement('option');
        opt.value = loc;
        opt.textContent = loc[0].toUpperCase() + loc.slice(1);
        if (loc === state.location) opt.selected = true;
        locEl.appendChild(opt);
      });
      locEl.addEventListener('change', () => (state.location = locEl.value));

      catLocRow.appendChild(catEl);
      catLocRow.appendChild(locEl);

      const expRow = document.createElement('div');
      expRow.className = 'field-row';
      const expLabel = document.createElement('label');
      expLabel.className = 'field-label';
      expLabel.textContent = 'Expiration date (optional)';
      const expEl = document.createElement('input');
      expEl.type = 'date';
      expEl.setAttribute('aria-label', 'Expiration date');
      if (state.expirationDate) expEl.value = state.expirationDate;
      expEl.addEventListener('input', () => (state.expirationDate = expEl.value || null));
      expRow.appendChild(expLabel);
      expRow.appendChild(expEl);

      // Weight/volume — Add-only, same as the + Add item card, and for
      // the same reason: a scanned/parsed item is assumed new and full,
      // so this is its size, not a "remaining" amount. A barcode's
      // package size pre-fills it (state.fullnessUnit/Total, set by
      // handleBarcodeResult()); either way it's editable before Confirm.
      const weightVolRow = document.createElement('div');
      weightVolRow.className = 'field-row';
      const weightVolLabel = document.createElement('label');
      weightVolLabel.className = 'field-label';
      weightVolLabel.textContent = 'Weight/volume (optional)';
      const weightVolInner = document.createElement('div');
      weightVolInner.className = 'field-row two-up';

      const wvAmountEl = document.createElement('input');
      wvAmountEl.type = 'number';
      wvAmountEl.min = '0';
      wvAmountEl.step = 'any';
      wvAmountEl.placeholder = 'Amount';
      wvAmountEl.setAttribute('aria-label', 'Weight/volume amount');
      if (state.fullnessTotal != null) wvAmountEl.value = state.fullnessTotal;
      wvAmountEl.addEventListener('input', refreshToggle); // recomputes which state field this value feeds

      const wvUnitEl = buildWeightVolumeUnitSelect(state.fullnessUnit, 'Weight/volume unit');
      wvUnitEl.addEventListener('change', () => (state.fullnessUnit = wvUnitEl.value || null));

      // Use-only: switches between "use whole units" (Quantity active,
      // this field disabled) and "log a measured amount" (this field
      // active, Quantity disabled) — see refreshToggle() for why they're
      // mutually exclusive rather than both always editable.
      const useModeToggleBtn = document.createElement('button');
      useModeToggleBtn.type = 'button';
      useModeToggleBtn.className = 'mode-switch-btn hidden';
      useModeToggleBtn.addEventListener('click', () => {
        state.useByAmount = !state.useByAmount;
        if (!state.useByAmount) {
          wvAmountEl.value = '';
          state.weightVolumeUsedAmount = null;
        }
        refreshToggle();
        (state.useByAmount ? wvAmountEl : qtyEl).focus();
      });

      weightVolInner.appendChild(wvAmountEl);
      weightVolInner.appendChild(wvUnitEl);
      weightVolRow.appendChild(weightVolLabel);
      weightVolRow.appendChild(weightVolInner);
      weightVolRow.appendChild(useModeToggleBtn);

      // Pack size — Add-only (genuinely hidden on Use, unlike Weight/
      // volume above): the count a "pack" started at, for items you'd
      // rather track as "6 left of a 24-pack" than a single container's
      // fullness — e.g. cans, snack bars, anything bought as a multi-
      // unit case. Optional and never guessed from a parsed quantity
      // ("add 24 cans of X" does NOT imply a 24-pack), since a quantity
      // of 24 today doesn't mean every future restock is also 24 — this
      // is a property of the item, set once, not re-derived from
      // whatever happened to be added most recently.
      const packSizeRow = document.createElement('div');
      packSizeRow.className = 'field-row';
      const packSizeLabel = document.createElement('label');
      packSizeLabel.className = 'field-label';
      packSizeLabel.textContent = 'Pack size (optional)';
      const packSizeEl = document.createElement('input');
      packSizeEl.type = 'number';
      packSizeEl.min = '0';
      packSizeEl.step = 'any';
      packSizeEl.placeholder = 'e.g. 24 for a 24-pack';
      packSizeEl.setAttribute('aria-label', 'Pack size');
      if (state.packSize != null) packSizeEl.value = state.packSize;
      packSizeEl.addEventListener('input', () => {
        state.packSize = packSizeEl.value === '' ? null : packSizeEl.value;
      });
      const packSizeHint = document.createElement('p');
      packSizeHint.className = 'mic-hint';
      packSizeHint.textContent = 'Flags Low once it drops to 25% or less of this.';
      packSizeRow.appendChild(packSizeLabel);
      packSizeRow.appendChild(packSizeEl);
      packSizeRow.appendChild(packSizeHint);

      // Once the name (and location) match an existing item, its own
      // unit/location/category/weight-volume-unit are already known —
      // no need to retype facts about an item the app already tracks.
      // Only re-syncs when the match changes to a different item, so it
      // never fights an edit you've made since the last match.
      let lastMatchedId = null;
      function syncFieldsFromMatch() {
        const match = findMatchingItem(state.name, state.location);
        if (!match) {
          lastMatchedId = null;
          return;
        }
        if (match.id === lastMatchedId) return;
        lastMatchedId = match.id;
        if (match.unit) {
          state.unit = match.unit;
          setDropdownValue(unitEl, match.unit);
        }
        if (match.location) {
          state.location = match.location;
          locEl.value = match.location;
        }
        if (match.category) {
          state.category = match.category;
          catEl.value = match.category;
        }
        if (match.fullnessUnit) {
          state.fullnessUnit = match.fullnessUnit;
          setDropdownValue(wvUnitEl, match.fullnessUnit);
        }
        if (match.packSize != null) {
          state.packSize = match.packSize;
          packSizeEl.value = match.packSize;
        }
        refreshToggle(); // unit may have just changed — keep the "per <unit>" label in sync
      }

      refreshToggle(); // now that weightVolRow/weightVolLabel/wvAmountEl exist, set their initial text/state
      syncFieldsFromMatch(); // and now that every synced field exists, pick up an initial match if there is one

      const note = document.createElement('p');
      note.className = 'review-note hidden';

      const buttons = document.createElement('div');
      buttons.className = 'review-card-buttons';
      const confirmBtn = document.createElement('button');
      confirmBtn.type = 'button';
      confirmBtn.className = 'btn btn-primary';
      confirmBtn.textContent = 'Confirm';
      const dismissBtn = document.createElement('button');
      dismissBtn.type = 'button';
      dismissBtn.className = 'btn btn-secondary';
      dismissBtn.textContent = 'Discard';

      dismissBtn.addEventListener('click', () => {
        card.remove();
        if (!voiceReviewEl.children.length) voiceReviewEl.classList.add('hidden');
      });

      // Deleting an item entirely only happens here, in − Use item — the
      // main inventory list is view-only (name/expiration/low flag) with
      // no add/use/delete controls on the card itself.
      let deleteBtn = null;
      if (lockedToUse) {
        deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'btn btn-danger';
        deleteBtn.textContent = 'Delete item';
        deleteBtn.addEventListener('click', async () => {
          const match = findMatchingItem(state.name, state.location);
          if (!match) {
            note.textContent = `No existing item named "${state.name}" to delete.`;
            note.classList.remove('hidden');
            return;
          }
          const deleted = await deleteItem(match.id, match.name);
          if (!deleted) return;
          card.remove();
          if (!voiceReviewEl.children.length) voiceReviewEl.classList.add('hidden');
        });
      }

      confirmBtn.addEventListener('click', async () => {
        confirmBtn.disabled = true;
        note.classList.add('hidden');
        try {
          if (!state.name.trim()) throw new Error('Item name is required.');
          if (state.action === 'use') {
            const match = findMatchingItem(state.name, state.location);
            if (!match) {
              throw new Error(
                lockedToUse
                  ? `No existing item named "${state.name}" to use. Add it via + Add item first.`
                  : `No existing item named "${state.name}" to use. Switch to Add, or add it first.`
              );
            }
            // "Weight/volume used", when filled in, is the deduction to
            // make (in that field's unit) — it takes priority over the
            // plain Qty/Unit fields, which stay the fallback for whole-
            // count items (e.g. "3 eggs") that aren't measured this way.
            let amount = state.quantity;
            let unit = state.unit;
            if (state.weightVolumeUsedAmount) {
              amount = Number(state.weightVolumeUsedAmount);
              if (!Number.isFinite(amount) || amount < 0) {
                throw new Error('Enter a valid weight/volume amount used.');
              }
              unit = state.fullnessUnit || unit;
            }
            // /use is unit-aware: if the matched item tracks container
            // fullness (e.g. a bottle) and this unit converts to it (same
            // family — weight or volume), it deducts from that instead of
            // the whole-item count. Otherwise it's a plain count decrement,
            // same as before.
            const updated = await api(`/api/items/${match.id}/use`, {
              method: 'POST',
              body: JSON.stringify({ amount, unit }),
            });
            const i = items.findIndex((it) => it.id === updated.id);
            if (i !== -1) items[i] = updated;
            showToast(`Used ${formatQty(amount)}${unit ? ' ' + unit : ''} ${state.name}`.trim());
          } else {
            const saved = await api('/api/items', {
              method: 'POST',
              body: JSON.stringify({
                name: state.name,
                quantity: state.quantity,
                unit: state.unit,
                location: state.location,
                category: state.category,
                expirationDate: state.expirationDate,
                fullnessUnit: state.fullnessUnit,
                fullnessAmount: state.fullnessAmount,
                fullnessTotal: state.fullnessTotal,
                packSize: state.packSize,
              }),
            });
            const i = items.findIndex((it) => it.id === saved.id);
            if (i === -1) items.push(saved);
            else items[i] = saved;
            showToast(`Added ${state.name}`);
          }
          render();
          card.remove();
          if (!voiceReviewEl.children.length) {
            voiceReviewEl.classList.add('hidden');
            voiceTextInput.value = '';
          }
        } catch (err) {
          note.textContent = err.message;
          note.classList.remove('hidden');
        } finally {
          confirmBtn.disabled = false;
        }
      });

      buttons.appendChild(confirmBtn);
      buttons.appendChild(dismissBtn);
      if (deleteBtn) buttons.appendChild(deleteBtn);

      card.appendChild(header);
      card.appendChild(unitRow);
      card.appendChild(weightVolRow);
      card.appendChild(packSizeRow);
      card.appendChild(qtyRow);
      card.appendChild(catLocRow);
      card.appendChild(expRow);
      card.appendChild(note);
      card.appendChild(buttons);
      voiceReviewEl.appendChild(card);
    });

    if (parsedItems.length === 0) {
      voiceReviewEl.innerHTML = '<p class="review-note">Couldn\'t find any items in that. Try rephrasing.</p>';
    }
  }

  // --- CSV export/import --------------------------------------------------
  //
  // Export is a plain link — the server sets a download header, so the
  // browser just saves the file, no JS needed. Import is a two-step
  // review-then-commit flow, the same "nothing saves until you confirm"
  // spirit as every other entry method: pick a file, see exactly what
  // will be added, changed, and deleted, then apply. The spreadsheet is
  // treated as the complete picture, so anything missing from it gets
  // deleted — the one destructive step in this app that isn't a single
  // explicit "delete this item" tap, so it's called out in its own
  // section (styled like the danger button elsewhere) rather than mixed
  // in with ordinary changes, plus a second confirm() prompt right
  // before it's applied.

  let pendingImportCsv = null;
  let pendingImportPlan = null;

  function buildImportReviewSection(heading, names, danger) {
    if (names.length === 0) return null;
    const section = document.createElement('div');
    const headingEl = document.createElement('p');
    headingEl.className = danger ? 'import-review-section-heading danger' : 'import-review-section-heading';
    headingEl.textContent = `${heading} (${names.length})`;
    const list = document.createElement('ul');
    list.className = danger ? 'import-review-list danger' : 'import-review-list';
    for (const name of names) {
      const li = document.createElement('li');
      li.textContent = name;
      list.appendChild(li);
    }
    section.appendChild(headingEl);
    section.appendChild(list);
    return section;
  }

  function renderImportReview(plan) {
    importReviewScroll.innerHTML = '';
    const totalChanges = plan.toAdd.length + plan.toUpdate.length + plan.toDelete.length;
    importReviewSummary.textContent =
      totalChanges === 0 && plan.errors.length === 0
        ? 'No changes — this file matches your inventory exactly.'
        : `${plan.toAdd.length} to add, ${plan.toUpdate.length} to update, ${plan.toDelete.length} to delete.`;

    const sections = [
      buildImportReviewSection(
        "Rows with problems — not applied, and if they reference an existing item, it'll still be deleted below unless you fix and re-upload",
        plan.errors.map((e) => `Row ${e.rowNumber}: ${e.error}`),
        true
      ),
      buildImportReviewSection('Will be deleted', plan.toDelete.map((i) => i.name), true),
      buildImportReviewSection('Will be updated', plan.toUpdate.map((i) => i.name), false),
      buildImportReviewSection('New items', plan.toAdd.map((i) => i.fields.name), false),
    ];
    for (const section of sections) {
      if (section) importReviewScroll.appendChild(section);
    }
    importConfirmBtn.disabled = totalChanges === 0;
  }

  function closeImportReview() {
    importReviewModal.classList.add('hidden');
    pendingImportCsv = null;
    pendingImportPlan = null;
  }

  importCsvBtn.addEventListener('click', () => importCsvInput.click());

  importCsvInput.addEventListener('change', async () => {
    const file = importCsvInput.files && importCsvInput.files[0];
    importCsvInput.value = ''; // allow re-selecting the same file even after an error
    if (!file) return;
    try {
      const text = await file.text();
      const plan = await api('/api/items/import/preview', {
        method: 'POST',
        body: JSON.stringify({ csv: text }),
      });
      pendingImportCsv = text;
      pendingImportPlan = plan;
      renderImportReview(plan);
      importReviewModal.classList.remove('hidden');
    } catch (err) {
      showToast(`Couldn't read that file: ${err.message}`);
    }
  });

  importCancelBtn.addEventListener('click', closeImportReview);

  importConfirmBtn.addEventListener('click', async () => {
    if (!pendingImportCsv || !pendingImportPlan) return;
    const { toDelete } = pendingImportPlan;
    if (toDelete.length > 0) {
      const shown = toDelete.slice(0, 10).map((i) => i.name).join(', ');
      const more = toDelete.length > 10 ? `, and ${toDelete.length - 10} more` : '';
      const ok = confirm(
        `This will DELETE ${toDelete.length} item${toDelete.length === 1 ? '' : 's'} not in the ` +
        `file: ${shown}${more}. This can't be undone. Continue?`
      );
      if (!ok) return;
    }
    importConfirmBtn.disabled = true;
    try {
      const result = await api('/api/items/import/commit', {
        method: 'POST',
        body: JSON.stringify({ csv: pendingImportCsv }),
      });
      closeImportReview();
      await loadItems();
      showToast(`Import complete: ${result.added} added, ${result.updated} updated, ${result.deleted} deleted`);
    } catch (err) {
      showToast(`Import failed: ${err.message}`);
    } finally {
      importConfirmBtn.disabled = false;
    }
  });

  loadCategories().then(loadItems);
})();
