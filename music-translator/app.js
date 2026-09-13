(function () {
  const ALL_NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  const tonicNoteSel = document.getElementById('tonicNote');
  const tonicOctaveInput = document.getElementById('tonicOctave');
  const tempoBpmInput = document.getElementById('tempoBpm');
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

  // ---- playback: hear the translated phrase as tones ----
  const playWesternBtn = document.getElementById('playWestern');
  const playCarnaticBtn = document.getElementById('playCarnatic');
  let audioCtx = null;
  let activePlayback = null; // { stop() } for whichever panel is currently playing

  function getAudioCtx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  // ---- tambura: a continuous drone on Sa, independent of translation/playback ----
  const tamburaBtn = document.getElementById('tamburaBtn');
  let tambura = null; // { oscillators, lfo, masterGain } while droning, else null

  function startTambura() {
    const ctx = getAudioCtx();
    const { name, octave } = currentTonic();
    const freq = midiToFreq(noteNameToMidi(name, octave));

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0, ctx.currentTime);
    masterGain.gain.linearRampToValueAtTime(0.14, ctx.currentTime + 0.6);
    masterGain.connect(ctx.destination);

    // A few slightly detuned partials plus a quiet octave-up overtone give
    // the drone some of a tanpura's characteristic shimmer instead of a
    // flat, single-oscillator tone.
    const partials = [
      { cents: 0, type: 'triangle', level: 0.34 },
      { cents: -5, type: 'triangle', level: 0.28 },
      { cents: 5, type: 'triangle', level: 0.28 },
      { cents: 1200, type: 'sine', level: 0.12 },
    ];
    const oscillators = partials.map(({ cents, type, level }) => {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      osc.detune.value = cents;
      const levelGain = ctx.createGain();
      levelGain.gain.value = level;
      osc.connect(levelGain).connect(masterGain);
      osc.start();
      return osc;
    });

    // Slow tremolo so the drone breathes rather than sitting dead-flat.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.15;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain).connect(masterGain.gain);
    lfo.start();

    tambura = { oscillators, lfo, masterGain };
    tamburaBtn.textContent = '⏹ Stop Tambura';
    tamburaBtn.classList.add('droning');
  }

  function stopTambura() {
    if (!tambura) return;
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    tambura.masterGain.gain.cancelScheduledValues(now);
    tambura.masterGain.gain.setTargetAtTime(0, now, 0.15);
    const nodes = [...tambura.oscillators, tambura.lfo];
    setTimeout(() => nodes.forEach((n) => { try { n.stop(); } catch (e) { /* already stopped */ } }), 500);
    tambura = null;
    tamburaBtn.textContent = '♫ Start Tambura';
    tamburaBtn.classList.remove('droning');
  }

  tamburaBtn.addEventListener('click', () => { tambura ? stopTambura() : startTambura(); });

  // If the tonic changes while the drone is running, retune it live rather
  // than requiring a stop/restart.
  function retuneTamburaIfRunning() {
    if (!tambura) return;
    const { name, octave } = currentTonic();
    const freq = midiToFreq(noteNameToMidi(name, octave));
    const ctx = getAudioCtx();
    tambura.oscillators.forEach((osc) => osc.frequency.setTargetAtTime(freq, ctx.currentTime, 0.08));
  }
  tonicNoteSel.addEventListener('change', retuneTamburaIfRunning);
  tonicOctaveInput.addEventListener('change', retuneTamburaIfRunning);

  function buildPlaybackEvents(result) {
    const events = [];
    result.phrases.forEach((phrase, pIdx) => {
      phrase.notes.forEach((note, nIdx) => {
        events.push({ midi: note.midi, gapBefore: pIdx > 0 && nIdx === 0 });
      });
    });
    return events;
  }

  function stopPlayback() {
    if (activePlayback) activePlayback.stop();
  }

  // Tempo, like a metronome: quarter notes at the given BPM. Clamped to a
  // sane range so a stray blank/zero input can't divide by zero or produce
  // an unusably fast/slow playback.
  function getTempoSeconds() {
    const bpm = Math.min(240, Math.max(30, parseInt(tempoBpmInput.value, 10) || 96));
    return 60 / bpm;
  }

  function playSingleNote(midi) {
    const ctx = getAudioCtx();
    const duration = Math.min(0.6, getTempoSeconds());
    const t = ctx.currentTime + 0.02;
    const freq = midiToFreq(midi);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.25, t + 0.015);
    gain.gain.setValueAtTime(0.25, t + duration - 0.06);
    gain.gain.linearRampToValueAtTime(0, t + duration - 0.01);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + duration);
  }

  function wireChipClickToPlay(container) {
    container.addEventListener('click', (e) => {
      const chip = e.target.closest('.note-chip');
      if (!chip || !chip.dataset.midi) return;
      playSingleNote(Number(chip.dataset.midi));
    });
  }
  wireChipClickToPlay(westernOutput);
  wireChipClickToPlay(carnaticOutput);

  function playResult(result, button, outputEl) {
    stopPlayback();
    const events = buildPlaybackEvents(result);
    if (events.length === 0) return;

    const ctx = getAudioCtx();
    const noteDuration = getTempoSeconds();
    const phraseGap = noteDuration * 0.4;
    const chips = outputEl.querySelectorAll('.note-chip');
    const oscillators = [];
    const timeouts = [];
    let t = ctx.currentTime + 0.05;
    const startCtxTime = ctx.currentTime;

    events.forEach((ev, idx) => {
      if (ev.gapBefore) t += phraseGap;
      const freq = midiToFreq(ev.midi);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.25, t + 0.015);
      gain.gain.setValueAtTime(0.25, t + noteDuration - 0.06);
      gain.gain.linearRampToValueAtTime(0, t + noteDuration - 0.01);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + noteDuration);
      oscillators.push(osc);

      const chip = chips[idx];
      if (chip) {
        const startMs = (t - startCtxTime) * 1000;
        const endMs = startMs + noteDuration * 1000 - 20;
        timeouts.push(setTimeout(() => chip.classList.add('playing'), startMs));
        timeouts.push(setTimeout(() => chip.classList.remove('playing'), Math.max(startMs, endMs)));
      }
      t += noteDuration;
    });

    const totalMs = (t - startCtxTime) * 1000;
    function finish() {
      button.textContent = '▶ Play';
      button.classList.remove('playing');
      chips.forEach((c) => c.classList.remove('playing'));
      activePlayback = null;
    }
    timeouts.push(setTimeout(finish, totalMs));

    activePlayback = {
      stop() {
        oscillators.forEach((o) => { try { o.stop(); } catch (e) { /* already stopped */ } });
        timeouts.forEach((id) => clearTimeout(id));
        finish();
      },
    };
    button.textContent = '⏹ Stop';
    button.classList.add('playing');
  }

  function wirePlayButton(button, getResult, outputEl) {
    button.addEventListener('click', () => {
      if (button.classList.contains('playing')) {
        stopPlayback();
      } else {
        const result = getResult();
        if (result) playResult(result, button, outputEl);
      }
    });
  }

  let lastWesternResult = null;
  let lastCarnaticResult = null;
  wirePlayButton(playWesternBtn, () => lastWesternResult, westernOutput);
  wirePlayButton(playCarnaticBtn, () => lastCarnaticResult, carnaticOutput);

  toWesternBtn.addEventListener('click', () => {
    const { name, octave } = currentTonic();
    stopPlayback();
    lastWesternResult = null;
    playWesternBtn.disabled = true;
    try {
      const result = carnaticToWestern(carnaticInput.value, name, octave);
      const tuningKey = tabInstrumentSel.value;
      if (tuningKey) {
        renderTabPhrases(westernOutput, result, tuningKey);
      } else {
        renderPhrases(
          westernOutput,
          result,
          (n) => `<div class="note-chip" data-midi="${n.midi}" title="Click to hear this note"><span class="from">${n.input}</span><span class="to">${n.western}</span></div>`
        );
      }
      const hasNotes = result.phrases.some((p) => p.notes.length > 0);
      if (hasNotes) {
        lastWesternResult = result;
        playWesternBtn.disabled = false;
      }
    } catch (err) {
      renderError(westernOutput, err);
    }
  });

  toCarnaticBtn.addEventListener('click', () => {
    const { name, octave } = currentTonic();
    stopPlayback();
    lastCarnaticResult = null;
    playCarnaticBtn.disabled = true;
    try {
      const tabConverted = tabTextToNoteText(westernInput.value);
      const result = westernToCarnatic(tabConverted !== null ? tabConverted : westernInput.value, name, octave);
      renderPhrases(
        carnaticOutput,
        result,
        (n) => `<div class="note-chip" data-midi="${n.midi}" title="Click to hear this note"><span class="from">${n.input}</span><span class="to">${n.swara}</span>${n.altSwara ? `<span class="alt">or ${n.altSwara}</span>` : ''}</div>`
      );
      const hasNotes = result.phrases.some((p) => p.notes.length > 0);
      if (hasNotes) {
        lastCarnaticResult = result;
        playCarnaticBtn.disabled = false;
      }
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
  /**
   * Legacy .doc (pre-2007, binary OLE format) has no lightweight browser
   * parser like .docx does. Best-effort fallback: decode the file as
   * UTF-16LE (how Word stores its text runs) and pull out the printable
   * stretches, the same trick as the Unix `strings` tool. This is not a
   * real .doc parser and can pick up stray fragments of formatting data
   * as noise — always review the result before translating.
   */
  async function extractDoc(file) {
    const buffer = await readAsArrayBuffer(file);
    const bytes = new Uint8Array(buffer);
    let raw = '';
    for (let i = 0; i + 1 < bytes.length; i += 2) {
      const code = bytes[i] | (bytes[i + 1] << 8);
      if (code === 0x0d || code === 0x0a) raw += '\n';
      else if (code === 0x09 || (code >= 0x20 && code < 0x7f)) raw += String.fromCharCode(code);
      else raw += '\x00';
    }
    const text = raw
      .split(/\x00+/)
      .map((chunk) => chunk.trim())
      .filter((chunk) => chunk.length > 1 && /[A-Za-z0-9]/.test(chunk))
      .join(' ')
      .replace(/[ \t]+/g, ' ')
      .trim();
    if (!text) {
      throw new Error('Could not find readable text in this .doc file. Try re-saving it as .docx or .pdf, or copy/paste the notation directly.');
    }
    return text;
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
      statusEl.classList.remove('upload-error');
      statusEl.textContent = 'Reading document…';
      let job;
      let bestEffort = false;
      if (lower.endsWith('.docx')) job = extractDocx(file);
      else if (lower.endsWith('.doc')) { job = extractDoc(file); bestEffort = true; }
      else if (lower.endsWith('.pdf')) job = extractPdf(file);
      else job = readAsText(file);

      job
        .then((text) => {
          textareaEl.value = text.trim();
          statusEl.textContent = bestEffort
            ? 'Loaded from .doc — this is best-effort text extraction (legacy .doc has no reliable browser parser); please review carefully before translating.'
            : 'Loaded from document.';
        })
        .catch((err) => {
          statusEl.classList.add('upload-error');
          statusEl.textContent = `Couldn't read that file: ${err.message}`;
        })
        .finally(() => { inputEl.value = ''; });
    });
  }

  function wireImageUpload(inputEl, textareaEl, statusEl) {
    inputEl.addEventListener('change', () => {
      const file = inputEl.files[0];
      if (!file) return;
      statusEl.classList.remove('upload-error');
      if (typeof Tesseract === 'undefined') {
        statusEl.classList.add('upload-error');
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
          statusEl.classList.add('upload-error');
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
