// Free, rule-based extraction of a weight/volume size (e.g. "32 FL OZ",
// "500ML", "(2.5 LB)") out of free text — mainly product titles from an
// OCR'd receipt, which very often print the package size as part of the
// name ("ELMHURST UNSWEETENED ALMOND MILK 32 FL OZ", or "OLIPOP ... (12
// fl oz)"). No external API.

// Canonical unit strings match server.js's FULLNESS_UNITS exactly (case
// matters — 'L' is capitalized there), so an extracted value is directly
// usable as fullnessUnit without further translation.
const UNIT_ALTERNATIVES = [
  // Longer/more specific patterns first, so "fl oz" isn't swallowed by
  // the bare "oz" alternative before it gets a chance to match. "0z" is
  // deliberately tolerated alongside "oz" — OCR very reliably misreads
  // the letter O as a zero in this specific short word.
  [/fl\.?\s*[o0]z\.?|fluid\s+ounces?|floz/i, 'fl oz'],
  [/ounces?|[o0]z\.?/i, 'oz'],
  [/pounds?|lbs?\.?/i, 'lb'],
  [/kilograms?|kg\.?/i, 'kg'],
  [/grams?|gm\.?|g/i, 'g'],
  [/milliliters?|millilitres?|ml\.?/i, 'ml'],
  [/liters?|litres?|l\.?/i, 'L'],
];

// One combined regex: a number (integer or decimal), optional space,
// then any of the unit patterns above, word-bounded on both ends so it
// doesn't fire mid-word (e.g. the "l" in "Loaf", the "g" in "Greek").
const WEIGHT_VOLUME_SRC = `\\b(\\d+(?:\\.\\d+)?)\\s*(${UNIT_ALTERNATIVES.map(([re]) => re.source).join('|')})\\b`;
const WEIGHT_VOLUME_RE = new RegExp(WEIGHT_VOLUME_SRC, 'i');

function canonicalUnit(matchedUnit) {
  const lower = matchedUnit.toLowerCase();
  for (const [re, canonical] of UNIT_ALTERNATIVES) {
    if (new RegExp(`^(?:${re.source})$`, 'i').test(lower)) return canonical;
  }
  return null;
}

function amountAndUnitFromMatch(match) {
  const amount = parseFloat(match[1]);
  const unit = canonicalUnit(match[2]);
  if (!Number.isFinite(amount) || amount <= 0 || !unit) return null;
  return { amount, unit };
}

function removeSpan(text, index, length) {
  return (text.slice(0, index) + text.slice(index + length)).replace(/\s+/g, ' ').trim();
}

/**
 * Find and strip a weight/volume size out of `text` (e.g. a product
 * name). Returns { text, fullnessAmount, fullnessUnit } — `text` has the
 * matched size removed (and whitespace collapsed), the other two are
 * null if nothing was found.
 *
 * A size inside parentheses — "(12 fl oz)" — is preferred over one found
 * loose in the text, and the whole parenthetical is removed (not just
 * the number+unit), so nothing like a stray "()" is left in the name.
 * This also sidesteps an early, similar-looking marketing callout (e.g.
 * "9g Fiber" earlier in a name that also has "(12 fl oz)" later) —
 * a bare, unparenthesized size still falls back to the LAST match
 * anywhere in the text, since a trailing size is the far more reliable
 * convention than one buried mid-name.
 */
function extractWeightVolume(text) {
  const parenRe = /\(([^()]*)\)/g;
  let lastParenMatch = null;
  let m;
  while ((m = parenRe.exec(text))) {
    if (WEIGHT_VOLUME_RE.test(m[1])) lastParenMatch = m;
  }
  if (lastParenMatch) {
    const inner = amountAndUnitFromMatch(lastParenMatch[1].match(WEIGHT_VOLUME_RE));
    if (inner) {
      return {
        text: removeSpan(text, lastParenMatch.index, lastParenMatch[0].length),
        fullnessAmount: inner.amount,
        fullnessUnit: inner.unit,
      };
    }
  }

  const globalRe = new RegExp(WEIGHT_VOLUME_SRC, 'gi');
  let lastMatch = null;
  while ((m = globalRe.exec(text))) lastMatch = m;
  if (!lastMatch) return { text, fullnessAmount: null, fullnessUnit: null };

  const found = amountAndUnitFromMatch(lastMatch);
  if (!found) return { text, fullnessAmount: null, fullnessUnit: null };
  return {
    text: removeSpan(text, lastMatch.index, lastMatch[0].length),
    fullnessAmount: found.amount,
    fullnessUnit: found.unit,
  };
}

// True if `text` contains a recognizable weight/volume size anywhere —
// used as a signal that an otherwise price-less line is still a product
// line (receipts that print "qty x unit price" on the next line instead
// of a price on the name's own line still usually keep the size, e.g.
// "(12 fl oz)", right on the name).
function hasWeightVolume(text) {
  return WEIGHT_VOLUME_RE.test(text);
}

module.exports = { extractWeightVolume, hasWeightVolume };
