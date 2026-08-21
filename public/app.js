(() => {
  const listEl = document.getElementById('item-list');
  const emptyStateEl = document.getElementById('empty-state');
  const statusLineEl = document.getElementById('status-line');
  const addForm = document.getElementById('add-form');
  const nameInput = document.getElementById('item-name');
  const qtyInput = document.getElementById('item-qty');
  const unitInput = document.getElementById('item-unit');
  const locationSelect = document.getElementById('item-location');
  const categorySelect = document.getElementById('item-category');
  const expirationInput = document.getElementById('item-expiration');
  const packSizeInput = document.getElementById('item-pack-size');
  const percentFullInput = document.getElementById('item-percent-full');
  const percentFullWrap = document.getElementById('percent-full-wrap');
  const tabsEl = document.getElementById('location-tabs');
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
  const receiptStatus = document.getElementById('receipt-status');

  let items = [];
  let categories = []; // [{id, label}], loaded from the server
  let categoryLabels = {};
  let activeLocation = 'all';
  let searchTerm = '';
  let toastTimer = null;
  let editingId = null; // id of the item currently shown as an edit form, if any

  // Low-stock rules, checked in priority order by getLowStockBadge() below:
  // an item's own pack-size/%-full tracking (if set) wins over the
  // canned-food/beverage defaults, which win over the flat fallback.
  const LOW_STOCK_THRESHOLD = 1; // fallback for anything not covered below
  const PACK_LOW_FRACTION = 0.25; // pack-tracked items: low at <=25% of the original pack left
  const BOTTLE_LOW_PERCENT = 30; // single-container items: low at <=30% full (i.e. 70%+ used)
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
      }
    } catch (err) {
      // Non-fatal: category dropdowns just stay empty/"Auto" if this fails.
      console.error('Failed to load categories', err);
    }
  }

  function formatQty(qty) {
    // Trim trailing zeros for whole numbers but keep decimals like 1.5
    return Number.isInteger(qty) ? String(qty) : String(Math.round(qty * 100) / 100);
  }

  // "% full" only makes sense for exactly one container — hide it (and
  // clear any value) whenever quantity isn't 1. Shared by the Add form
  // and every inline edit form.
  function wirePercentFullVisibility(qtyEl, wrapEl, percentEl) {
    function sync() {
      const isSingle = Number(qtyEl.value) === 1;
      wrapEl.classList.toggle('hidden', !isSingle);
      if (!isSingle) percentEl.value = '';
    }
    qtyEl.addEventListener('input', sync);
    sync();
  }

  wirePercentFullVisibility(qtyInput, percentFullWrap, percentFullInput);

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

  function render() {
    const filtered = items.filter((item) => {
      const matchesLocation = activeLocation === 'all' || item.location === activeLocation;
      const matchesSearch = !searchTerm || item.name.toLowerCase().includes(searchTerm);
      return matchesLocation && matchesSearch;
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

    // Group by category, preserving the server's ordering within each
    // group (category, then quantity ascending — low stock first).
    let currentCategory = null;
    for (const item of filtered) {
      if (item.category !== currentCategory) {
        currentCategory = item.category;
        const heading = document.createElement('li');
        heading.className = 'category-heading';
        heading.textContent = categoryLabels[item.category] || 'Other';
        listEl.appendChild(heading);
      }
      listEl.appendChild(item.id === editingId ? renderEditForm(item) : renderItem(item));
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
    const lowStockRow = document.createElement('div');
    lowStockRow.className = 'field-row two-up';

    const packWrap = document.createElement('div');
    const packLabel = document.createElement('label');
    packLabel.className = 'field-label';
    packLabel.textContent = 'Pack size';
    const packEl = document.createElement('input');
    packEl.type = 'number';
    packEl.min = '1';
    packEl.step = 'any';
    packEl.placeholder = 'e.g. 24';
    if (item.packSize != null) packEl.value = item.packSize;
    packWrap.appendChild(packLabel);
    packWrap.appendChild(packEl);

    const percentWrap = document.createElement('div');
    const percentLabel = document.createElement('label');
    percentLabel.className = 'field-label';
    percentLabel.textContent = '% full (single item)';
    const percentEl = document.createElement('input');
    percentEl.type = 'number';
    percentEl.min = '0';
    percentEl.max = '100';
    percentEl.step = 'any';
    percentEl.placeholder = 'e.g. 70';
    if (item.percentFull != null) percentEl.value = item.percentFull;
    percentWrap.appendChild(percentLabel);
    percentWrap.appendChild(percentEl);

    lowStockRow.appendChild(packWrap);
    lowStockRow.appendChild(percentWrap);
    lowStockDetails.appendChild(lowStockSummary);
    lowStockDetails.appendChild(lowStockRow);
    if (item.packSize != null || item.percentFull != null) lowStockDetails.open = true;
    wirePercentFullVisibility(qtyEl, percentWrap, percentEl);

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
            percentFull: percentEl.value || '',
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

  addForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    const quantity = Number(qtyInput.value);
    const unit = unitInput.value.trim();
    const location = locationSelect.value;
    const category = categorySelect.value || undefined; // empty = let server guess
    const expirationDate = expirationInput.value || undefined;
    const packSize = packSizeInput.value || undefined;
    const percentFull = percentFullInput.value || undefined;

    if (!name) return;
    if (!Number.isFinite(quantity) || quantity < 0) {
      showToast('Enter a valid quantity.');
      return;
    }

    const submitBtn = addForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    try {
      const saved = await api('/api/items', {
        method: 'POST',
        body: JSON.stringify({ name, quantity, unit, location, category, expirationDate, packSize, percentFull }),
      });
      const idx = items.findIndex((i) => i.id === saved.id);
      if (idx === -1) items.push(saved);
      else items[idx] = saved;
      render();
      showToast(`Added ${name}`);
      nameInput.value = '';
      qtyInput.value = '1';
      unitInput.value = '';
      categorySelect.value = '';
      expirationInput.value = '';
      packSizeInput.value = '';
      percentFullInput.value = '';
      qtyInput.dispatchEvent(new Event('input')); // re-sync the % full field's visibility for qty=1
      nameInput.focus();
    } catch (err) {
      showToast(`Couldn't add item: ${err.message}`);
    } finally {
      submitBtn.disabled = false;
    }
  });

  function setActiveLocation(location) {
    activeLocation = location;
    [...tabsEl.children].forEach((c) => c.classList.toggle('active', c.dataset.location === location));
    render();
  }

  tabsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab');
    if (!btn) return;
    setActiveLocation(btn.dataset.location);
  });

  // Picking a location in the "Add an item" form also switches the list's
  // filter tab to match, so you immediately see the shelf you're adding to.
  locationSelect.addEventListener('change', () => {
    setActiveLocation(locationSelect.value);
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
  // Uses the device's native camera/photo picker (a plain file input —
  // simpler and more reliable than a live video overlay for capturing a
  // single high-res still) then runs OCR entirely on-device via
  // Tesseract.js, fully vendored locally (engine + English language data)
  // so it works offline after the page has loaded and nothing is uploaded
  // anywhere. The recognized text is sent to the server for free,
  // rule-based line parsing, then goes through the same review-card flow
  // as voice and barcode entry.

  const hasTesseract = typeof window.Tesseract !== 'undefined';
  if (!hasTesseract) {
    receiptInput.disabled = true;
  }

  receiptInput.addEventListener('change', async () => {
    const file = receiptInput.files && receiptInput.files[0];
    if (!file) return;

    receiptStatus.classList.remove('hidden');
    receiptStatus.textContent = 'Reading receipt… this can take a few seconds.';

    let worker = null;
    try {
      if (!hasTesseract) throw new Error('Receipt scanning is not available in this browser.');

      worker = await window.Tesseract.createWorker('eng', window.Tesseract.OEM.LSTM_ONLY, {
        workerPath: 'vendor/tesseract/worker.min.js',
        corePath: 'vendor/tesseract/tesseract-core-lstm.wasm.js',
        langPath: 'vendor/tesseract',
        gzip: true,
        logger: (m) => {
          if (m.status && typeof m.progress === 'number') {
            receiptStatus.textContent = `${m.status}… ${Math.round(m.progress * 100)}%`;
          }
        },
      });
      const { data } = await worker.recognize(file);

      receiptStatus.textContent = 'Finding items…';
      const result = await api('/api/receipt/parse', {
        method: 'POST',
        body: JSON.stringify({ text: data.text }),
      });

      voiceReviewEl.classList.remove('hidden');
      renderReview(result.items);
      showToast(`Found ${result.items.length} item${result.items.length === 1 ? '' : 's'} on the receipt`);
    } catch (err) {
      showToast(`Couldn't read that receipt: ${err.message}`);
    } finally {
      if (worker) {
        try {
          await worker.terminate();
        } catch (err) {
          // ignore — worker may already be gone
        }
      }
      receiptStatus.classList.add('hidden');
      receiptInput.value = ''; // allow re-selecting the same file
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
      }
      addToggleBtn.addEventListener('click', () => {
        state.action = 'add';
        refreshToggle();
      });
      useToggleBtn.addEventListener('click', () => {
        state.action = 'use';
        refreshToggle();
      });
      refreshToggle();
      toggle.appendChild(addToggleBtn);
      toggle.appendChild(useToggleBtn);

      header.appendChild(nameInputEl);
      header.appendChild(toggle);

      const catRow = document.createElement('div');
      catRow.className = 'field-row';
      const catEl = document.createElement('select');
      catEl.setAttribute('aria-label', 'Category');
      categories.forEach((cat) => {
        const opt = document.createElement('option');
        opt.value = cat.id;
        opt.textContent = cat.label;
        if (cat.id === state.category) opt.selected = true;
        catEl.appendChild(opt);
      });
      catEl.addEventListener('change', () => (state.category = catEl.value));
      catRow.appendChild(catEl);

      const fieldsRow = document.createElement('div');
      fieldsRow.className = 'field-row three-up';

      const qtyEl = document.createElement('input');
      qtyEl.type = 'number';
      qtyEl.min = '0';
      qtyEl.step = 'any';
      qtyEl.value = state.quantity;
      qtyEl.setAttribute('aria-label', 'Quantity');
      qtyEl.addEventListener('input', () => (state.quantity = Number(qtyEl.value)));

      const unitEl = document.createElement('input');
      unitEl.type = 'text';
      unitEl.value = state.unit;
      unitEl.placeholder = 'Unit';
      unitEl.setAttribute('aria-label', 'Unit');
      unitEl.addEventListener('input', () => (state.unit = unitEl.value));

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

      fieldsRow.appendChild(qtyEl);
      fieldsRow.appendChild(unitEl);
      fieldsRow.appendChild(locEl);

      const expRow = document.createElement('div');
      expRow.className = 'field-row';
      const expEl = document.createElement('input');
      expEl.type = 'date';
      expEl.setAttribute('aria-label', 'Expiration date');
      if (state.expirationDate) expEl.value = state.expirationDate;
      expEl.addEventListener('input', () => (state.expirationDate = expEl.value || null));
      expRow.appendChild(expEl);

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
            const updated = await api(`/api/items/${match.id}/adjust`, {
              method: 'POST',
              body: JSON.stringify({ delta: -Math.abs(state.quantity) }),
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
      card.appendChild(catRow);
      card.appendChild(fieldsRow);
      card.appendChild(expRow);
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
