import { SPECIES, CATEGORIES } from '../data/species.js';
import { scoreEnvironmentalFit } from './scoring.js';
import { checkCompanionFit } from './companions.js';

/**
 * How many linear inches of a container's length are already spoken for by
 * a fixed list of species ids.
 */
export function spaceUsedIn(speciesList, plantIds) {
  return plantIds.reduce((sum, id) => {
    const p = speciesList.find((s) => s.id === id);
    return sum + (p ? p.matureSpreadIn : 0);
  }, 0);
}

function candidatesPassingHardFilters(speciesList, container, site, options) {
  return speciesList
    .map((plant) => ({ plant, fit: scoreEnvironmentalFit(plant, container, site, options) }))
    .filter(({ fit }) => !fit.excluded);
}

/**
 * Single-row greedy fill: given a container and a set of already-selected
 * species ids, keep adding the best-scoring candidate that still fits the
 * remaining length, until nothing fits. This is a single greedy pass (best
 * fit first, no backtracking) — it can end a few inches short of optimal
 * the way a human filling a shelf left-to-right would, and it only handles
 * one row (a much wider planter would need real 2D packing).
 *
 * @param {object} container { lengthIn, widthIn, depthIn, sunHours, windExposure, position }
 * @param {object} site { zone, saltProximity, windExposure, month }
 * @param {object} options { focus: 'mix'|'herb'|'vegetable'|'flower'|'foliage',
 *                            existingIds: string[], preferExotic, excludeToxic,
 *                            excludeVines, excludeHot, seasonalOnly, speciesList }
 */
export function recommendBox(container, site, options = {}) {
  const { focus = 'mix', existingIds = [], speciesList = SPECIES } = options;

  const existing = existingIds.map((id) => speciesList.find((s) => s.id === id)).filter(Boolean);
  let remainingIn = container.lengthIn - spaceUsedIn(speciesList, existingIds);

  const placed = [...existing];
  const placedIds = new Set(existingIds);
  const rejected = [];

  const scored = () =>
    candidatesPassingHardFilters(speciesList, container, site, options)
      .filter(({ plant }) => !placedIds.has(plant.id))
      .filter(({ plant }) => focus === 'mix' || plant.category === focus)
      .map(({ plant, fit }) => {
        const companion = checkCompanionFit(plant, placed);
        return { plant, fit, companion, combined: fit.score * 0.6 + Math.max(0, companion.score) * 0.4 };
      })
      .filter(({ companion }) => !companion.vetoed)
      .sort((a, b) => b.combined - a.combined);

  function tryFillCategory(category) {
    const pool = scored().filter(({ plant }) => plant.category === category);
    for (const candidate of pool) {
      if (candidate.plant.matureSpreadIn <= remainingIn) {
        placed.push(candidate.plant);
        placedIds.add(candidate.plant.id);
        remainingIn -= candidate.plant.matureSpreadIn;
        return candidate;
      }
    }
    return null;
  }

  if (focus === 'mix') {
    // Seed one pick per category not yet represented, before filling freely.
    const representedCategories = new Set(placed.map((p) => p.category));
    for (const category of CATEGORIES) {
      if (!representedCategories.has(category)) {
        tryFillCategory(category);
      }
    }
  }

  // Free fill with whatever's left, across the whole (or focused) pool.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const pool = scored().filter(({ plant }) => plant.matureSpreadIn <= remainingIn);
    if (pool.length === 0) break;
    const best = pool[0];
    placed.push(best.plant);
    placedIds.add(best.plant.id);
    remainingIn -= best.plant.matureSpreadIn;
  }

  // Record why anything left over didn't make it, for transparency.
  const stillPassing = candidatesPassingHardFilters(speciesList, container, site, options).filter(
    ({ plant }) => !placedIds.has(plant.id) && (focus === 'mix' || plant.category === focus)
  );
  for (const { plant } of stillPassing) {
    if (plant.matureSpreadIn > remainingIn) {
      rejected.push({ plant, reason: `Needs ${plant.matureSpreadIn}" but only ${remainingIn.toFixed(1)}" remain.` });
    }
  }

  return {
    placed: placed.map((p) => ({ id: p.id, commonName: p.commonName, category: p.category, matureSpreadIn: p.matureSpreadIn })),
    remainingIn: Math.max(0, remainingIn),
    totalLengthIn: container.lengthIn,
    rejected: rejected.map((r) => ({ id: r.plant.id, commonName: r.plant.commonName, reason: r.reason })),
  };
}

/**
 * "Suggest missing" mode — given a partial box (existing selections) and
 * remaining space, return a ranked list of candidates rather than a single
 * greedy fill. Distinct from recommendBox, which commits to picks.
 */
export function suggestMissing(container, site, options = {}) {
  const { existingIds = [], focus = 'mix', speciesList = SPECIES } = options;
  const existing = existingIds.map((id) => speciesList.find((s) => s.id === id)).filter(Boolean);
  const remainingIn = container.lengthIn - spaceUsedIn(speciesList, existingIds);

  const candidates = candidatesPassingHardFilters(speciesList, container, site, options)
    .filter(({ plant }) => !existingIds.includes(plant.id))
    .filter(({ plant }) => focus === 'mix' || plant.category === focus)
    .map(({ plant, fit }) => {
      const companion = checkCompanionFit(plant, existing);
      const fits = plant.matureSpreadIn <= remainingIn;
      return {
        id: plant.id,
        commonName: plant.commonName,
        category: plant.category,
        matureSpreadIn: plant.matureSpreadIn,
        fitScore: fit.score,
        fitReasons: fit.reasons,
        companionVerdict: companion.verdict,
        companionReasons: companion.reasons,
        fits,
        combined: fit.score * 0.6 + Math.max(0, companion.score) * 0.4,
      };
    })
    .filter((c) => c.companionVerdict !== 'avoid')
    .sort((a, b) => (b.fits - a.fits) || b.combined - a.combined);

  return { remainingIn: Math.max(0, remainingIn), candidates };
}

/**
 * How many of a single species could fit in a container on their own,
 * plus a spacing warning if the requested count would be tighter than
 * textbook mature-spread spacing (fine for a filled-in ornamental look,
 * but worth flagging).
 */
export function capacityForSpecies(container, plant, count) {
  const totalNeeded = plant.matureSpreadIn * count;
  const maxCount = Math.floor(container.lengthIn / plant.matureSpreadIn);
  return {
    requestedCount: count,
    totalNeededIn: totalNeeded,
    availableIn: container.lengthIn,
    maxAtFullSpacing: maxCount,
    tight: count > maxCount,
    overageIn: Math.max(0, totalNeeded - container.lengthIn),
  };
}
