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

  loadItems();
})();
