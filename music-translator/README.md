# Carnatic &harr; Western Note Translator

A small web app that translates Carnatic swara notation (S R G M P D N, with
their variants) into Western note names (C D E F G A B, with octave), and
back &mdash; so a phrase you have written down for veena, violin, flute or
voice can be read off and played on piano, guitar, or bass.

**Try it:** open `index.html` in a browser. No build step, no server. The
photo-upload OCR feature loads [Tesseract.js](https://github.com/naptha/tesseract.js)
from a CDN, so that one feature needs an internet connection; everything else
works offline.

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

### Loading sheet music

Both panels have **Upload .txt** and **Upload photo (OCR)** buttons:

- A `.txt`/`.md` file loads exactly as written into the text box.
- A photo runs OCR (text recognition) in your browser and drops the result
  into the box for you to review and correct before translating. This works
  reasonably well on a clear photo of *printed swara text* (like a notation
  booklet); handwriting and low-contrast scans will need more correction.
- **It cannot read actual Western staff notation** &mdash; a photo of notes
  on a five-line staff. That's optical music recognition, a much harder and
  separate problem from text OCR, and isn't supported. For staff notation,
  type in the note names by hand as you read them off the page.

## Scope and limitations

This is a **note-name translator**, not a full transcription tool. It maps
individual swara pitches to Western note names relative to a chosen tonic.
It does not currently:

- Recognize noteheads on a Western staff (see above).
- Represent gamakas (the oscillations/ornaments central to how Carnatic
  music actually sounds) &mdash; Western 12-tone notation can't capture those.
- Play audio.

Those would be reasonable next steps if this becomes more than a note
reference &mdash; e.g. Web Audio playback of the translated phrase, or a
library of pre-entered songs (Vara Veena and others) to translate on load.

## Tests

```
node test.js
```
