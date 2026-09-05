import test from 'node:test';
import assert from 'node:assert/strict';
import { recommendBox, suggestMissing, capacityForSpecies, spaceUsedIn } from '../src/lib/packing.js';
import { SPECIES } from '../src/data/species.js';

const SITE = { zone: 11, saltProximity: 'near-coastal', windExposure: 4, month: 9 };
const CONTAINER = { lengthIn: 48, widthIn: 12, depthIn: 12, sunHours: 7, windExposure: 4, position: 'rail_box' };

test('recommendBox never exceeds the container length', () => {
  const result = recommendBox(CONTAINER, SITE, { focus: 'mix' });
  const used = spaceUsedIn(SPECIES, result.placed.map((p) => p.id));
  assert.ok(used <= CONTAINER.lengthIn, `used ${used} should be <= ${CONTAINER.lengthIn}`);
});

test('mix focus seeds at least one plant per represented category when space allows', () => {
  const result = recommendBox(CONTAINER, SITE, { focus: 'mix' });
  const categories = new Set(result.placed.map((p) => p.category));
  assert.ok(categories.size >= 3, `expected at least 3 categories, got ${[...categories]}`);
});

test('single-category focus only returns that category', () => {
  const result = recommendBox(CONTAINER, SITE, { focus: 'flower' });
  assert.ok(result.placed.every((p) => p.category === 'flower'));
});

test('recommendBox respects existing selections and remaining space', () => {
  const result = recommendBox(CONTAINER, SITE, { focus: 'mix', existingIds: ['society-garlic', 'okinawa-spinach', 'pentas'] });
  assert.ok(result.placed.some((p) => p.id === 'society-garlic'));
  assert.ok(result.remainingIn < CONTAINER.lengthIn);
});

test('suggestMissing ranks candidates and flags whether they fit', () => {
  const tightContainer = { ...CONTAINER, lengthIn: 38 };
  const result = suggestMissing(tightContainer, SITE, {
    focus: 'mix',
    existingIds: ['society-garlic', 'okinawa-spinach', 'pentas'],
  });
  assert.ok(result.candidates.length > 0);
  assert.ok('fits' in result.candidates[0]);
});

test('capacityForSpecies flags a tight fit', () => {
  const rosemary = SPECIES.find((s) => s.id === 'rosemary');
  const result = capacityForSpecies({ lengthIn: 48 }, rosemary, 3);
  assert.equal(result.tight, true);
});

test('capacityForSpecies allows a fit within max spacing', () => {
  const rosemary = SPECIES.find((s) => s.id === 'rosemary'); // 24in spread
  const result = capacityForSpecies({ lengthIn: 48 }, rosemary, 2);
  assert.equal(result.tight, false);
});
