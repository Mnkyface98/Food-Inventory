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
 * Parse one Carnatic swara token, e.g. "G3", "R", "S'", "P,,"
 * Trailing "'" marks raise by one octave (tara sthayi) each,
 * trailing "," marks lower by one octave (mandra sthayi) each.
 */
function parseSwaraToken(token) {
  const m = token.match(/^([SRGMPDN])([123]?)([',]*)$/i);
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
    else if (ch === ',') octaveShift -= 1;
  }

  return { swara, octaveShift };
}

/**
 * Translate a space-separated Carnatic swara phrase into Western note
 * names + octaves, relative to a chosen tonic (Sa).
 */
function carnaticToWestern(phrase, tonicName = 'C', tonicOctave = 4) {
  const tonicMidi = noteNameToMidi(tonicName, tonicOctave);
  const tokens = phrase.trim().split(/\s+/).filter(Boolean);

  return tokens.map((tok) => {
    const { swara, octaveShift } = parseSwaraToken(tok);
    const semitone = SWARA_TO_SEMITONE[swara];
    const midi = tonicMidi + semitone + 12 * octaveShift;
    const { name, octave } = midiToNoteName(midi);
    return { input: tok, swara, western: `${name}${octave}` };
  });
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
 * Translate a space-separated Western note phrase into Carnatic
 * swaras, relative to a chosen tonic (Sa).
 */
function westernToCarnatic(phrase, tonicName = 'C', tonicOctave = 4) {
  const tonicMidi = noteNameToMidi(tonicName, tonicOctave);
  const tokens = phrase.trim().split(/\s+/).filter(Boolean);

  return tokens.map((tok) => {
    const { name, octave } = parseWesternToken(tok, tonicOctave);
    const midi = noteNameToMidi(name, octave);
    const diff = midi - tonicMidi;
    const semitone = ((diff % 12) + 12) % 12;
    const octaveShift = Math.floor(diff / 12);

    const { name: swaraName, alt } = SEMITONE_TO_SWARA[semitone];
    let marks = '';
    if (octaveShift > 0) marks = "'".repeat(octaveShift);
    else if (octaveShift < 0) marks = ','.repeat(-octaveShift);

    const swara = swaraName + marks;
    const altSwara = alt ? alt + marks : null;
    return { input: tok, western: `${name}${octave}`, swara, altSwara };
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { carnaticToWestern, westernToCarnatic, SWARA_TO_SEMITONE, SEMITONE_TO_SWARA };
}
