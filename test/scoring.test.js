import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreEnvironmentalFit } from '../src/lib/scoring.js';
import { SPECIES } from '../src/data/species.js';

function find(id) {
  const s = SPECIES.find((s) => s.id === id);
  assert.ok(s, `missing species ${id}`);
  return s;
}

test('excludes toxic plants by default', () => {
  const portulaca = find('portulaca');
  const result = scoreEnvironmentalFit(portulaca, { sunHours: 8, windExposure: 4 }, { zone: 11, saltProximity: 'near-coastal' });
  assert.equal(result.excluded, true);
  assert.match(result.reason, /Toxic/);
});

test('allows toxic plants when excludeToxic is turned off', () => {
  const portulaca = find('portulaca');
  const result = scoreEnvironmentalFit(
    portulaca,
    { sunHours: 8, windExposure: 4 },
    { zone: 11, saltProximity: 'near-coastal' },
    { excludeToxic: false }
  );
  assert.equal(result.excluded, false);
});

test('excludes plants outside the site zone', () => {
  const lavender = find('lavender'); // zone 5-8
  const result = scoreEnvironmentalFit(lavender, { sunHours: 8, windExposure: 3 }, { zone: 11, saltProximity: 'coastal' });
  assert.equal(result.excluded, true);
  assert.match(result.reason, /Zone/);
});

test('excludes vines when excludeVines is on (default)', () => {
  const bougainvillea = find('bougainvillea');
  const result = scoreEnvironmentalFit(bougainvillea, { sunHours: 8, windExposure: 3 }, { zone: 11, saltProximity: 'coastal' });
  assert.equal(result.excluded, true);
  assert.match(result.reason, /vine/i);
});

test('excludes hot peppers only when the rule is turned on', () => {
  const datil = find('datil-pepper');
  const allowed = scoreEnvironmentalFit(datil, { sunHours: 8, windExposure: 3 }, { zone: 11, saltProximity: 'coastal' }, { excludeHot: false });
  assert.equal(allowed.excluded, false);
  const excluded = scoreEnvironmentalFit(datil, { sunHours: 8, windExposure: 3 }, { zone: 11, saltProximity: 'coastal' }, { excludeHot: true });
  assert.equal(excluded.excluded, true);
});

test('respects minimum container depth', () => {
  const roselle = find('roselle'); // minDepthIn 14
  const result = scoreEnvironmentalFit(roselle, { sunHours: 8, windExposure: 3, depthIn: 8 }, { zone: 11, saltProximity: 'coastal' });
  assert.equal(result.excluded, true);
  assert.match(result.reason, /depth/i);
});

test('seasonal filter excludes nasturtium outside its best months', () => {
  const nasturtium = find('nasturtium');
  const result = scoreEnvironmentalFit(
    nasturtium,
    { sunHours: 6, windExposure: 3 },
    { zone: 11, saltProximity: 'coastal', month: 9 },
    { seasonalOnly: true }
  );
  assert.equal(result.excluded, true);
});

test('nasturtium passes in its cool-season window', () => {
  const nasturtium = find('nasturtium');
  const result = scoreEnvironmentalFit(
    nasturtium,
    { sunHours: 6, windExposure: 3 },
    { zone: 11, saltProximity: 'coastal', month: 12 },
    { seasonalOnly: true }
  );
  assert.equal(result.excluded, false);
});

test('floor-standing position weights pest pressure up for high-aphid plants', () => {
  const nasturtium = find('nasturtium'); // aphidSusceptibility: high
  const rail = scoreEnvironmentalFit(nasturtium, { sunHours: 6, windExposure: 3, position: 'rail_box' }, { zone: 11, saltProximity: 'coastal' });
  const floor = scoreEnvironmentalFit(nasturtium, { sunHours: 6, windExposure: 3, position: 'floor_standing' }, { zone: 11, saltProximity: 'coastal' });
  assert.ok(floor.breakdown.pestScore < rail.breakdown.pestScore);
});
