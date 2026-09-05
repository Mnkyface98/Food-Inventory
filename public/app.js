const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

let SPECIES = [];
let CONTAINERS = [];

async function api(path, opts) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  return res.json();
}

// --- Tabs ---
$$('#tabs button').forEach((btn) => {
  btn.addEventListener('click', () => {
    $$('#tabs button').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    $$('.tab').forEach((t) => t.classList.add('hidden'));
    $(`#tab-${btn.dataset.tab}`).classList.remove('hidden');
  });
});

function monthOptions() {
  const names = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const sel = $('#site-month');
  names.forEach((n, i) => {
    const opt = document.createElement('option');
    opt.value = i + 1;
    opt.textContent = n;
    sel.appendChild(opt);
  });
  sel.value = new Date().getMonth() + 1;
}

// --- Site profile ---
async function loadSite() {
  const site = await api('/api/site');
  if (site.floor) $('#site-floor').value = site.floor;
  if (site.buildingHeight) $('#site-buildingHeight').value = site.buildingHeight;
  if (site.orientation) $('#site-orientation').value = site.orientation;
  if (site.zone) $('#site-zone').value = site.zone;
  if (site.saltProximity) $('#site-saltProximity').value = site.saltProximity;
  if (site.humidityBand) $('#site-humidityBand').value = site.humidityBand;
  if (site.windExposure) $('#site-windExposure').value = site.windExposure;
}

function currentSite() {
  return {
    floor: Number($('#site-floor').value) || null,
    buildingHeight: Number($('#site-buildingHeight').value) || null,
    orientation: $('#site-orientation').value,
    zone: Number($('#site-zone').value) || 11,
    saltProximity: $('#site-saltProximity').value,
    humidityBand: $('#site-humidityBand').value,
    windExposure: Number($('#site-windExposure').value) || 3,
    month: Number($('#site-month').value),
  };
}

$('#save-site').addEventListener('click', async () => {
  await api('/api/site', { method: 'POST', body: JSON.stringify(currentSite()) });
  $('#site-saved').classList.remove('hidden');
  setTimeout(() => $('#site-saved').classList.add('hidden'), 1500);
});

// --- Containers ---
async function loadContainers() {
  CONTAINERS = await api('/api/containers');
  renderContainerList();
  fillContainerSelects();
}

