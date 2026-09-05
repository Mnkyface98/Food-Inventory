// Environmental-fit scoring for a single species against a site + container.
//
// Mirrors the reasoning worked out by hand in the balcony-gardening
// conversation this app is built from: zone is a hard filter, sun hours is
// the primary score (a real proxy computed from actual hours available,
// not compass direction — direction is only ever used to help a human
// *estimate* hours, never as a scoring input itself), salt/wind are
// conditional penalties, and pest pressure gets weighted by container
// position (floor-standing containers get less wind-driven pest knockback
// and easier crawling-pest access than a railing box several feet up).

const TOLERANCE_RANK = { low: 0, medium: 1, high: 2 };

const SALT_EXPOSURE_RANK = {
  inland: 0,
  coastal: 1,
  'near-coastal': 2,
  waterfront: 3,
};

// container.windExposure is a 1-5 self-rated score (1 = sheltered, 5 = very
// exposed); map plant windTolerance to the top exposure rating it handles
// comfortably.
const WIND_TOLERANCE_MAX_EXPOSURE = { low: 2, medium: 3, high: 5 };

function overlapFraction(need, have) {
  // need: {min,max} plant wants; have: number of hours actually available.
  if (have >= need.min && have <= need.max + 2) {
    // Within or just above the ideal band — full or near-full credit.
    return have > need.max ? 0.85 : 1;
  }
  if (have < need.min) {
    const deficit = need.min - have;
    return Math.max(0, 1 - deficit / need.min);
  }
  return 0.5; // well above max — usually fine for full-sun plants, mild for others
}

/**
 * @param {object} plant a SPECIES entry
 * @param {object} container { sunHours, windExposure (1-5), depthIn, position: 'rail_box'|'floor_standing' }
 * @param {object} site { zone, saltProximity, month } month = 1-12, optional
 * @param {object} options { preferExotic, excludeToxic, excludeVines, excludeHot, seasonalOnly }
 * @returns {{excluded: true, reason: string}|{excluded:false, score:number, breakdown:object, reasons:string[]}}
 */
export function scoreEnvironmentalFit(plant, container, site, options = {}) {
  const {
    preferExotic = true,
    excludeToxic = true,
    excludeVines = true,
    excludeHot = false,
    seasonalOnly = false,
  } = options;

  // --- Hard filters ---
  if (site.zone < plant.zone.min || site.zone > plant.zone.max) {
    return { excluded: true, reason: `Zone ${site.zone} is outside this plant's range (${plant.zone.min}-${plant.zone.max}).` };
  }
  if (excludeToxic && plant.toxicity.status === 'toxic') {
    return { excluded: true, reason: `Toxic (${plant.toxicity.source}).` };
  }
  if (excludeVines && plant.vine) {
    return { excluded: true, reason: 'Vining/sprawling habit — excluded by the "no vines" rule.' };
  }
  if (excludeHot && plant.heatLevel === 'hot') {
    return { excluded: true, reason: 'Hot pepper — excluded by the "no hot peppers" rule.' };
  }
  if (container.depthIn != null && plant.minDepthIn > container.depthIn) {
    return { excluded: true, reason: `Needs at least ${plant.minDepthIn}" of depth; container is only ${container.depthIn}".` };
  }
  if (seasonalOnly && plant.bestMonths && site.month && !plant.bestMonths.includes(site.month)) {
    return { excluded: true, reason: `Not in its best planting window for this month.` };
  }

  const reasons = [];

  // --- Sun ---
  const sunHours = container.sunHours ?? site.sunHours;
  const sunScore = sunHours == null ? 0.6 : overlapFraction(plant.sunHours, sunHours);
  reasons.push(
    sunHours == null
      ? 'No sun-hours reading given — scored neutrally.'
      : `Wants ${plant.sunHours.min}-${plant.sunHours.max}h direct sun; container gets ~${sunHours}h.`
  );

  // --- Salt ---
  const saltExposureRank = SALT_EXPOSURE_RANK[site.saltProximity] ?? 1;
  const saltToleranceRank = TOLERANCE_RANK[plant.saltTolerance] ?? 1;
  const saltScore = saltToleranceRank >= saltExposureRank ? 1 : Math.max(0, 1 - (saltExposureRank - saltToleranceRank) * 0.35);
  reasons.push(`Salt tolerance ${plant.saltTolerance} vs. ${site.saltProximity || 'unspecified'} exposure.`);

  // --- Wind ---
  const windExposure = container.windExposure ?? site.windExposure ?? 3;
  const maxHandled = WIND_TOLERANCE_MAX_EXPOSURE[plant.windTolerance] ?? 3;
  const windScore = windExposure <= maxHandled ? 1 : Math.max(0, 1 - (windExposure - maxHandled) * 0.3);
  reasons.push(`Wind tolerance ${plant.windTolerance} vs. exposure rating ${windExposure}/5.`);

  // --- Pest pressure, weighted by position ---
  // Floor level gets less wind-driven knockback on soft-bodied pests and
  // easier crawling-pest (ant/aphid-farming) access, so susceptibility
  // matters more there than at railing height.
  const susceptibilityPenalty = { low: 0, medium: 0.08, high: 0.18 }[plant.aphidSusceptibility] ?? 0.08;
  const positionMultiplier = container.position === 'floor_standing' ? 1.4 : 1;
  const pestScore = 1 - susceptibilityPenalty * positionMultiplier;
  if (plant.aphidSusceptibility !== 'low') {
    reasons.push(
      `${plant.aphidSusceptibility === 'high' ? 'High' : 'Medium'} aphid draw` +
        (container.position === 'floor_standing' ? ' (weighted up — floor level loses wind-driven pest knockback and gets easier crawling-pest access).' : '.')
    );
  }

  // --- Exotic bonus ---
  const exoticBonus = preferExotic && plant.exotic ? 0.08 : 0;
  if (preferExotic && plant.exotic) reasons.push(`${plant.origin} origin — matches "prefer exotic".`);

  const score =
    sunScore * 0.35 +
    saltScore * 0.2 +
    windScore * 0.2 +
    pestScore * 0.17 +
    0.08 /* base */ +
    exoticBonus;

  return {
    excluded: false,
    score: Math.max(0, Math.min(1, score)),
    breakdown: { sunScore, saltScore, windScore, pestScore, exoticBonus },
    reasons,
  };
}
