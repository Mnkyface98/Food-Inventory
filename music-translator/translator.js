/**
 * Carnatic <-> Western note translator.
 *
 * Carnatic music uses 7 swara names (S R G M P D N) with up to three
 * variants each (except S and P, which are fixed). Across an octave
 * these 16 "swarasthanas" collapse onto the same 12 semitone positions
 * used in Western chromatic music - two pairs of variants are
 * enharmonic (R3 == G2, and D3 == N2), so the mapping from swara to
 * semitone is exact, but the reverse (semitone -> swara) is ambiguous
 * for those two positions. We resolve that ambiguity with a sensible
 * default (G2 and N2, the pair used by Sankarabharanam / the major
 * scale) and show the alternate name alongside it.
 *
 * Notation accepted (so a whole line of written sheet music can be
 * pasted in as-is):
 *   - notes are separated by commas and/or whitespace: "S, R2, G3" or "S R2 G3"
 *   - a trailing "'" raises a note an octave (tara sthayi), "_" lowers
 *     it an octave (mandra sthayi); both can repeat, e.g. "P__"
 *   - a phrase can be wrapped in danda marks, "। ... ॥", the
 *     beginning/end-of-phrase punctuation used in Indian notation.
 *     Multiple ।...॥ phrases in one paste are each translated and
 *     shown on their own line. Text with no danda marks at all is
 *     just treated as one phrase.
 */

// swara name -> semitone offset from Shadja (S = 0)
const SWARA_TO_SEMITONE = {
  S: 0,
  R1: 1, R2: 2, R3: 3,
  G1: 2, G2: 3, G3: 4,
  M1: 5, M2: 6,
  P: 7,
  D1: 8, D2: 9, D3: 10,
  N1: 9, N2: 10, N3: 11,
};

// When a swara is written without its variant number, assume the
// variant used by the common "natural" scale (Sankarabharanam).
const BARE_SWARA_DEFAULT = { S: 'S', R: 'R2', G: 'G3', M: 'M1', P: 'P', D: 'D2', N: 'N3' };

