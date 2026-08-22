// Free, offline unit conversion for two families only — volume and
// weight. Deliberately does NOT convert between the two families (e.g.
// cups -> oz), since that requires an ingredient-specific density (a cup
// of flour and a cup of butter don't weigh the same); attempting that
// would silently produce wrong deductions, so it's refused instead.

const WEIGHT_TO_G = {
  g: 1, gram: 1, grams: 1,
  kg: 1000, kilogram: 1000, kilograms: 1000,
  oz: 28.3495, ounce: 28.3495, ounces: 28.3495,
  lb: 453.592, lbs: 453.592, pound: 453.592, pounds: 453.592,
};

const VOLUME_TO_ML = {
  ml: 1, milliliter: 1, milliliters: 1,
  l: 1000, liter: 1000, liters: 1000, litre: 1000, litres: 1000,
  cup: 236.588, cups: 236.588, c: 236.588,
  tbsp: 14.7868, tbsps: 14.7868, tablespoon: 14.7868, tablespoons: 14.7868,
  tsp: 4.92892, tsps: 4.92892, teaspoon: 4.92892, teaspoons: 4.92892,
  'fl oz': 29.5735, 'fluid ounce': 29.5735, 'fluid ounces': 29.5735,
  quart: 946.353, quarts: 946.353, pint: 473.176, pints: 473.176,
};

function normalize(unit) {
  return String(unit || '').trim().toLowerCase();
}

function unitFamily(unit) {
  const u = normalize(unit);
  if (WEIGHT_TO_G[u] !== undefined) return 'weight';
  if (VOLUME_TO_ML[u] !== undefined) return 'volume';
  return null;
}

/**
 * Convert `amount` from `fromUnit` to `toUnit`. Returns null if either
 * unit is unrecognized, or if they're in different families (volume vs.
 * weight) — refuses to guess a density-based conversion.
 */
function convert(amount, fromUnit, toUnit) {
  const from = normalize(fromUnit);
  const to = normalize(toUnit);
  if (!from || !to) return null;
  if (from === to) return amount;

  const fromFamily = unitFamily(from);
  const toFamily = unitFamily(to);
  if (!fromFamily || !toFamily || fromFamily !== toFamily) return null;

  const table = fromFamily === 'weight' ? WEIGHT_TO_G : VOLUME_TO_ML;
  const baseAmount = amount * table[from];
  return baseAmount / table[to];
}

module.exports = { convert, unitFamily };
