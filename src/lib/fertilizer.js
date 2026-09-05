// Fertilizer guidance reuses the heavyFeeder trait and fertilizerLean field
// already on each species — no separate fertilizer dataset needed.

/**
 * @param {object[]} plants species objects (a box's selected plants)
 * @returns {{ recommendation: string, perPlant: object[], anyHeavyFeeder: boolean }}
 */
export function fertilizerGuidance(plants) {
  const perPlant = plants.map((p) => ({
    id: p.id,
    commonName: p.commonName,
    lean: p.fertilizerLean,
    heavyFeeder: p.traits.heavyFeeder,
  }));

  const anyHeavyFeeder = plants.some((p) => p.traits.heavyFeeder);
  const leans = new Set(plants.map((p) => p.fertilizerLean));

  let recommendation;
  if (leans.size <= 1) {
    const lean = [...leans][0] || 'balanced';
    recommendation = `One product for the whole box: a slow-release, ${leanLabel(lean)} fertilizer, applied every 2-3 months.`;
  } else if (!leans.has('nitrogen')) {
    recommendation =
      'Mixed leans, but none want extra nitrogen — a single slightly phosphorus/potassium-leaning slow-release fertilizer (e.g. 5-10-10) covers the box reasonably well.';
  } else {
    recommendation =
      'This box mixes a nitrogen-hungry plant with others that want less — consider feeding the nitrogen-hungry plant separately rather than fertilizing the whole box the same way.';
  }

  if (anyHeavyFeeder) {
    recommendation += ' At least one heavy feeder is present — bump feeding frequency slightly for that plant specifically.';
  }

  recommendation +=
    ' Skip high-nitrogen lawn-style formulas regardless — nitrogen pushes soft, fast growth that aphids prefer.';

  return { recommendation, perPlant, anyHeavyFeeder };
}

function leanLabel(lean) {
  if (lean === 'phosphorus-potassium') return 'phosphorus/potassium-leaning (e.g. 5-10-10)';
  if (lean === 'nitrogen') return 'balanced-to-nitrogen';
  return 'balanced (e.g. 10-10-10)';
}
