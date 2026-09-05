import { COMPANION_EXCEPTIONS } from '../data/species.js';

/**
 * Pairwise companion compatibility. Trait-by-trait comparison handles the
 * general case; a short curated exception table (COMPANION_EXCEPTIONS)
 * overrides it for specific, well-documented interactions the traits alone
 * wouldn't reliably derive (e.g. fennel's near-universal suppression
 * effect).
 *
 * @returns {{verdict: 'good'|'neutral'|'avoid', score: number, reasons: string[]}}
 */
export function checkCompanionPair(a, b) {
  if (a.id === b.id) return { verdict: 'neutral', score: 0, reasons: [] };

  for (const exception of COMPANION_EXCEPTIONS) {
    if (exception.match(a, b)) {
      return { verdict: exception.verdict, score: -1, reasons: [exception.reason] };
    }
  }

  const reasons = [];
  let score = 0;

  if (a.traits.nitrogenFixer && b.traits.heavyFeeder) {
    score += 1;
    reasons.push(`${a.commonName} fixes nitrogen, feeding ${b.commonName} (a heavy feeder).`);
  }
  if (b.traits.nitrogenFixer && a.traits.heavyFeeder) {
    score += 1;
    reasons.push(`${b.commonName} fixes nitrogen, feeding ${a.commonName} (a heavy feeder).`);
  }
  if (a.traits.trapCrop && b.aphidSusceptibility !== 'low') {
    score += 1;
    reasons.push(`${a.commonName} is a trap crop, drawing pests away from ${b.commonName}.`);
  }
  if (b.traits.trapCrop && a.aphidSusceptibility !== 'low') {
    score += 1;
    reasons.push(`${b.commonName} is a trap crop, drawing pests away from ${a.commonName}.`);
  }
  if (a.traits.pestRepellent || b.traits.pestRepellent) {
    score += 0.5;
    reasons.push('Pest-repellent scent/foliage nearby helps deter general pest pressure.');
  }
  if (a.traits.pollinatorMagnet || b.traits.pollinatorMagnet) {
    score += 0.5;
    reasons.push('Pollinator-magnet draws in beneficial insects for the whole box.');
  }
  if (a.waterNeed !== b.waterNeed && (a.waterNeed === 'low' || b.waterNeed === 'low') && (a.waterNeed === 'high' || b.waterNeed === 'high')) {
    score -= 1;
    reasons.push('Clashing water needs (one wants dry, the other wants consistently moist).');
  }
  if (a.traits.heavyFeeder && b.traits.heavyFeeder) {
    score -= 0.5;
    reasons.push('Both are heavy feeders — will compete for nutrients.');
  }

  let verdict = 'neutral';
  if (score <= -1) verdict = 'avoid';
  else if (score > 0) verdict = 'good';

  return { verdict, score, reasons };
}

/**
 * Score one candidate against a whole set of already-selected plants.
 * Any single 'avoid' pairing vetoes the candidate outright.
 */
export function checkCompanionFit(candidate, selected) {
  if (selected.length === 0) return { verdict: 'neutral', score: 0, reasons: [], vetoed: false };

  const pairResults = selected.map((s) => checkCompanionPair(candidate, s));
  const vetoed = pairResults.some((r) => r.verdict === 'avoid');
  const totalScore = pairResults.reduce((sum, r) => sum + r.score, 0) / selected.length;
  const reasons = pairResults.flatMap((r) => r.reasons);

  return {
    verdict: vetoed ? 'avoid' : totalScore > 0 ? 'good' : 'neutral',
    score: totalScore,
    reasons,
    vetoed,
  };
}