function renderContainerList() {
  const el = $('#container-list');
  if (CONTAINERS.length === 0) {
    el.innerHTML = '<p style="color:var(--muted)">No containers yet.</p>';
    return;
  }
  el.innerHTML = CONTAINERS.map((c) => `
    <div class="plant-card">
      <h4>${c.name} <span class="pill">${c.position === 'floor_standing' ? 'floor-standing' : 'railing box'}</span></h4>
      <div class="meta">${c.lengthIn}" x ${c.widthIn}"${c.depthIn ? ` x ${c.depthIn}" deep` : ''} · ${c.sunHours || '?'}h sun · wind ${c.windExposure || '?'}/5</div>
      <div class="meta">Planted: ${(c.plantIds || []).map((id) => speciesName(id)).join(', ') || 'nothing yet'}</div>
      <button class="ghost" data-remove="${c.id}">Remove</button>
    </div>
  `).join('');
  el.querySelectorAll('[data-remove]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await api(`/api/containers/${btn.dataset.remove}`, { method: 'DELETE' });
      await loadContainers();
    });
  });
}

function speciesName(id) {
  const s = SPECIES.find((s) => s.id === id);
  return s ? s.commonName : id;
}

function fillContainerSelects() {
  const opts = CONTAINERS.map((c) => `<option value="${c.id}">${c.name}</option>`).join('');
  $('#rec-container').innerHTML = opts || '<option value="">No containers yet</option>';
  $('#j-container').innerHTML = opts || '<option value="">No containers yet</option>';
  updateExistingSelect();
}

function updateExistingSelect() {
  const container = CONTAINERS.find((c) => c.id === $('#rec-container').value);
  const sel = $('#rec-existing');
  sel.innerHTML = SPECIES.map((s) => `<option value="${s.id}" ${(container?.plantIds || []).includes(s.id) ? 'selected' : ''}>${s.commonName} (${s.category})</option>`).join('');
}
$('#rec-container').addEventListener('change', updateExistingSelect);

$('#add-container').addEventListener('click', async () => {
  const lengthIn = Number($('#c-length').value);
  const widthIn = Number($('#c-width').value);
  if (!lengthIn || !widthIn) {
    alert('Length and width are required.');
    return;
  }
  const body = {
    name: $('#c-name').value || `Box ${CONTAINERS.length + 1}`,
    position: $('#c-position').value,
    lengthIn,
    widthIn,
    depthIn: $('#c-depth').value ? Number($('#c-depth').value) : null,
    sunHours: $('#c-sunHours').value ? Number($('#c-sunHours').value) : null,
    windExposure: $('#c-windExposure').value ? Number($('#c-windExposure').value) : null,
  };
  await api('/api/containers', { method: 'POST', body: JSON.stringify(body) });
  await loadContainers();
});

// --- Recommend ---
function buildOptions() {
  return {
    preferExotic: $('#opt-preferExotic').checked,
    excludeToxic: $('#opt-excludeToxic').checked,
    excludeVines: $('#opt-excludeVines').checked,
    excludeHot: $('#opt-excludeHot').checked,
    seasonalOnly: $('#opt-seasonalOnly').checked,
  };
}

function selectedContainer() {
  return CONTAINERS.find((c) => c.id === $('#rec-container').value);
}

function selectedExisting() {
  return Array.from($('#rec-existing').selectedOptions).map((o) => o.value);
}

function renderRatioBar(remainingIn, totalIn) {
  const usedPct = totalIn ? Math.min(100, ((totalIn - remainingIn) / totalIn) * 100) : 0;
  return `<div class="remaining-bar"><div style="width:${usedPct}%"></div></div>
    <p style="font-size:0.8rem;color:var(--muted)">${remainingIn.toFixed(1)}" of ${totalIn}" remaining</p>`;
}

$('#run-recommend').addEventListener('click', async () => {
  const container = selectedContainer();
  if (!container) return alert('Add a container first.');
  const body = {
    container: { lengthIn: container.lengthIn, widthIn: container.widthIn, depthIn: container.depthIn, sunHours: container.sunHours, windExposure: container.windExposure, position: container.position },
    site: currentSite(),
    focus: $('#rec-focus').value,
    existingIds: selectedExisting(),
    options: buildOptions(),
  };
  const result = await api('/api/recommend', { method: 'POST', body: JSON.stringify(body) });
  $('#recommend-results-panel').hidden = false;
  $('#recommend-results').innerHTML = `
    <h3>Recommended box</h3>
    ${renderRatioBar(result.remainingIn, result.totalLengthIn)}
    ${result.placed.map((p) => `<div class="plant-card"><h4>${p.commonName}</h4><div class="meta">${p.category} · ${p.matureSpreadIn}" mature spread</div></div>`).join('') || '<p>Nothing fit.</p>'}
    ${result.rejected.length ? `<h3>Didn't fit</h3>` + result.rejected.map((r) => `<div class="notice warn">${r.commonName}: ${r.reason}</div>`).join('') : ''}
  `;
});

$('#run-suggest').addEventListener('click', async () => {
  const container = selectedContainer();
  if (!container) return alert('Add a container first.');
  const body = {
    container: { lengthIn: container.lengthIn, widthIn: container.widthIn, depthIn: container.depthIn, sunHours: container.sunHours, windExposure: container.windExposure, position: container.position },
    site: currentSite(),
    focus: $('#rec-focus').value,
    existingIds: selectedExisting(),
    options: buildOptions(),
  };
  const result = await api('/api/suggest-missing', { method: 'POST', body: JSON.stringify(body) });
  $('#recommend-results-panel').hidden = false;
  $('#recommend-results').innerHTML = `
    <h3>Candidates for the remaining space</h3>
    ${renderRatioBar(result.remainingIn, container.lengthIn)}
    ${result.candidates.map((c) => `
      <div class="plant-card">
        <h4>${c.commonName} <span class="pill ${c.fits ? '' : 'warn'}">${c.fits ? 'fits' : 'too big'}</span>
        <span class="pill ${c.companionVerdict === 'avoid' ? 'bad' : c.companionVerdict === 'good' ? '' : 'warn'}">${c.companionVerdict}</span></h4>
        <div class="meta">${c.category} · ${c.matureSpreadIn}" mature spread · fit score ${(c.fitScore * 100).toFixed(0)}%</div>
        <ul>${[...c.fitReasons, ...c.companionReasons].map((r) => `<li>${r}</li>`).join('')}</ul>
      </div>
    `).join('') || '<p>Nothing passes the current filters.</p>'}
  `;
});

// --- Companions ---
$('#run-companions').addEventListener('click', async () => {
  const ids = Array.from($('#comp-plants').selectedOptions).map((o) => o.value);
  if (ids.length < 2) return alert('Pick at least two plants.');
  const result = await api('/api/companions/check', { method: 'POST', body: JSON.stringify({ ids }) });
  $('#companion-results').innerHTML = result.pairs.map((p) => `
    <div class="plant-card">
      <h4>${speciesName(p.a)} + ${speciesName(p.b)} <span class="pill ${p.verdict === 'avoid' ? 'bad' : p.verdict === 'good' ? '' : 'warn'}">${p.verdict}</span></h4>
      <ul>${p.reasons.map((r) => `<li>${r}</li>`).join('') || '<li>No strong interaction either way.</li>'}</ul>
    </div>
  `).join('');
});

// --- Floor load ---
$('#run-floorload').addEventListener('click', async () => {
  const body = {
    lengthIn: Number($('#fl-length').value) || 0,
    widthIn: Number($('#fl-width').value) || 0,
    depthIn: Number($('#fl-depth').value) || 0,
    containerTareLb: Number($('#fl-tare').value) || 0,
    plantEstimateLb: Number($('#fl-plants').value) || 0,
    ratedCapacityLbPerSqft: $('#fl-rated').value ? Number($('#fl-rated').value) : null,
  };
  const result = await api('/api/floor-load', { method: 'POST', body: JSON.stringify(body) });
  $('#floorload-results').innerHTML = `
    <p>Estimated wet weight: <strong>${result.totalWeightLb} lb</strong> over <strong>${result.footprintSqFt} sq ft</strong>
    = <strong>${result.requiredCapacityLbPerSqft} lb/sq ft</strong> required.</p>
    <div class="notice ${result.pass ? 'good' : 'bad'}">${result.pass ? 'Within the rated capacity used for this check.' : 'Exceeds the rated capacity used for this check.'} (${result.ratedCapacityLbPerSqft} lb/sq ft)</div>
    ${result.warning ? `<div class="notice warn">${result.warning}</div>` : ''}
  `;
});

// --- Add plant ---
$('#run-addplant').addEventListener('click', async () => {
  const commonName = $('#ap-name').value.trim();
  if (!commonName) return;
  const result = await api('/api/add-plant', { method: 'POST', body: JSON.stringify({ commonName }) });
  if (result.duplicate) {
    $('#addplant-results').innerHTML = `<div class="notice warn">${result.warning}</div>`;
    return;
  }
  $('#addplant-results').innerHTML = `
    <div class="notice warn">${result.warning}</div>
    <pre style="white-space:pre-wrap;background:#faf9f5;padding:0.75rem;border-radius:8px;font-size:0.8rem;">${JSON.stringify(result.profile, null, 2)}</pre>
  `;
  await refreshSpecies();
});

// --- Journal ---
async function fillJournalSelects() {
  $('#j-species').innerHTML = SPECIES.map((s) => `<option value="${s.id}">${s.commonName}</option>`).join('');
}

$('#save-journal').addEventListener('click', async () => {
  const body = {
    containerId: $('#j-container').value,
    speciesId: $('#j-species').value,
    status: $('#j-status').value,
    issueTags: $('#j-tags').value.split(',').map((t) => t.trim()).filter(Boolean),
    notes: $('#j-notes').value,
  };
  await api('/api/journal', { method: 'POST', body: JSON.stringify(body) });
  $('#j-notes').value = '';
  await loadJournal();
});

async function loadJournal() {
  const entries = await api('/api/journal');
  $('#journal-list').innerHTML = entries.slice().reverse().map((e) => `
    <div class="plant-card">
      <h4>${speciesName(e.speciesId)} — ${e.status}</h4>
      <div class="meta">${new Date(e.date).toLocaleString()} · ${(e.issueTags || []).map((t) => `<span class="pill warn">${t}</span>`).join('')}</div>
      <div>${e.notes || ''}</div>
    </div>
  `).join('') || '<p style="color:var(--muted)">No entries yet.</p>';
}

// --- Init ---
async function refreshSpecies() {
  SPECIES = await api('/api/species');
  $('#comp-plants').innerHTML = SPECIES.map((s) => `<option value="${s.id}">${s.commonName} (${s.category})</option>`).join('');
  fillJournalSelects();
  updateExistingSelect();
}

(async function init() {
  monthOptions();
  await refreshSpecies();
  await loadSite();
  await loadContainers();
  await loadJournal();
})();
