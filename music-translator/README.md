# Carnatic &harr; Western Note Translator

A small web app that translates Carnatic swara notation (S R G M P D N, with
their variants) into Western note names (C D E F G A B, with octave), and
back &mdash; so a phrase you have written down for veena, violin, flute or
voice can be read off and played on piano, guitar, or bass.

**Try it:** open `index.html` in a browser. No build step, no server. Paste
directly into either text box (no length limit), or use the upload buttons.
Document/photo uploads load [Tesseract.js](https://github.com/naptha/tesseract.js),
[Mammoth.js](https://github.com/mwilliamson/mammoth.js), and
[PDF.js](https://mozilla.github.io/pdf.js/) from a CDN, so those need an
internet connection the first time; typing/pasting and `.txt`/`.md` uploads
work fully offline.

## How it works

Carnatic music names 16 "swarasthanas" (S, R1, R2, R3, G1, G2, G3, M1, M2, P,
D1, D2, D3, N1, N2, N3), but only 12 distinct pitches exist in an octave, the
same 12 as the Western chromatic scale. Two pairs are enharmonic (R3 = G2,
D3 = N2). `translator.js` encodes this mapping and does two things:

- **Carnatic &rarr; Western**: given a tonic (where Sa is set on your
  instrument, e.g. C4) and a swara phrase, computes each note's absolute
  pitch and its Western name.
- **Western &rarr; Carnatic**: the inverse, picking the conventional default
  swara name for the two ambiguous positions (G2 and N2) and showing the
  enharmonic alternate (R3 / D3) alongside it.

### Notation

- Notes are separated by commas and/or whitespace (any mix), e.g.
  `S, R2, G3` or `S R2 G3` or a whole line pasted straight out of a notation
  booklet.
- A bare letter with no digit (`R`, `G`, `M`, `D`, `N`) is read as its
  natural-scale (Sankarabharanam) variant.
- Octave markers: a trailing `'` raises by an octave (tara sthayi), a
  trailing `_` lowers by an octave (mandra sthayi). Repeat for multiple
  octaves, e.g. `P__`.
- Phrase markers: wrap a phrase in `।` &hellip; `॥` (danda / double danda,
  the beginning/end-of-phrase marks used in Indian notation) to keep it
  grouped on its own line in the output. Text with no danda marks at all is
  just translated as one phrase &mdash; you don't need them for simple input.
- Western notes: `C4`, `D#4`, `Gb5`, etc. Octave number is optional and
  defaults to the tonic's octave.

### Guitar / bass tablature

The Carnatic &rarr; Western panel has a **Show as** selector: switch it from
"Note names" to "Guitar tab" or "Bass tab" to get ASCII tablature instead of
note-name chips, using each instrument's standard tuning. For each note, the
highest-pitched string that can reach it within a comfortable fret span is
chosen (falling back to a wider span, then reporting the note as out of
range with `x` if it's below every open string) &mdash; a whole phrase tends
to land in roughly one hand position rather than jumping around the neck.

### Hearing it played back

Each output area has a **▶ Play** button (enabled once there's a translated
result). It plays the notes in order as simple synthesized tones (Web Audio,
no samples or external instrument needed) so you can hear what the phrase
should sound like before you pick up an instrument. Click it again mid-way
&mdash; it becomes **⏹ Stop** while playing &mdash; to stop immediately.
Phrases separated by danda marks get a short pause between them, and the
currently-sounding note is highlighted in the note-name view.

### Getting sheet music into the box

Three ways in, on both panels:

- **Copy/paste.** Both text boxes are plain, unlimited-length textareas &mdash;
  paste in as much notation as you have, a whole piece at once if you like.
- **Upload document.** Accepts `.txt`, `.md`, `.docx`, and `.pdf`. `.txt`/`.md`
  load exactly as written; `.docx` and `.pdf` have their text extracted in
  your browser (via Mammoth.js and PDF.js) and dropped into the box. A
  scanned/image-only PDF has no extractable text, so that falls back to the
  photo path below.
- **Upload photo (OCR).** Runs OCR (text recognition) on a photo in your
  browser and drops the result into the box for you to review and correct
  before translating. Works reasonably well on a clear photo of *printed
  swara text* (like a notation booklet); handwriting and low-contrast scans
  will need more correction.

**It cannot read actual Western staff notation** &mdash; a photo or scan of
notes sitting on a five-line staff. That's optical music recognition, a
much harder and separate problem from text OCR/extraction, and isn't
supported. For staff notation, type in the note names by hand as you read
them off the page.

## Scope and limitations

This is a **note-name translator**, not a full transcription tool. It maps
individual swara pitches to Western note names relative to a chosen tonic.
It does not currently:

- Recognize noteheads on a Western staff (see above).
- Represent gamakas (the oscillations/ornaments central to how Carnatic
  music actually sounds) &mdash; Western 12-tone notation can't capture those,
  and playback is plain, even-tempered tones, not a performance.

A library of pre-entered songs (Vara Veena and others) to translate on load
would be a reasonable next step if this becomes more than a note reference.

## Tests

```
node test.js
```
