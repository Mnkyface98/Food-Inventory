(() => {
  const listEl = document.getElementById('item-list');
  const emptyStateEl = document.getElementById('empty-state');
  const statusLineEl = document.getElementById('status-line');
  const addForm = document.getElementById('add-form');
  const nameInput = document.getElementById('item-name');
  const qtyInput = document.getElementById('item-qty');
  const unitInput = document.getElementById('item-unit');
  const locationSelect = document.getElementById('item-location');
  const tabsEl = document.getElementById('location-tabs');
  const searchInput = document.getElementById('search');
  const toastEl = document.getElementById('toast');

  const voiceForm = document.getElementById('voice-form');
  const voiceTextInput = document.getElementById('voice-text');
  const micBtn = document.getElementById('mic-btn');
  const micHint = document.getElementById('mic-hint');
  const voiceReviewEl = document.getElementById('voice-review');

  let items = [];
  let activeLocation = 'all';
  let searchTerm = '';
  let toastTimer = null;

  function formatQty(qty) {
    // Trim trailing zeros for whole numbers but keep decimals like 1.5
    return Number.isInteger(qty) ? String(qty) : String(Math.round(qty * 100) / 100);
  }

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

    for (const item of filtered) {
      listEl.appendChild(renderItem(item));
    }
  }

  function renderItem(item) {
    const li = document.createElement('li');
    li.className = 'item-card';
    li.dataset.id = item.id;

    const info = document.createElement('div');
    info.className = 'item-info';

    const nameEl = document.createElement('div');
    nameEl.className = 'item-name';
    nameEl.textContent = item.name;

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
        body: JSON.stringify({ name, quantity, unit, location }),
      });
      const idx = items.findIndex((i) => i.id === saved.id);
      if (idx === -1) items.push(saved);
      else items[idx] = saved;
      render();
      showToast(`Added ${name}`);
      nameInput.value = '';
      qtyInput.value = '1';
      unitInput.value = '';
      nameInput.focus();
    } catch (err) {
      showToast(`Couldn't add item: ${err.message}`);
    } finally {
      submitBtn.disabled = false;
    }
  });

  tabsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab');
    if (!btn) return;
    activeLocation = btn.dataset.location;
    [...tabsEl.children].forEach((c) => c.classList.toggle('active', c === btn));
    render();
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
      card.appendChild(fieldsRow);
      card.appendChild(note);
      card.appendChild(buttons);
      voiceReviewEl.appendChild(card);
    });

    if (parsedItems.length === 0) {
      voiceReviewEl.innerHTML = '<p class="review-note">Couldn\'t find any items in that. Try rephrasing.</p>';
    }
  }

  loadItems();
})();
