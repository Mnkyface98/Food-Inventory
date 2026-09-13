const assert = require('assert');
const {
  carnaticToWestern, westernToCarnatic, splitPhrases, buildTab, noteNameToMidi,
  extractTabBlocks, parseTabBlock, tabTextToNoteText,
} = require('./translator');

function westernOf(text, tonic = 'C', octave = 4) {
  return carnaticToWestern(text, tonic, octave).phrases.flatMap((p) => p.notes.map((n) => n.western));
}
function swaraOf(text, tonic = 'C', octave = 4) {
  return westernToCarnatic(text, tonic, octave).phrases.flatMap((p) => p.notes.map((n) => n.swara));
}

// Sankarabharanam scale from Sa=C4, comma-separated, maps onto a plain C major scale.
assert.deepStrictEqual(
  westernOf("S, R2, G3, M1, P, D2, N3, S'"),
  ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5']
);

// Space-separated still works identically.
assert.deepStrictEqual(
  westernOf("S R2 G3 M1 P D2 N3 S'"),
  ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5']
);

// Round trip: translating that back should recover the swaras (default variants).
assert.deepStrictEqual(
  swaraOf('C4 D4 E4 F4 G4 A4 B4 C5'),
  ['S', 'R2', 'G3', 'M1', 'P', 'D2', 'N3', "S'"]
);

// Octave markers now use ' (up) and _ (down); comma is a pure separator.
assert.deepStrictEqual(westernOf('S_, P, S, P__'), ['C3', 'G4', 'C4', 'G2']);

// Bare letters fall back to the natural-scale variant.
assert.deepStrictEqual(
  westernOf('S R G M P D N', 'D', 4),
  ['D4', 'E4', 'F#4', 'G4', 'A4', 'B4', 'C#5']
);

// Ambiguous semitone (offset 3) reports both R3 and G2.
const amb = westernToCarnatic('D#4', 'C', 4).phrases[0].notes[0];
assert.strictEqual(amb.swara, 'G2');
assert.strictEqual(amb.altSwara, 'R3');

// Danda-marked phrases split into separate groups, each translated on its own.
const marked = carnaticToWestern('। S, R2, G3 ॥ । M1, P, D2, N3, S\' ॥', 'C', 4);
assert.strictEqual(marked.phrases.length, 2);
assert.strictEqual(marked.phrases[0].marked, true);
assert.deepStrictEqual(marked.phrases[0].notes.map((n) => n.western), ['C4', 'D4', 'E4']);
assert.deepStrictEqual(marked.phrases[1].notes.map((n) => n.western), ['F4', 'G4', 'A4', 'B4', 'C5']);

// Unmarked, multi-line pasted text is treated as one phrase and whitespace/newlines both split notes.
const pasted = carnaticToWestern('S R2\nG3   M1\tP', 'C', 4);
assert.strictEqual(pasted.phrases.length, 1);
assert.strictEqual(pasted.phrases[0].marked, false);
assert.deepStrictEqual(pasted.phrases[0].notes.map((n) => n.western), ['C4', 'D4', 'E4', 'F4', 'G4']);

// splitPhrases on empty input returns no phrases.
assert.deepStrictEqual(splitPhrases('   '), []);

// Guitar tab: an open-position C major scale from C4 lands on the top two strings.
{
  const midis = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'].map((n) => noteNameToMidi(n.slice(0, -1), Number(n.slice(-1))));
  const { lines, outOfRange } = buildTab(midis, 'guitar');
  assert.strictEqual(lines.length, 6); // one line per guitar string
  assert.strictEqual(lines[0][0], 'E'); // highest string (E4) shown first
  assert.strictEqual(lines[5][0], 'E'); // lowest string (E2) shown last
  assert.deepStrictEqual(outOfRange, []);
}

// A note below every open string on bass (4-string, lowest open = E1) is reported out of range.
{
  const tooLow = noteNameToMidi('C', 0);
  const { outOfRange } = buildTab([tooLow], 'bass');
  assert.deepStrictEqual(outOfRange, [tooLow]);
}

// Round trip: buildTab's own output parses back to the same note sequence.
{
  const notes = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'];
  const midis = notes.map((n) => noteNameToMidi(n.slice(0, -1), Number(n.slice(-1))));
  const { lines } = buildTab(midis, 'guitar');
  assert.deepStrictEqual(parseTabBlock(lines), notes);
}

// A hand-typed guitar tab, laid out the way a person copying off a tab site
// actually would (uneven spacing, extra padding), still parses correctly.
{
  const tab = [
    'E|-----0-1-3-|',
    'B|-1-3-------|',
    'G|-----------|',
    'D|-----------|',
    'A|-----------|',
    'E|-----------|',
  ].join('\n');
  const blocks = extractTabBlocks(tab);
  assert.strictEqual(blocks.length, 1);
  assert.deepStrictEqual(parseTabBlock(blocks[0]), ['C4', 'D4', 'E4', 'F4', 'G4']);
}

// A partial tab (only the strings actually played, common on tab sites/
// hand-copied cheat sheets) parses correctly by matching string labels
// instead of requiring a full 6- or 4-line block.
{
  const tab = [
    'E|-----------|',
    'B|--5---5----|',
    'G|-----------|',
  ].join('\n');
  const blocks = extractTabBlocks(tab);
  assert.strictEqual(blocks.length, 1);
  // Open B string (B3) + fret 5 = E4, twice.
  assert.deepStrictEqual(parseTabBlock(blocks[0]), ['E4', 'E4']);
}

// An unlabeled full 4-line block still falls back to bass (line-count
// based) exactly as before this change.
{
  const tab = ['|--2--|', '|-----|', '|-----|', '|-----|'].join('\n');
  assert.deepStrictEqual(parseTabBlock(extractTabBlocks(tab)[0]), ['A2']);
}

// A partial tab labeled with guitar's unique "B" string resolves
// unambiguously to guitar even though B/G/D/A/E letters overlap with bass.
{
  const tab = ['B|--3--|', 'G|-----|'].join('\n');
  assert.deepStrictEqual(parseTabBlock(extractTabBlocks(tab)[0]), ['D4']);
}

// Labels that don't fit either tuning's order raise a clear error rather
// than silently misreading frets onto the wrong string.
assert.throws(() => parseTabBlock(['C|--1--|', 'F|--2--|']), /Couldn't match string labels/);

// tabTextToNoteText wraps each detected block in danda marks so it flows
// straight into westernToCarnatic as its own phrase.
{
  const tab = [
    'e|--0--|',
    'B|-----|',
    'G|-----|',
    'D|-----|',
    'A|-----|',
    'E|-----|',
  ].join('\n');
  const wrapped = tabTextToNoteText(tab);
  const result = westernToCarnatic(wrapped, 'C', 4);
  assert.strictEqual(result.phrases.length, 1);
  assert.strictEqual(result.phrases[0].marked, true);
  // Fret 0 on the open high E string is E4, which is G3 relative to a C4 tonic.
  assert.deepStrictEqual(result.phrases[0].notes.map((n) => n.swara), ['G3']);
}

// Plain note-name text (no "|") is not mistaken for tab.
assert.strictEqual(tabTextToNoteText('S, R2, G3'), null);

console.log('All translator tests passed.');
