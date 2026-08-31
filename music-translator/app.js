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

  function renderPhrases(container, result, toChip) {
    if (result.phrases.length === 0) {
      container.innerHTML = '';
      return;
    }
    container.innerHTML = result.phrases
      .map((phrase) => {
        const chips = phrase.notes.map(toChip).join('');
        if (phrase.marked) {
          return `<div class="phrase-line"><span class="danda">।</span><div class="output-grid">${chips}</div><span class="danda">॥</span></div>`;
        }
        return `<div class="phrase-line"><div class="output-grid">${chips}</div></div>`;
      })
      .join('');
  }

  toWesternBtn.addEventListener('click', () => {
    const { name, octave } = currentTonic();
    try {
      const result = carnaticToWestern(carnaticInput.value, name, octave);
      renderPhrases(
        westernOutput,
        result,
        (n) => `<div class="note-chip"><span class="from">${n.input}</span><span class="to">${n.western}</span></div>`
      );
    } catch (err) {
      renderError(westernOutput, err);
    }
  });

  toCarnaticBtn.addEventListener('click', () => {
    const { name, octave } = currentTonic();
    try {
      const result = westernToCarnatic(westernInput.value, name, octave);
      renderPhrases(
        carnaticOutput,
        result,
        (n) => `<div class="note-chip"><span class="from">${n.input}</span><span class="to">${n.swara}</span>${n.altSwara ? `<span class="alt">or ${n.altSwara}</span>` : ''}</div>`
      );
    } catch (err) {
      renderError(carnaticOutput, err);
    }
  });

  // Static reference chart, always relative to whichever tonic is selected.
  function renderChart() {
    const { name } = currentTonic();
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

  // ---- file upload: plain text loads directly, images go through OCR ----
  function wireTextUpload(inputEl, textareaEl) {
    inputEl.addEventListener('change', () => {
      const file = inputEl.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => { textareaEl.value = String(reader.result).trim(); };
      reader.readAsText(file);
      inputEl.value = '';
    });
  }

  function wireImageUpload(inputEl, textareaEl, statusEl) {
    inputEl.addEventListener('change', () => {
      const file = inputEl.files[0];
      if (!file) return;
      if (typeof Tesseract === 'undefined') {
        statusEl.textContent = 'OCR library failed to load — check your connection and try again.';
        inputEl.value = '';
        return;
      }
      statusEl.textContent = 'Reading photo… this can take a few seconds.';
      Tesseract.recognize(file, 'eng')
        .then(({ data: { text } }) => {
          textareaEl.value = text.trim();
          statusEl.textContent = 'Loaded from photo — please review for OCR mistakes before translating.';
        })
        .catch((err) => {
          statusEl.textContent = `Couldn't read that photo: ${err.message}`;
        })
        .finally(() => { inputEl.value = ''; });
    });
  }

  wireTextUpload(document.getElementById('carnaticTxtUpload'), carnaticInput);
  wireTextUpload(document.getElementById('westernTxtUpload'), westernInput);
  wireImageUpload(document.getElementById('carnaticImgUpload'), carnaticInput, document.getElementById('carnaticOcrStatus'));
  wireImageUpload(document.getElementById('westernImgUpload'), westernInput, document.getElementById('westernOcrStatus'));
})();
