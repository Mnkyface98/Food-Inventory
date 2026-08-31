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

  const tabInstrumentSel = document.getElementById('tabInstrument');

  function renderTabPhrases(container, result, tuningKey) {
    if (result.phrases.length === 0) { container.innerHTML = ''; return; }
    container.innerHTML = result.phrases
      .map((phrase) => {
        const midis = phrase.notes.map((n) => n.midi);
        const { lines, outOfRange } = buildTab(midis, tuningKey);
        const warning = outOfRange.length
          ? `<p class="tab-warning">${outOfRange.length} note${outOfRange.length > 1 ? 's' : ''} out of this instrument's range (shown as "x") — try a different tonic octave.</p>`
          : '';
        const block = `<pre class="tab-block">${lines.join('\n')}</pre>${warning}`;
        if (phrase.marked) {
          return `<div class="phrase-line-tab"><span class="danda">।</span>${block}<span class="danda">॥</span></div>`;
        }
        return block;
      })
      .join('');
  }

  toWesternBtn.addEventListener('click', () => {
    const { name, octave } = currentTonic();
    try {
      const result = carnaticToWestern(carnaticInput.value, name, octave);
      const tuningKey = tabInstrumentSel.value;
      if (tuningKey) {
        renderTabPhrases(westernOutput, result, tuningKey);
      } else {
        renderPhrases(
          westernOutput,
          result,
          (n) => `<div class="note-chip"><span class="from">${n.input}</span><span class="to">${n.western}</span></div>`
        );
      }
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

  // ---- document upload: .txt/.md load directly, .docx/.pdf get their text
  // extracted in-browser, images go through OCR ----
  if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
  }

  function readAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error || new Error('Could not read file'));
      reader.readAsText(file);
    });
  }
  function readAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error('Could not read file'));
      reader.readAsArrayBuffer(file);
    });
  }
  async function extractDocx(file) {
    if (typeof mammoth === 'undefined') throw new Error('.docx reader failed to load — check your connection.');
    const arrayBuffer = await readAsArrayBuffer(file);
    const { value } = await mammoth.extractRawText({ arrayBuffer });
    return value;
  }
  async function extractPdf(file) {
    if (typeof pdfjsLib === 'undefined') throw new Error('.pdf reader failed to load — check your connection.');
    const arrayBuffer = await readAsArrayBuffer(file);
    const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = '';
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((item) => item.str).join(' ') + '\n';
    }
    if (!text.trim()) {
      throw new Error('No selectable text found — this looks like a scanned/image PDF. Try the photo (OCR) upload on individual pages instead.');
    }
    return text;
  }

  function wireDocumentUpload(inputEl, textareaEl, statusEl) {
    inputEl.addEventListener('change', () => {
      const file = inputEl.files[0];
      if (!file) return;
      const lower = file.name.toLowerCase();
      statusEl.textContent = 'Reading document…';
      let job;
      if (lower.endsWith('.docx')) job = extractDocx(file);
      else if (lower.endsWith('.pdf')) job = extractPdf(file);
      else job = readAsText(file);

      job
        .then((text) => {
          textareaEl.value = text.trim();
          statusEl.textContent = 'Loaded from document.';
        })
        .catch((err) => {
          statusEl.textContent = `Couldn't read that file: ${err.message}`;
        })
        .finally(() => { inputEl.value = ''; });
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

  wireDocumentUpload(document.getElementById('carnaticDocUpload'), carnaticInput, document.getElementById('carnaticOcrStatus'));
  wireDocumentUpload(document.getElementById('westernDocUpload'), westernInput, document.getElementById('westernOcrStatus'));
  wireImageUpload(document.getElementById('carnaticImgUpload'), carnaticInput, document.getElementById('carnaticOcrStatus'));
  wireImageUpload(document.getElementById('westernImgUpload'), westernInput, document.getElementById('westernOcrStatus'));
})();
