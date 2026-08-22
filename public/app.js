(() => {
  const listEl = document.getElementById('item-list');
  const emptyStateEl = document.getElementById('empty-state');
  const statusLineEl = document.getElementById('status-line');
  const entryModeButtons = document.getElementById('entry-mode-buttons');
  const modeAddBtn = document.getElementById('mode-add-btn');
  const modeUseBtn = document.getElementById('mode-use-btn');
  const quickInputPanel = document.getElementById('quick-input-panel');
  const addForm = document.getElementById('add-form');
  const entryFormTitle = document.getElementById('entry-form-title');
  const entryCancelBtn = document.getElementById('entry-cancel-btn');
  const entrySubmitBtn = document.getElementById('entry-submit-btn');
  const nameInput = document.getElementById('item-name');
  const nameOptionsEl = document.getElementById('item-name-options');
  const qtyInput = document.getElementById('item-qty');
  const unitInput = document.getElementById('item-unit');
  const locationSelect = document.getElementById('item-location');
  const categorySelect = document.getElementById('item-category');
  const expirationInput = document.getElementById('item-expiration');
  // "Weight/volume" — Add-only. Describes the size of a single item
  // (e.g. a 16 oz bottle); a newly (re)stocked item is assumed to start
  // full, so this doubles as both the total size and the current amount
  // — see submitAdd(). Only applies while quantity is 1.
  const weightVolumeWrap = document.getElementById('weight-volume-wrap');
  const weightVolumeInput = document.getElementById('item-weight-volume');
  const weightVolumeUnitInput = document.getElementById('item-weight-volume-unit');
  // "Amount used" — Use-only. Drives the deduction; the running total
  // it deducts from (the weight/volume set above, whenever an item has
  // one) is never shown here — see the README.
  const amountUsedWrap = document.getElementById('amount-used-wrap');
  const amountUsedInput = document.getElementById('item-amount-used');
  const amountUsedUnitInput = document.getElementById('item-amount-used-unit');
  const tabsEl = document.getElementById('category-tabs');
  const searchInput = document.getElementById('search');
  const toastEl = document.getElementById('toast');

  const voiceForm = document.getElementById('voice-form');
  const voiceTextInput = document.getElementById('voice-text');
  const micBtn = document.getElementById('mic-btn');
  const micHint = document.getElementById('mic-hint');
  const voiceReviewEl = document.getElementById('voice-review');

  const barcodeBtn = document.getElementById('barcode-btn');
  const barcodeHint = document.getElementById('barcode-hint');
  const barcodeModal = document.getElementById('barcode-modal');
  const barcodeVideo = document.getElementById('barcode-video');
  const barcodeStatus = document.getElementById('barcode-status');
  const barcodeCancelBtn = document.getElementById('barcode-cancel');

  const receiptInput = document.getElementById('receipt-input');
  const receiptCameraBtn = document.getElementById('receipt-camera-btn');
  const receiptStatus = document.getElementById('receipt-status');

  const recipeBtn = document.getElementById('recipe-btn');
  const recipePanel = document.getElementById('recipe-panel');
  const recipeTextInput = document.getElementById('recipe-text');
  const recipeParseBtn = document.getElementById('recipe-parse-btn');
  const recipeImageInput = document.getElementById('recipe-image-input');
  const recipeCameraBtn = document.getElementById('recipe-camera-btn');
  const recipeStatus = document.getElementById('recipe-status');

  const photoCaptureModal = document.getElementById('photo-capture-modal');
  const photoCaptureVideo = document.getElementById('photo-capture-video');
  const photoCaptureCanvas = document.getElementById('photo-capture-canvas');
  const photoCaptureStatus = document.getElementById('photo-capture-status');
  const photoCaptureBtn = document.getElementById('photo-capture-btn');
  const photoCaptureCancelBtn = document.getElementById('photo-capture-cancel');

  let items = [];
  let categories = []; // [{id, label}], loaded from the server
  let categoryLabels = {};
  let activeCategory = 'all';
  let searchTerm = '';
  let toastTimer = null;
  let editingId = null; // id of the item currently shown as an edit form, if any
  const collapsedCategories = {}; // categoryId -> true if its section is collapsed in the "All" view
  let entryMode = null; // 'add' | 'use' | null (fields hidden until one is chosen)

  // Low-stock rules, checked in priority order by getLowStockBadge() below:
  // an item's own pack-size/%-full tracking (if set) wins over the
  // canned-food/beverage defaults, which win over the flat fallback.
  const LOW_STOCK_THRESHOLD = 1; // fallback for anything not covered below
  const PACK_LOW_FRACTION = 0.25; // pack-tracked items: low at <=25% of the original pack left
  const BOTTLE_LOW_PERCENT = 50; // single-container items: low at <=50% full (i.e. half or more used)
  const CANNED_FOOD_LOW_QTY = 2; // canned food: low at 2 or fewer cans
  const CANNED_BEVERAGE_LOW_QTY = 4; // canned beverages: low at 4 or fewer cans
  // An item expiring within this many days gets the amber "soon" badge.
  const EXPIRING_SOON_DAYS = 3;

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

    return item.quantity <= LOW_STOCK_THRESHOLD ? 'Low' : null;
  }

  function daysUntil(dateStr) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [y, m, d] = dateStr.split('-').map(Number);
    const target = new Date(y, m - 1, d);
    return Math.round((target - today) / 86400000);
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
        const opt = document.createElement('option');
        opt.value = cat.id;
        opt.textContent = cat.label;
        categorySelect.appendChild(opt);

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

  // Container fullness only makes sense for exactly one item that isn't
  // itself being tracked as a multi-pack — hide it (and clear any values)
  // whenever quantity isn't 1 or a pack size is set. Shared by the Add
  // form and every inline edit form.
  function wireFullnessVisibility(qtyEl, packEl, wrapEl, unitEl, remainingEl, totalEl) {
    function sync() {
      const applies = Number(qtyEl.value) === 1 && !(packEl && packEl.value);
      wrapEl.classList.toggle('hidden', !applies);
      if (!applies) {
        unitEl.value = '';
        remainingEl.value = '';
        remainingEl.placeholder = 'Remaining';
        totalEl.value = '';
        totalEl.readOnly = false;
      }
    }
    qtyEl.addEventListener('input', sync);
    if (packEl) packEl.addEventListener('input', sync);
    sync();
  }

  // The fields are hidden until you pick + Add or − Use; picking one
  // reveals the same shared form, styled and labeled for that action,
  // with only the Add- or Use-specific fields showing.
  function resetEntryForm() {
    nameInput.value = '';
    qtyInput.value = '1';
    unitInput.value = '';
    categorySelect.value = '';
    expirationInput.value = '';
    weightVolumeInput.value = '';
    weightVolumeUnitInput.value = '';
    amountUsedInput.value = '';
    amountUsedUnitInput.value = '';
  }

  // Weight/volume only makes sense in Add mode, for exactly one item —
  // hide it (and clear any value) otherwise.
  function syncWeightVolumeVisibility() {
    const applies = entryMode === 'add' && Number(qtyInput.value) === 1;
    weightVolumeWrap.classList.toggle('hidden', !applies);
    if (!applies) {
      weightVolumeInput.value = '';
      weightVolumeUnitInput.value = '';
    }
  }
  qtyInput.addEventListener('input', syncWeightVolumeVisibility);

  // The quick-input methods (voice/text, barcode, receipt, recipe) stay
  // out of the way with everything else until a mode is picked, same as
  // the manual fields — Add reveals text/mic/submit, barcode, and
  // receipt; Use reveals all of those plus recipe ingredients, since a
  // recipe's ingredients are meant to be used up.
  function openEntryForm(mode) {
    entryMode = mode;
    const isAdd = mode === 'add';
    entryModeButtons.classList.add('hidden');
    quickInputPanel.classList.remove('hidden');
    addForm.classList.remove('hidden');
    recipeBtn.classList.toggle('hidden', isAdd);
    if (isAdd) recipePanel.classList.add('hidden'); // close it if it was left open from Use mode
    entryFormTitle.textContent = isAdd ? '+ Add item' : '− Use item';
    entrySubmitBtn.textContent = isAdd ? '+ Add item' : '− Use item';
    entrySubmitBtn.className = `btn btn-full ${isAdd ? 'btn-primary' : 'btn-danger'}`;
    amountUsedWrap.classList.toggle('hidden', isAdd);
    syncWeightVolumeVisibility();
    nameInput.focus();
  }

  function closeEntryForm() {
    entryMode = null;
    quickInputPanel.classList.add('hidden');
    addForm.classList.add('hidden');
    entryModeButtons.classList.remove('hidden');
    resetEntryForm();
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

  // Keeps the item-name field's suggestion list in sync with what's
  // actually in inventory, so typing a few letters of "S. Pellegrino"
  // offers the exact stored name to pick — avoiding the mismatched-name
  // errors that come from retyping it slightly differently (punctuation,
  // spacing, a typo) each time you go to use it.
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
    // render the flat list with no grouping/collapsing.
    if (activeCategory !== 'all') {
      for (const item of filtered) {
        listEl.appendChild(item.id === editingId ? renderEditForm(item) : renderItem(item));
      }
      return;
    }

    // "All" view: group by category (preserving the server's ordering
    // within each group — expiration/low-stock first), with a clickable,
    // collapsible heading per group so a long category list can be
    // tucked away without leaving the "All" view.
    const groups = new Map();
    for (const item of filtered) {
      if (!groups.has(item.category)) groups.set(item.category, []);
      groups.get(item.category).push(item);
    }

    for (const [category, groupItems] of groups) {
      const collapsed = !!collapsedCategories[category];

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
          listEl.appendChild(item.id === editingId ? renderEditForm(item) : renderItem(item));
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
    nameEl.setAttribute('aria-label', `Edit ${item.name}`);
    nameEl.addEventListener('click', () => {
      editingId = item.id;
      render();
    });

    const metaEl = document.createElement('div');
    metaEl.className = 'item-meta';
    const pill = document.createElement('span');
    pill.className = 'location-pill';
    pill.textContent = item.location;
    metaEl.appendChild(pill);
    if (item.unit) {
      const unitSpan = document.createElement('span');
      unitSpan.textContent = item.unit;
      metaEl.appendChild(unitSpan);
    }
    if (item.fullnessAmount != null && item.fullnessTotal != null) {
      const fullnessBadge = document.createElement('span');
      fullnessBadge.className = 'fullness-badge';
      const unitSuffix = item.fullnessUnit ? ` ${item.fullnessUnit}` : '';
      fullnessBadge.textContent = `${formatQty(item.fullnessAmount)}/${formatQty(item.fullnessTotal)}${unitSuffix}`;
      metaEl.appendChild(fullnessBadge);
    }
    const lowLabel = getLowStockBadge(item);
    if (lowLabel) {
      const lowBadge = document.createElement('span');
      lowBadge.className = 'low-stock-badge';
      lowBadge.textContent = lowLabel;
      metaEl.appendChild(lowBadge);
    }
    if (item.expirationDate) {
      const { text, className } = formatExpiration(item.expirationDate);
      const expBadge = document.createElement('span');
      expBadge.className = `expiry-badge ${className}`;
      expBadge.textContent = text;
      metaEl.appendChild(expBadge);
    }

    info.appendChild(nameEl);
    info.appendChild(metaEl);

    const controls = document.createElement('div');
    controls.className = 'qty-controls';

    const useBtn = document.createElement('button');
    useBtn.type = 'button';
    useBtn.className = 'qty-btn use';
    useBtn.setAttribute('aria-label', `Use one ${item.name}`);
    useBtn.textContent = '−'; // minus sign
    useBtn.addEventListener('click', () => adjustItem(item.id, -1));

    const qtyEl = document.createElement('span');
    qtyEl.className = 'qty-value' + (item.quantity <= 0 ? ' item-qty zero' : ' item-qty');
    qtyEl.textContent = formatQty(item.quantity);

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'qty-btn';
    addBtn.setAttribute('aria-label', `Add one ${item.name}`);
    addBtn.textContent = '+';
    addBtn.addEventListener('click', () => adjustItem(item.id, 1));

    controls.appendChild(useBtn);
    controls.appendChild(qtyEl);
    controls.appendChild(addBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'delete-btn';
    deleteBtn.setAttribute('aria-label', `Delete ${item.name}`);
    deleteBtn.textContent = '✕'; // multiplication x
    deleteBtn.addEventListener('click', () => deleteItem(item.id, item.name));

    li.appendChild(info);
    li.appendChild(controls);
    li.appendChild(deleteBtn);
    return li;
  }

  // Inline edit form shown in place of an item card when its name is
  // tapped. Same fields as the Add form, pre-filled with the item's
  // current values. Nothing is saved until Save is pressed.
  function renderEditForm(item) {
    const li = document.createElement('li');
    li.className = 'item-card item-edit-card';
    li.dataset.id = item.id;

    const form = document.createElement('form');
    form.className = 'edit-form';

    const nameRow = document.createElement('div');
    nameRow.className = 'field-row';
    const nameInputEl = document.createElement('input');
    nameInputEl.type = 'text';
    nameInputEl.value = item.name;
    nameInputEl.required = true;
    nameInputEl.setAttribute('aria-label', 'Item name');
    nameRow.appendChild(nameInputEl);

    const fieldsRow = document.createElement('div');
    fieldsRow.className = 'field-row two-up';
    const qtyEl = document.createElement('input');
    qtyEl.type = 'number';
    qtyEl.min = '0';
    qtyEl.step = 'any';
    qtyEl.value = item.quantity;
    qtyEl.required = true;
    qtyEl.setAttribute('aria-label', 'Quantity');
    const unitEl = document.createElement('input');
    unitEl.type = 'text';
    unitEl.value = item.unit || '';
    unitEl.placeholder = 'Unit';
    unitEl.setAttribute('aria-label', 'Unit');
    fieldsRow.appendChild(qtyEl);
    fieldsRow.appendChild(unitEl);

    const fieldsRow2 = document.createElement('div');
    fieldsRow2.className = 'field-row two-up';
    const locEl = document.createElement('select');
    locEl.setAttribute('aria-label', 'Location');
    ['pantry', 'fridge', 'freezer'].forEach((loc) => {
      const opt = document.createElement('option');
      opt.value = loc;
      opt.textContent = loc[0].toUpperCase() + loc.slice(1);
      if (loc === item.location) opt.selected = true;
      locEl.appendChild(opt);
    });
    const catEl = document.createElement('select');
    catEl.setAttribute('aria-label', 'Category');
    categories.forEach((cat) => {
      const opt = document.createElement('option');
      opt.value = cat.id;
      opt.textContent = cat.label;
      if (cat.id === item.category) opt.selected = true;
      catEl.appendChild(opt);
    });
    fieldsRow2.appendChild(locEl);
    fieldsRow2.appendChild(catEl);

    const expRow = document.createElement('div');
    expRow.className = 'field-row';
    const expLabel = document.createElement('label');
    expLabel.className = 'field-label';
    expLabel.textContent = 'Expiration date (optional)';
    const expEl = document.createElement('input');
    expEl.type = 'date';
    expEl.setAttribute('aria-label', 'Expiration date');
    if (item.expirationDate) expEl.value = item.expirationDate;
    expRow.appendChild(expLabel);
    expRow.appendChild(expEl);

    const lowStockDetails = document.createElement('details');
    lowStockDetails.className = 'low-stock-details';
    const lowStockSummary = document.createElement('summary');
    lowStockSummary.textContent = 'Low-stock tracking (optional)';

    const packRow = document.createElement('div');
    packRow.className = 'field-row';
    const packLabel = document.createElement('label');
    packLabel.className = 'field-label';
    packLabel.textContent = 'Pack size';
    const packEl = document.createElement('input');
    packEl.type = 'number';
    packEl.min = '1';
    packEl.step = 'any';
    packEl.placeholder = 'e.g. 24';
    if (item.packSize != null) packEl.value = item.packSize;
    packRow.appendChild(packLabel);
    packRow.appendChild(packEl);

    const fullnessWrapEl = document.createElement('div');
    fullnessWrapEl.className = 'field-row';
    const fullnessLabel = document.createElement('label');
    fullnessLabel.className = 'field-label';
    fullnessLabel.textContent = 'Container fullness (single item, no pack size)';
    const fullnessRow = document.createElement('div');
    fullnessRow.className = 'field-row three-up';

    const unitEl2 = document.createElement('select');
    unitEl2.setAttribute('aria-label', 'Fullness unit');
    [
      ['', 'Unit'], ['oz', 'oz'], ['fl oz', 'fl oz'], ['ml', 'ml'],
      ['L', 'L'], ['g', 'g'], ['kg', 'kg'], ['lb', 'lb'],
    ].forEach(([value, label]) => {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = label;
      if (value === (item.fullnessUnit || '')) opt.selected = true;
      unitEl2.appendChild(opt);
    });

    const remainingEl = document.createElement('input');
    remainingEl.type = 'number';
    remainingEl.min = '0';
    remainingEl.step = 'any';
    remainingEl.placeholder = 'Remaining';
    if (item.fullnessAmount != null) remainingEl.value = item.fullnessAmount;

    const totalEl = document.createElement('input');
    totalEl.type = 'number';
    totalEl.min = '0';
    totalEl.step = 'any';
    totalEl.placeholder = 'Total size';
    if (item.fullnessTotal != null) totalEl.value = item.fullnessTotal;

    fullnessRow.appendChild(unitEl2);
    fullnessRow.appendChild(remainingEl);
    fullnessRow.appendChild(totalEl);
    fullnessWrapEl.appendChild(fullnessLabel);
    fullnessWrapEl.appendChild(fullnessRow);

    lowStockDetails.appendChild(lowStockSummary);
    lowStockDetails.appendChild(packRow);
    lowStockDetails.appendChild(fullnessWrapEl);
    if (item.packSize != null || item.percentFull != null) lowStockDetails.open = true;
    wireFullnessVisibility(qtyEl, packEl, fullnessWrapEl, unitEl2, remainingEl, totalEl);

    const note = document.createElement('p');
    note.className = 'review-note hidden';

    const buttons = document.createElement('div');
    buttons.className = 'review-card-buttons';
    const saveBtn = document.createElement('button');
    saveBtn.type = 'submit';
    saveBtn.className = 'btn btn-primary';
    saveBtn.textContent = 'Save';
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => {
      editingId = null;
      render();
    });
    buttons.appendChild(saveBtn);
    buttons.appendChild(cancelBtn);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = nameInputEl.value.trim();
      const quantity = Number(qtyEl.value);
      if (!name) {
        note.textContent = 'Item name is required.';
        note.classList.remove('hidden');
        return;
      }
      if (!Number.isFinite(quantity) || quantity < 0) {
        note.textContent = 'Enter a valid quantity.';
        note.classList.remove('hidden');
        return;
      }
      saveBtn.disabled = true;
      note.classList.add('hidden');
      try {
        const updated = await api(`/api/items/${item.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name,
            quantity,
            unit: unitEl.value.trim(),
            location: locEl.value,
            category: catEl.value,
            expirationDate: expEl.value || '',
            packSize: packEl.value || '',
            fullnessUnit: unitEl2.value || '',
            fullnessAmount: remainingEl.value || '',
            fullnessTotal: totalEl.value || '',
          }),
        });
        const idx = items.findIndex((i) => i.id === updated.id);
        if (idx !== -1) items[idx] = updated;
        editingId = null;
        render();
        showToast(`Saved ${updated.name}`);
      } catch (err) {
        note.textContent = err.message;
        note.classList.remove('hidden');
      } finally {
        saveBtn.disabled = false;
      }
    });

    form.appendChild(nameRow);
    form.appendChild(fieldsRow);
    form.appendChild(fieldsRow2);
    form.appendChild(expRow);
    form.appendChild(lowStockDetails);
    form.appendChild(note);
    form.appendChild(buttons);
    li.appendChild(form);
    return li;
  }

  async function adjustItem(id, delta) {
    const idx = items.findIndex((i) => i.id === id);
    if (idx === -1) return;
    // Optimistic update
    const prevQty = items[idx].quantity;
    items[idx].quantity = Math.max(0, prevQty + delta);
    render();
    try {
      const updated = await api(`/api/items/${id}/adjust`, {
        method: 'POST',
        body: JSON.stringify({ delta }),
      });
      const i = items.findIndex((it) => it.id === id);
      if (i !== -1) items[i] = updated;
      render();
    } catch (err) {
      items[idx].quantity = prevQty;
      render();
      showToast(`Couldn't update: ${err.message}`);
    }
  }

  async function deleteItem(id, name) {
    if (!confirm(`Remove "${name}" from your inventory?`)) return;
    const prevItems = items;
    items = items.filter((i) => i.id !== id);
    render();
    try {
      await api(`/api/items/${id}`, { method: 'DELETE' });
      showToast(`Removed ${name}`);
    } catch (err) {
      items = prevItems;
      render();
      showToast(`Couldn't remove: ${err.message}`);
    }
  }

  async function submitAdd() {
    const name = nameInput.value.trim();
    const quantity = Number(qtyInput.value);
    const unit = unitInput.value.trim();
    const location = locationSelect.value;
    const category = categorySelect.value || undefined; // empty = let server guess
    const expirationDate = expirationInput.value || undefined;
    // Weight/volume describes a single item's size (e.g. "16 oz") — a
    // newly (re)stocked item is assumed to start full, so the same value
    // is sent as both the total size and the current amount. Leaving it
    // blank sends nothing, so the server keeps whatever weight/volume
    // that item already has on file untouched.
    const sizeAmount = weightVolumeInput.value || undefined;
    const fullnessUnit = sizeAmount ? (weightVolumeUnitInput.value || undefined) : undefined;
    const fullnessAmount = sizeAmount;
    const fullnessTotal = sizeAmount;

    if (!name) return;
    if (!Number.isFinite(quantity) || quantity < 0) {
      showToast('Enter a valid quantity.');
      return;
    }

    entrySubmitBtn.disabled = true;
    try {
      const saved = await api('/api/items', {
        method: 'POST',
        body: JSON.stringify({
          name, quantity, unit, location, category, expirationDate,
          fullnessUnit, fullnessAmount, fullnessTotal,
        }),
      });
      const idx = items.findIndex((i) => i.id === saved.id);
      if (idx === -1) items.push(saved);
      else items[idx] = saved;
      render();
      showToast(`Added ${name}`);
      resetEntryForm();
      nameInput.focus();
    } catch (err) {
      showToast(`Couldn't add item: ${err.message}`);
    } finally {
      entrySubmitBtn.disabled = false;
    }
  }

  // "Use item" mirrors "+ Add item" — same name/qty/location fields, but
  // subtracts from an existing item instead of creating/adding to one.
  // Matches the existing voice-review "Use" flow: if nothing matches, it
  // says so rather than guessing or silently creating a phantom item.
  async function submitUse() {
    const name = nameInput.value.trim();
    const quantity = Number(qtyInput.value);
    const unit = unitInput.value.trim();
    const location = locationSelect.value;

    if (!name) {
      showToast('Enter an item name.');
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      showToast('Enter a valid quantity to use.');
      return;
    }

    const match = findMatchingItem(name, location);
    if (!match) {
      showToast(`No existing item named "${name}" to use. Add it first.`);
      return;
    }

    // "Amount used", when filled in, is the deduction to make (in that
    // field's unit) — it takes priority over the plain Qty/Unit fields
    // above, which stay the fallback for whole-count items (e.g. "3
    // eggs") that don't track a measured fullness at all.
    let effectiveAmount = quantity;
    let effectiveUnit = unit;
    if (amountUsedInput.value.trim()) {
      const usedAmount = Number(amountUsedInput.value);
      if (!Number.isFinite(usedAmount) || usedAmount < 0) {
        showToast('Enter a valid amount used.');
        return;
      }
      effectiveAmount = usedAmount;
      effectiveUnit = amountUsedUnitInput.value || unit;
    }

    entrySubmitBtn.disabled = true;
    try {
      // /use is unit-aware: if the matched item tracks container fullness
      // (e.g. a bottle) and this unit converts to it (same family — weight
      // or volume), it deducts from that instead of the whole-item count.
      // Whichever way it lands, the server works out what's left — this
      // form never asks for a remaining amount, only how much was used.
      const updated = await api(`/api/items/${match.id}/use`, {
        method: 'POST',
        body: JSON.stringify({ amount: effectiveAmount, unit: effectiveUnit }),
      });
      const idx = items.findIndex((i) => i.id === updated.id);
      if (idx !== -1) items[idx] = updated;
      render();
      const usedText = `Used ${formatQty(effectiveAmount)}${effectiveUnit ? ' ' + effectiveUnit : ''} ${match.name}`.trim();
      const leftText = updated.fullnessAmount != null && updated.fullnessTotal != null
        ? ` — ${formatQty(updated.fullnessAmount)}/${formatQty(updated.fullnessTotal)}${updated.fullnessUnit ? ' ' + updated.fullnessUnit : ''} left`
        : ` — ${formatQty(updated.quantity)} left`;
      showToast(usedText + leftText);
      resetEntryForm();
      nameInput.focus();
    } catch (err) {
      showToast(`Couldn't use item: ${err.message}`);
    } finally {
      entrySubmitBtn.disabled = false;
    }
  }

  addForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (entryMode === 'use') submitUse();
    else submitAdd();
  });

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

  // Picking a specific category in the "Add an item" form also switches
  // the list's filter tab to match, so you immediately see where it
  // landed. "Auto" has no single category to switch to, so it's a no-op.
  categorySelect.addEventListener('change', () => {
    if (categorySelect.value) setActiveCategory(categorySelect.value);
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
          location: 'pantry',
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

  // --- Recipe ingredient entry --------------------------------------------
  //
  // The opposite direction of receipt scanning: a recipe's ingredients get
  // USED from inventory, not added. Same review-card flow either way (with
  // the Add/Use toggle available per line, in case one should go the other
  // way). Text can be typed/pasted directly, or read from a photo via the
  // same on-device OCR as receipt scanning.

  if (!hasTesseract) {
    recipeImageInput.disabled = true;
  }

  recipeBtn.addEventListener('click', () => {
    recipePanel.classList.toggle('hidden');
    if (!recipePanel.classList.contains('hidden')) recipeTextInput.focus();
  });

  async function parseRecipeText(text) {
    const result = await api('/api/recipe/parse', {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
    voiceReviewEl.classList.remove('hidden');
    renderReview(result.items);
    showToast(`Found ${result.items.length} ingredient${result.items.length === 1 ? '' : 's'}`);
  }

  recipeParseBtn.addEventListener('click', async () => {
    const text = recipeTextInput.value.trim();
    if (!text) {
      showToast('Type or paste some ingredients first.');
      return;
    }
    recipeParseBtn.disabled = true;
    try {
      await parseRecipeText(text);
      recipeTextInput.value = '';
    } catch (err) {
      showToast(err.message);
    } finally {
      recipeParseBtn.disabled = false;
    }
  });

  async function processRecipeImageFile(file) {
    if (!file) return;
    try {
      const text = await runOcr(file, recipeStatus);
      recipeStatus.textContent = 'Finding ingredients…';
      await parseRecipeText(text);
    } catch (err) {
      showToast(`Couldn't read that photo: ${err.message}`);
    } finally {
      recipeStatus.classList.add('hidden');
    }
  }

  recipeImageInput.addEventListener('change', async () => {
    const file = recipeImageInput.files && recipeImageInput.files[0];
    if (!file) return;
    await processRecipeImageFile(file);
    recipeImageInput.value = ''; // allow re-selecting the same file
  });

  if (hasCamera && hasTesseract) {
    recipeCameraBtn.classList.remove('hidden');
  }
  recipeCameraBtn.addEventListener('click', async () => {
    const blob = await captureFromCamera('Line up the recipe, then tap Capture');
    if (blob) await processRecipeImageFile(blob);
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

  function findMatchingItem(name, location) {
    const lower = name.trim().toLowerCase();
    return (
      items.find((i) => i.name.toLowerCase() === lower && i.location === location) ||
      items.find((i) => i.name.toLowerCase() === lower)
    );
  }

  function renderReview(parsedItems) {
    voiceReviewEl.innerHTML = '';

    parsedItems.forEach((parsed, idx) => {
      const state = { ...parsed };
      const card = document.createElement('div');
      card.className = 'review-card';

      const header = document.createElement('div');
      header.className = 'review-card-header';

      const nameInputEl = document.createElement('input');
      nameInputEl.type = 'text';
      nameInputEl.value = state.name;
      nameInputEl.setAttribute('aria-label', 'Item name');
      nameInputEl.style.flex = '1';
      nameInputEl.addEventListener('input', () => (state.name = nameInputEl.value));

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
      function refreshToggle() {
        addToggleBtn.classList.toggle('active', state.action === 'add');
        useToggleBtn.classList.toggle('active', state.action === 'use');
        // Weight/volume (a new item's size) only makes sense on Add,
        // same as the + Add item card — declared further down, but this
        // function isn't actually called until after it exists.
        weightVolRow.classList.toggle('hidden', state.action !== 'add');
      }
      addToggleBtn.addEventListener('click', () => {
        state.action = 'add';
        refreshToggle();
      });
      useToggleBtn.addEventListener('click', () => {
        state.action = 'use';
        refreshToggle();
      });
      toggle.appendChild(addToggleBtn);
      toggle.appendChild(useToggleBtn);

      header.appendChild(nameInputEl);
      header.appendChild(toggle);

      // Same field set, same order, as the + Add item / − Use item card
      // below — however an item got here (typed, spoken, scanned, or
      // parsed from a receipt/recipe), reviewing it looks identical.
      const qtyRow = document.createElement('div');
      qtyRow.className = 'field-row two-up';

      const qtyEl = document.createElement('input');
      qtyEl.type = 'number';
      qtyEl.min = '0';
      qtyEl.step = 'any';
      qtyEl.value = state.quantity;
      qtyEl.placeholder = 'Qty';
      qtyEl.setAttribute('aria-label', 'Quantity');
      qtyEl.addEventListener('input', () => (state.quantity = Number(qtyEl.value)));

      const unitEl = document.createElement('select');
      unitEl.setAttribute('aria-label', 'Unit');
      [
        ['', 'Unit'], ['bottle', 'Bottle'], ['box', 'Box'], ['piece', 'Piece'],
        ['can', 'Can'], ['bag', 'Bag'], ['jar', 'Jar'], ['package', 'Package'],
        ['carton', 'Carton'], ['stick', 'Stick'], ['bunch', 'Bunch'],
      ].forEach(([value, label]) => {
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent = label;
        // A parsed unit that isn't one of these (e.g. "cans" from a
        // receipt) still shows up as its own selected option, rather
        // than silently reverting to blank.
        if (value === state.unit) opt.selected = true;
        unitEl.appendChild(opt);
      });
      if (state.unit && ![...unitEl.options].some((o) => o.value === state.unit)) {
        const opt = document.createElement('option');
        opt.value = state.unit;
        opt.textContent = state.unit;
        opt.selected = true;
        unitEl.appendChild(opt);
      }
      unitEl.addEventListener('change', () => (state.unit = unitEl.value));

      qtyRow.appendChild(qtyEl);
      qtyRow.appendChild(unitEl);

      const locCatRow = document.createElement('div');
      locCatRow.className = 'field-row two-up';

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
      catEl.addEventListener('change', () => (state.category = catEl.value));

      locCatRow.appendChild(locEl);
      locCatRow.appendChild(catEl);

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
      wvAmountEl.addEventListener('input', () => {
        // A single item is assumed full, so the same value doubles as
        // both the total size and the current amount — same as Add.
        const val = wvAmountEl.value || null;
        state.fullnessTotal = val;
        state.fullnessAmount = val;
      });

      const wvUnitEl = document.createElement('select');
      wvUnitEl.setAttribute('aria-label', 'Weight/volume unit');
      [
        ['', 'Unit'], ['oz', 'oz'], ['fl oz', 'fl oz'], ['lb', 'lb'], ['kg', 'kg'],
        ['g', 'g'], ['ml', 'ml'], ['L', 'L'], ['cup', 'cup'], ['tbsp', 'tbsp'], ['tsp', 'tsp'],
      ].forEach(([value, label]) => {
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent = label;
        if (value === (state.fullnessUnit || '')) opt.selected = true;
        wvUnitEl.appendChild(opt);
      });
      wvUnitEl.addEventListener('change', () => (state.fullnessUnit = wvUnitEl.value || null));

      weightVolInner.appendChild(wvAmountEl);
      weightVolInner.appendChild(wvUnitEl);
      weightVolRow.appendChild(weightVolLabel);
      weightVolRow.appendChild(weightVolInner);
      refreshToggle(); // now that weightVolRow exists, set its initial visibility too

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

      confirmBtn.addEventListener('click', async () => {
        confirmBtn.disabled = true;
        note.classList.add('hidden');
        try {
          if (!state.name.trim()) throw new Error('Item name is required.');
          if (state.action === 'use') {
            const match = findMatchingItem(state.name, state.location);
            if (!match) {
              throw new Error(
                `No existing item named "${state.name}" to use. Switch to Add, or add it first.`
              );
            }
            // /use is unit-aware: if the matched item tracks container
            // fullness (e.g. a bottle) and this unit converts to it (same
            // family — weight or volume), it deducts from that instead of
            // the whole-item count. Otherwise it's a plain count decrement,
            // same as before.
            const updated = await api(`/api/items/${match.id}/use`, {
              method: 'POST',
              body: JSON.stringify({ amount: state.quantity, unit: state.unit }),
            });
            const i = items.findIndex((it) => it.id === updated.id);
            if (i !== -1) items[i] = updated;
            showToast(`Used ${state.quantity} ${state.unit || ''} ${state.name}`.trim());
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

      card.appendChild(header);
      card.appendChild(qtyRow);
      card.appendChild(locCatRow);
      card.appendChild(expRow);
      card.appendChild(weightVolRow);
      card.appendChild(note);
      card.appendChild(buttons);
      voiceReviewEl.appendChild(card);
    });

    if (parsedItems.length === 0) {
      voiceReviewEl.innerHTML = '<p class="review-note">Couldn\'t find any items in that. Try rephrasing.</p>';
    }
  }

  loadCategories().then(loadItems);
})();
