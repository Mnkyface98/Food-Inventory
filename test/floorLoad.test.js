import test from 'node:test';
import assert from 'node:assert/strict';
import { computeFloorLoad } from '../src/lib/floorLoad.js';

test('computes wet weight and required capacity from dimensions', () => {
  const result = computeFloorLoad({ lengthIn: 48, widthIn: 24, depthIn: 14, containerTareLb: 15, plantEstimateLb: 10 });
  assert.ok(result.volumeCuFt > 0);
  assert.ok(result.totalWeightLb > result.soilWeightLb); // tare + plants added on top
  assert.ok(result.requiredCapacityLbPerSqft > 0);
});

test('passes when under the rated capacity, fails when over', () => {
  const base = { lengthIn: 48, widthIn: 24, depthIn: 14, containerTareLb: 15, plantEstimateLb: 10 };
  const generous = computeFloorLoad({ ...base, ratedCapacityLbPerSqft: 500 });
  const strict = computeFloorLoad({ ...base, ratedCapacityLbPerSqft: 5 });
  assert.equal(generous.pass, true);
  assert.equal(strict.pass, false);
});

test('flags when falling back to the default rated capacity', () => {
  const result = computeFloorLoad({ lengthIn: 24, widthIn: 12, depthIn: 10, containerTareLb: 5, plantEstimateLb: 5 });
  assert.equal(result.usingDefaultRating, true);
  assert.match(result.warning, /building management/);
});
