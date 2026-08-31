const assert = require('assert');
const { carnaticToWestern, westernToCarnatic } = require('./translator');

// Sankarabharanam scale from Sa=C4 should map onto a plain C major scale.
const up = carnaticToWestern("S R2 G3 M1 P D2 N3 S'", 'C', 4).map((r) => r.western);
assert.deepStrictEqual(up, ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5']);

// Round trip: translating that back should recover the swaras (default variants).
const back = westernToCarnatic('C4 D4 E4 F4 G4 A4 B4 C5', 'C', 4).map((r) => r.swara);
assert.deepStrictEqual(back, ['S', 'R2', 'G3', 'M1', 'P', 'D2', 'N3', "S'"]);

// Octave markers.
const oct = carnaticToWestern('S, P S P,,', 'C', 4).map((r) => r.western);
assert.deepStrictEqual(oct, ['C3', 'G4', 'C4', 'G2']);

// Bare letters fall back to the natural-scale variant.
const bare = carnaticToWestern('S R G M P D N', 'D', 4).map((r) => r.western);
assert.deepStrictEqual(bare, ['D4', 'E4', 'F#4', 'G4', 'A4', 'B4', 'C#5']);

// Ambiguous semitone (offset 3) reports both R3 and G2.
const amb = westernToCarnatic('D#4', 'C', 4)[0];
assert.strictEqual(amb.swara, 'G2');
assert.strictEqual(amb.altSwara, 'R3');

// Non-C tonic (Sa = G4): a Vara Veena-style Kalyani phrase.
const kalyani = carnaticToWestern('S R2 G3 M2 P D2 N3', 'G', 4).map((r) => r.western);
assert.deepStrictEqual(kalyani, ['G4', 'A4', 'B4', 'C#5', 'D5', 'E5', 'F#5']);

console.log('All translator tests passed.');
