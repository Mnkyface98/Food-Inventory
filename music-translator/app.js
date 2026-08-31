(function () {
  const ALL_NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  const tonicNoteSel = document.getElementById('tonicNote');
  const tonicOctaveInput = document.getElementById('tonicOctave');
  const carnaticInput = document.getElementById('carnaticInput');
  const westernInput = document.getElementById('westernInput');
  const westernOutput = document.getElementById('westernOutput');
  const carnaticOutput = document.getElementById('carnaticOutput');
  const toWesternBtn = document.getElementById('toWestern');
  const toCarnaticBtn = document.getElementById('toCarnatic');
  const chartTable = document.getElementById('chartTable');

  ALL_NOTE_NAMES.forEach((n) => {
    const opt = document.createElement('option');
    opt.value = n;
    opt.textContent = n;
    if (n === 'C') opt.selected = true;
    tonicNoteSel.appendChild(opt);
  });

  function currentTonic() {
    return {
      name: tonicNoteSel.value,
      octave: parseInt(tonicOctaveInput.value, 10) || 4,
    };
  }

  function renderError(container, err) {
    container.innerHTML = `<div class="error">${err.message}</div>`;
  }

  toWesternBtn.addEventListener('click', () => {
    const { name, octave } = currentTonic();
    try {
      const results = carnaticToWestern(carnaticInput.value, name, octave);
      westernOutput.innerHTML =
        '<div class="output-grid">' +
        results
          .map(
            (r) => `<div class="note-chip">
              <span class="from">${r.input}</span>
              <span class="to">${r.western}</span>
            </div>`
          )
          .join('') +
        '</div>';
    } catch (err) {
      renderError(westernOutput, err);
    }
  });

  toCarnaticBtn.addEventListener('click', () => {
    const { name, octave } = currentTonic();
    try {
      const results = westernToCarnatic(westernInput.value, name, octave);
      carnaticOutput.innerHTML =
        '<div class="output-grid">' +
        results
          .map(
            (r) => `<div class="note-chip">
              <span class="from">${r.input}</span>
              <span class="to">${r.swara}</span>
              ${r.altSwara ? `<span class="alt">or ${r.altSwara}</span>` : ''}
            </div>`
          )
          .join('') +
        '</div>';
    } catch (err) {
      renderError(carnaticOutput, err);
    }
  });

  // Static reference chart, always relative to whichever tonic is selected.
  function renderChart() {
    const { name, octave } = currentTonic();
    const header = '<tr><th>Semitone</th><th>Swara</th><th>Western</th></tr>';
    const rows = SEMITONE_TO_SWARA.map((entry, i) => {
      const western = ALL_NOTE_NAMES[(ALL_NOTE_NAMES.indexOf(name) + i) % 12];
      const swaraLabel = entry.alt ? `${entry.name} (or ${entry.alt})` : entry.name;
      return `<tr><td>${i}</td><td>${swaraLabel}</td><td>${western}</td></tr>`;
    }).join('');
    chartTable.innerHTML = header + rows;
  }

  tonicNoteSel.addEventListener('change', renderChart);
  tonicOctaveInput.addEventListener('change', renderChart);
  renderChart();
})();
