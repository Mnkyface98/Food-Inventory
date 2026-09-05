// Floor-load estimate for a floor-standing container. This is a structural
// safety check, kept deliberately separate from the horticultural
// recommendations — the tool can estimate the load a setup would create,
// but the pass/fail threshold has to come from the building's actual rated
// capacity (from building management or condo docs), never a guessed code
// minimum.

const DEFAULT_WET_SOIL_DENSITY_LB_PER_CUFT = 85; // saturated potting mix, mid of the 75-90 lb/cu ft range
const DEFAULT_RATED_CAPACITY_LB_PER_SQFT = 40; // commonly-cited residential minimum — NOT a real value, just a placeholder

/**
 * @param {object} input
 *   lengthIn, widthIn, depthIn — container interior dimensions
 *   containerTareLb — empty weight of the container itself
 *   plantEstimateLb — rough estimate of live plant material weight
 *   wetSoilDensityLbPerCuft — override the default saturated-mix density
 *   ratedCapacityLbPerSqft — the building's actual rated load limit, if known
 */
export function computeFloorLoad(input) {
  const {
    lengthIn,
    widthIn,
    depthIn,
    containerTareLb = 0,
    plantEstimateLb = 0,
    wetSoilDensityLbPerCuft = DEFAULT_WET_SOIL_DENSITY_LB_PER_CUFT,
    ratedCapacityLbPerSqft = null,
  } = input;

  const volumeCuFt = (lengthIn * widthIn * depthIn) / 1728;
  const soilWeightLb = volumeCuFt * wetSoilDensityLbPerCuft;
  const totalWeightLb = soilWeightLb + containerTareLb + plantEstimateLb;
  const footprintSqFt = (lengthIn * widthIn) / 144;
  const requiredCapacityLbPerSqft = footprintSqFt > 0 ? totalWeightLb / footprintSqFt : 0;

  const usingDefault = ratedCapacityLbPerSqft == null;
  const effectiveRated = ratedCapacityLbPerSqft ?? DEFAULT_RATED_CAPACITY_LB_PER_SQFT;
  const pass = requiredCapacityLbPerSqft <= effectiveRated;

  return {
    volumeCuFt: round(volumeCuFt),
    soilWeightLb: round(soilWeightLb),
    totalWeightLb: round(totalWeightLb),
    footprintSqFt: round(footprintSqFt),
    requiredCapacityLbPerSqft: round(requiredCapacityLbPerSqft),
    ratedCapacityLbPerSqft: effectiveRated,
    usingDefaultRating: usingDefault,
    pass,
    warning: usingDefault
      ? "This uses a commonly-cited residential minimum (40 lb/sq ft), not your building's actual number — confirm the real rated capacity with building management or your condo documents before trusting this pass/fail."
      : null,
  };
}

function round(n) {
  return Math.round(n * 100) / 100;
}

export { DEFAULT_WET_SOIL_DENSITY_LB_PER_CUFT, DEFAULT_RATED_CAPACITY_LB_PER_SQFT };