// semitone offset -> preferred swara name, plus its enharmonic alternate.
const SEMITONE_TO_SWARA = [
  { name: 'S', alt: null },
  { name: 'R1', alt: null },
  { name: 'R2', alt: null },
  { name: 'G2', alt: 'R3' },
  { name: 'G3', alt: null },
  { name: 'M1', alt: null },
  { name: 'M2', alt: null },
  { name: 'P', alt: null },
  { name: 'D1', alt: null },
  { name: 'D2', alt: null },
  { name: 'N2', alt: 'D3' },
  { name: 'N3', alt: null },
];

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_TO_SHARP = { Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#' };

const DANDA = '।'; // ।
const DOUBLE_DANDA = '॥'; // ॥

function noteNameToSemitone(name) {
  const norm = FLAT_TO_SHARP[name] || name;
  const idx = SHARP_NAMES.indexOf(norm);
  if (idx === -1) throw new Error(`Unrecognized note name "${name}"`);
  return idx;
}

function noteNameToMidi(name, octave) {
  return noteNameToSemitone(name) + (octave + 1) * 12; // MIDI: C4 = 60
}

function midiToNoteName(midi) {
  const name = SHARP_NAMES[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return { name, octave };
}

/**
 * Split pasted text into phrases. If it contains danda marks, each
 * ।...॥ span becomes one phrase (shown on its own line in the output).
 * Otherwise the whole input is treated as a single, unmarked phrase.
 */
function splitPhrases(text) {
  const dandaPattern = new RegExp(`${DANDA}\\s*([^${DANDA}${DOUBLE_DANDA}]*?)\\s*${DOUBLE_DANDA}`, 'g');
  const phrases = [];
  let match;
  while ((match = dandaPattern.exec(text)) !== null) {
    phrases.push({ text: match[1].trim(), marked: true });
  }
  if (phrases.length === 0) {
    const trimmed = text.trim();
    return trimmed ? [{ text: trimmed, marked: false }] : [];
  }
  return phrases;
}

/** Split one phrase's text into note tokens on commas and/or whitespace. */
function tokenizePhrase(text) {
  return text.split(/[,\s]+/).map((t) => t.trim()).filter(Boolean);
}

/**
 * Parse one Carnatic swara token, e.g. "G3", "R", "S'", "P__"
 * Trailing "'" marks raise by one octave (tara sthayi) each,
 * trailing "_" marks lower by one octave (mandra sthayi) each.
 */
function parseSwaraToken(token) {
  const m = token.match(/^([SRGMPDN])([123]?)(['_]*)$/i);
  if (!m) throw new Error(`Unrecognized swara "${token}"`);
  const letter = m[1].toUpperCase();
  const digit = m[2];
  const marks = m[3] || '';

  let swara;
  if (digit) {
    swara = letter + digit;
    if (!(swara in SWARA_TO_SEMITONE)) throw new Error(`Unrecognized swara "${token}"`);
  } else {
    swara = BARE_SWARA_DEFAULT[letter];
  }

  let octaveShift = 0;
  for (const ch of marks) {
    if (ch === "'") octaveShift += 1;
    else if (ch === '_') octaveShift -= 1;
  }

  return { swara, octaveShift };
}

/**
 * Translate pasted Carnatic notation (one or more comma/space-separated,
 * optionally danda-marked phrases) into Western note names + octaves,
 * relative to a chosen tonic (Sa).
 *
 * Returns { phrases: [{ marked, notes: [{input, swara, western}] }] }
 */
function carnaticToWestern(text, tonicName = 'C', tonicOctave = 4) {
  const tonicMidi = noteNameToMidi(tonicName, tonicOctave);
  const phrases = splitPhrases(text).map(({ text: phraseText, marked }) => {
    const notes = tokenizePhrase(phraseText).map((tok) => {
      const { swara, octaveShift } = parseSwaraToken(tok);
      const semitone = SWARA_TO_SEMITONE[swara];
      const midi = tonicMidi + semitone + 12 * octaveShift;
      const { name, octave } = midiToNoteName(midi);
      return { input: tok, swara, western: `${name}${octave}`, midi };
    });
    return { marked, notes };
  });
  return { phrases };
}

/**
 * Parse one Western note token, e.g. "C4", "D#4", "Eb5", "G" (no octave
 * -> defaults to the tonic's octave).
 */
function parseWesternToken(token, defaultOctave) {
  const m = token.match(/^([A-Ga-g])([#b]?)(-?\d+)?$/);
  if (!m) throw new Error(`Unrecognized note "${token}"`);
  const name = m[1].toUpperCase() + (m[2] || '');
  const octave = m[3] !== undefined ? parseInt(m[3], 10) : defaultOctave;
  return { name, octave };
}

/**
 * Translate pasted Western notation (one or more comma/space-separated,
 * optionally danda-marked phrases) into Carnatic swaras, relative to a
 * chosen tonic (Sa).
 *
 * Returns { phrases: [{ marked, notes: [{input, western, swara, altSwara}] }] }
 */
function westernToCarnatic(text, tonicName = 'C', tonicOctave = 4) {
  const tonicMidi = noteNameToMidi(tonicName, tonicOctave);
  const phrases = splitPhrases(text).map(({ text: phraseText, marked }) => {
    const notes = tokenizePhrase(phraseText).map((tok) => {
      const { name, octave } = parseWesternToken(tok, tonicOctave);
      const midi = noteNameToMidi(name, octave);
      const diff = midi - tonicMidi;
      const semitone = ((diff % 12) + 12) % 12;
      const octaveShift = Math.floor(diff / 12);

      const { name: swaraName, alt } = SEMITONE_TO_SWARA[semitone];
      let marks = '';
      if (octaveShift > 0) marks = "'".repeat(octaveShift);
      else if (octaveShift < 0) marks = '_'.repeat(-octaveShift);

      const swara = swaraName + marks;
      const altSwara = alt ? alt + marks : null;
      return { input: tok, western: `${name}${octave}`, swara, altSwara, midi };
    });
    return { marked, notes };
  });
  return { phrases };
}

/**
 * Standard tunings, strings listed low to high. Each entry is a note name
 * + octave for that open string.
 */
const TUNINGS = {
  guitar: { label: 'Guitar (standard)', strings: [['E', 2], ['A', 2], ['D', 3], ['G', 3], ['B', 3], ['E', 4]] },
  bass: { label: 'Bass (standard, 4-string)', strings: [['E', 1], ['A', 1], ['D', 2], ['G', 2]] },
};

/**
 * For a MIDI note, pick which open string + fret plays it, preferring the
 * highest-pitched string that can reach it within a comfortable fret range
 * (keeps a whole phrase in roughly one hand position). Returns null if the
 * note is below every open string.
 */
function pickStringFret(midi, tuningMidis, comfortableMaxFret = 12) {
  for (let max of [comfortableMaxFret, 24]) {
    for (let i = tuningMidis.length - 1; i >= 0; i--) {
      const fret = midi - tuningMidis[i];
      if (fret >= 0 && fret <= max) return { stringIndex: i, fret };
    }
  }
  return null;
}

/**
 * Build ASCII tablature for a sequence of MIDI notes on a given tuning
 * ("guitar" or "bass"). Returns the tab as an array of lines (one per
 * string, highest string first, as tab is conventionally written) plus
 * the list of notes that fell outside the instrument's range.
 */
function buildTab(midiNotes, tuningKey) {
  const tuning = TUNINGS[tuningKey];
  if (!tuning) throw new Error(`Unknown tuning "${tuningKey}"`);
  const tuningMidis = tuning.strings.map(([name, octave]) => noteNameToMidi(name, octave));

  const positions = midiNotes.map((midi) => pickStringFret(midi, tuningMidis));
  const outOfRange = midiNotes.filter((_, i) => positions[i] === null);

  const colWidths = positions.map((pos) => (pos ? String(pos.fret).length : 1));
  const rows = tuning.strings
    .map(([name], stringIndex) => {
      const cells = positions.map((pos, col) => {
        const text = pos && pos.stringIndex === stringIndex ? String(pos.fret) : pos ? '' : 'x';
        return text.padStart(colWidths[col], '-');
      });
      return `${name}|-${cells.join('-')}-|`;
    })
    .reverse(); // display highest string on top, as tab conventionally is

  return { lines: rows, outOfRange };
}

/**
 * Recognize one line of ASCII guitar/bass tab: an optional short string
 * label, a "|", a body of dashes/fret numbers/technique letters, and an
 * optional closing "|". Requires a run of dashes so a note-name line like
 * "S, R2, G3" (which has no "|") never matches.
 */
const TAB_LINE_RE = /^\s*[A-Za-z0-9#]{0,3}\|(.*?)\|?\s*$/;
function looksLikeTabLine(line) {
  return TAB_LINE_RE.test(line) && /-{2,}/.test(line);
}

/**
 * Find contiguous runs of 2+ tab-like lines in pasted text (blocks
 * separated by blank/non-tab lines become separate phrases). Only runs
 * whose length matches a known tuning's string count (6 = guitar, 4 =
 * bass) are usable tab; other run lengths are returned too, so the caller
 * can report exactly what didn't parse rather than silently ignoring it.
 */
function extractTabBlocks(text) {
  const lines = text.split(/\r?\n/);
  const blocks = [];
  let current = [];
  for (const line of lines) {
    if (looksLikeTabLine(line)) {
      current.push(line);
    } else if (current.length) {
      blocks.push(current);
      current = [];
    }
  }
  if (current.length) blocks.push(current);
  return blocks.filter((b) => b.length >= 2);
}

/** Tuning key ("guitar"/"bass") for a block's line count, or null. */
function tuningForLineCount(count) {
  return Object.keys(TUNINGS).find((key) => TUNINGS[key].strings.length === count) || null;
}

/**
 * Parse one tab block (array of line strings, top line = highest-pitched
 * string, matching conventional tab layout and this app's own buildTab
 * output) into an ordered array of Western note tokens like "G4".
 */
function parseTabBlock(lines) {
  const tuningKey = tuningForLineCount(lines.length);
  if (!tuningKey) {
    throw new Error(`A ${lines.length}-line tab block doesn't match guitar (6 strings) or bass (4 strings) — check the paste.`);
  }
  const tuningHighToLow = TUNINGS[tuningKey].strings.slice().reverse();
  const bodies = lines.map((line) => (line.match(TAB_LINE_RE) || [, line])[1]);

  const events = [];
  bodies.forEach((body, rowIndex) => {
    const re = /\d+/g;
    let m;
    while ((m = re.exec(body)) !== null) {
      events.push({ col: m.index, rowIndex, fret: parseInt(m[0], 10) });
    }
  });
  events.sort((a, b) => a.col - b.col || a.rowIndex - b.rowIndex);

  return events.map(({ rowIndex, fret }) => {
    const [name, octave] = tuningHighToLow[rowIndex];
    const midi = noteNameToMidi(name, octave) + fret;
    const note = midiToNoteName(midi);
    return `${note.name}${note.octave}`;
  });
}

/**
 * Scan pasted text for ASCII tab blocks and rewrite it as plain,
 * danda-wrapped Western note tokens (one phrase per block) that
 * `westernToCarnatic` can already parse. Returns null if no tab-like
 * lines were found at all, so the caller can fall back to treating the
 * text as plain note names unchanged.
 */
function tabTextToNoteText(text) {
  const blocks = extractTabBlocks(text);
  if (blocks.length === 0) return null;
  return blocks.map((block) => `${DANDA} ${parseTabBlock(block).join(', ')} ${DOUBLE_DANDA}`).join('\n');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    carnaticToWestern, westernToCarnatic, splitPhrases, tokenizePhrase,
    SWARA_TO_SEMITONE, SEMITONE_TO_SWARA, DANDA, DOUBLE_DANDA,
    TUNINGS, buildTab, noteNameToMidi, midiToNoteName,
    extractTabBlocks, parseTabBlock, tabTextToNoteText, looksLikeTabLine,
  };
}
