import test from 'node:test';
import assert from 'node:assert/strict';
import { checkCompanionPair, checkCompanionFit } from '../src/lib/companions.js';
import { SPECIES } from '../src/data/species.js';

function find(id) {
  const s = SPECIES.find((s) => s.id === id);
  assert.ok(s, `missing species ${id}`);
  return s;
}

test('fennel is avoided next to anything (allelopathic)', () => {
  const fennel = find('fennel');
  const basil = find('thai-basil');
  const result = checkCompanionPair(fennel, basil);
  assert.equal(result.verdict, 'avoid');
});

test('nitrogen fixer pairs well with a heavy feeder', () => {
  const cowpeas = find('southern-peas'); // nitrogenFixer
  const okra = find('dwarf-okra'); // heavyFeeder
  const result = checkCompanionPair(cowpeas, okra);
  assert.equal(result.verdict, 'good');
});

test('trap crop helps a high-aphid-susceptibility neighbor', () => {
  const nasturtium = find('nasturtium'); // trapCrop
  const tomato = find('everglades-tomato'); // aphidSusceptibility medium
  const result = checkCompanionPair(nasturtium, tomato);
  assert.ok(result.score > 0);
});

test('checkCompanionFit vetoes a candidate if any existing plant is an avoid', () => {
  const fennel = find('fennel');
  const societyGarlic = find('society-garlic');
  const okinawaSpinach = find('okinawa-spinach');
  const result = checkCompanionFit(fennel, [societyGarlic, okinawaSpinach]);
  assert.equal(result.vetoed, true);
  assert.equal(result.verdict, 'avoid');
});

test('checkCompanionFit is neutral with nothing selected yet', () => {
  const societyGarlic = find('society-garlic');
  const result = checkCompanionFit(societyGarlic, []);
  assert.equal(result.verdict, 'neutral');
  assert.equal(result.vetoed, false);
});
