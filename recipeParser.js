// Free, rule-based parser for recipe ingredient lists — typed/pasted text
// or OCR'd from a photo. No external API. Unlike receipts/voice/barcode
// (which restock), a recipe's ingredients are meant to be USED UP, so
// every parsed item defaults to action: 'use'.

const { guessCategory, guessLocation } = require('./categorize');

// Cooking-specific units, in addition to the grocery ones elsewhere in the
// app — checked as a whole word right after the quantity.
const COOKING_UNITS = new Set([
  'cup', 'cups', 'c',
  'tbsp', 'tbsps', 'tablespoon', 'tablespoons',
  'tsp', 'tsps', 'teaspoon', 'teaspoons',
  'oz', 'ounce', 'ounces',
  'lb', 'lbs', 'pound', 'pounds',
  'g', 'gram', 'grams', 'kg', 'kilogram', 'kilograms',
  'ml', 'milliliter', 'milliliters', 'l', 'liter', 'liters', 'litre', 'litres',
  'pinch', 'pinches', 'dash', 'dashes',
  'clove', 'cloves', 'can', 'cans', 'package', 'packages', 'pkg',
  'stick', 'sticks', 'slice', 'slices', 'head', 'heads',
  'bunch', 'bunches', 'sprig', 'sprigs', 'quart', 'quarts', 'pint', 'pints',
]);

// Lines that are clearly recipe structure, not ingredients.
const SKIP_LINE_RE = /^(ingredients?|directions?|instructions?|method|steps?|for\s+the\s+.+|preparation|notes?)\s*:?\s*$/i;
// A numbered instruction step, e.g. "1. Preheat the oven to 350°F."
const NUMBERED_STEP_RE = /^\d+[.)]\s+\S/;

const WORD_QUANTITIES = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, few: 3, several: 4, couple: 2 };

// A quantity token — whatever an ingredient line is expected to start
// with. Shared by the "is this a new ingredient?" checks below. Order
// matters: mixed numbers and fractions must be tried before a bare
// number, or "1 1/2" would be cut between "1" and "1/2".
const QUANTITY_TOKEN = '(?:\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|\\d+(?:\\.\\d+)?|a|an|one|two|three|four|few|several|couple)';
const LEADING_QUANTITY_RE = new RegExp('^' + QUANTITY_TOKEN + '\\b', 'i');
const QUANTITY_BOUNDARY_RE = new RegExp('\\b(' + QUANTITY_TOKEN + ')\\b(?=\\s)', 'gi');

// Ingredients can be typed one per line, comma-separated on one line, or
// just space-separated on one line with no punctuation at all — so a
// single line of raw text may hold several ingredients. These two
// helpers split a line into individual ingredient candidates before
// parseIngredientLine ever sees them.

// Splits a line on commas, but only treats a piece as the START of a new
// ingredient if it itself begins with a quantity ("1 tsp salt"). A piece
// that doesn't ("diced", "room temperature") is glued back onto the
// previous ingredient as a prep note, same as before commas were used as
// a delimiter at all.
function splitCommaGroups(line) {
  const pieces = line.split(',').map((p) => p.trim()).filter(Boolean);
  if (pieces.length <= 1) return [line];
  const groups = [pieces[0]];
  for (let i = 1; i < pieces.length; i++) {
    if (LEADING_QUANTITY_RE.test(pieces[i])) {
      groups.push(pieces[i]);
    } else {
      groups[groups.length - 1] += ', ' + pieces[i];
    }
  }
  return groups;
}

// Splits text with no commas at all into multiple ingredients by looking
// for repeated quantity tokens ("2 cups flour 1 tsp salt 3 eggs"). If
// fewer than two quantity tokens show up, the text is left as one
// candidate — most single ingredients only have one number in them.
function splitOnQuantityBoundaries(text) {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const indices = [];
  let m;
  QUANTITY_BOUNDARY_RE.lastIndex = 0;
  while ((m = QUANTITY_BOUNDARY_RE.exec(trimmed))) {
    indices.push(m.index);
  }
  if (indices.length <= 1) return [trimmed];
  const segments = [];
  if (indices[0] > 0) segments.push(trimmed.slice(0, indices[0]).trim());
  for (let i = 0; i < indices.length; i++) {
    const start = indices[i];
    const end = i + 1 < indices.length ? indices[i + 1] : trimmed.length;
    segments.push(trimmed.slice(start, end).trim());
  }
  return segments.filter(Boolean);
}

// Splits one raw line of text into every ingredient candidate it holds,
// however they were separated (line break, commas, or just spaces).
function splitLineIntoCandidates(line) {
  const commaGroups = splitCommaGroups(line);
  const candidates = [];
  for (const group of commaGroups) {
    candidates.push(...splitOnQuantityBoundaries(group));
  }
  return candidates;
}

function parseLeadingQuantity(text) {
  // Mixed number: "1 1/2"
  let m = text.match(/^(\d+)\s+(\d+)\/(\d+)\s+(.*)$/);
  if (m) {
    const whole = parseInt(m[1], 10);
    const frac = parseInt(m[2], 10) / parseInt(m[3], 10);
    return { quantity: whole + frac, rest: m[4] };
  }
  // Simple fraction: "1/2"
  m = text.match(/^(\d+)\/(\d+)\s+(.*)$/);
  if (m) {
    return { quantity: parseInt(m[1], 10) / parseInt(m[2], 10), rest: m[3] };
  }
  // Decimal or whole number: "2", "1.5"
  m = text.match(/^(\d+(?:\.\d+)?)\s+(.*)$/);
  if (m) {
    return { quantity: parseFloat(m[1]), rest: m[2] };
  }
  // A number directly against a unit with no space, e.g. "2cups flour"
  m = text.match(/^(\d+(?:\.\d+)?)([a-zA-Z].*)$/);
  if (m) {
    return { quantity: parseFloat(m[1]), rest: m[2] };
  }
  // Word quantity: "a pinch of salt"
  m = text.match(/^(a|an|one|two|three|four|few|several|couple)\s+(.*)$/i);
  if (m && WORD_QUANTITIES[m[1].toLowerCase()] !== undefined) {
    return { quantity: WORD_QUANTITIES[m[1].toLowerCase()], rest: m[2] };
  }
  return { quantity: 1, rest: text };
}

function parseLeadingUnit(text) {
  // Two-word units typed with a space ("table spoons", "tea spoon") —
  // tried before the single-word case, by concatenating the two words
  // and checking that against the same COOKING_UNITS set ("table" +
  // "spoons" -> "tablespoons", already in the set). Without this, an
  // unrecognized first word ("table") leaves the unit blank and glues
  // the rest ("spoons of butter") onto the ingredient name instead —
  // e.g. "2 table spoons of butter" parsing as a "Table Spoons Of
  // Butter" ingredient that then fails to match an inventory item
  // that's just called "Butter".
  const twoWordMatch = text.match(/^([a-zA-Z]+)\s+([a-zA-Z]+)\.?\s+(.*)$/);
  if (twoWordMatch) {
    const combined = (twoWordMatch[1] + twoWordMatch[2]).toLowerCase();
    if (COOKING_UNITS.has(combined)) {
      return { unit: combined, rest: twoWordMatch[3] };
    }
  }
  const m = text.match(/^([a-zA-Z.]+)\.?\s+(.*)$/);
  if (m) {
    const word = m[1].toLowerCase().replace(/\.$/, '');
    if (COOKING_UNITS.has(word)) {
      return { unit: word, rest: m[2] };
    }
  }
  return { unit: '', rest: text };
}

function titleCase(str) {
  return str
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function parseIngredientLine(rawLine) {
  let line = rawLine.trim();
  if (!line || line.length < 2) return null;
  if (SKIP_LINE_RE.test(line)) return null;
  if (NUMBERED_STEP_RE.test(line)) return null;
  if (!/[a-zA-Z]{2,}/.test(line)) return null; // needs at least one real word

  // Drop a leading bullet/dash marker.
  line = line.replace(/^[-*•]\s*/, '');

  // Drop parenthetical asides entirely — "(such as Roma)", "(14.5 oz)" —
  // rather than trying to parse them; the leading quantity/unit already
  // covers the common case.
  line = line.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  if (!line) return null;

  const { quantity, rest: afterQty } = parseLeadingQuantity(line);
  const { unit, rest: afterUnit } = parseLeadingUnit(afterQty);

  // Drop a filler "of" ("2 cups of flour" -> "flour"), then anything
  // after a comma/semicolon, which is almost always prep instructions
  // ("diced", "melted", "room temperature") rather than part of the name.
  let name = afterUnit.replace(/^of\s+/i, '');
  name = name.split(/[,;]/)[0].trim();
  name = name.replace(/[^a-zA-Z0-9&'\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (name.length < 2) return null;

  const titled = titleCase(name);
  return {
    name: titled,
    quantity,
    unit,
    location: guessLocation(titled),
    category: guessCategory(titled),
    action: 'use', // a recipe consumes ingredients — the opposite of a receipt
    expirationDate: null,
  };
}

/**
 * Parse raw recipe-ingredient text (typed, pasted, or OCR'd from a photo)
 * into candidate items to use from inventory. Ingredients can be entered
 * one per line, comma-separated on a single line, or just space-separated
 * on a single line with no punctuation — any mix of the three is fine.
 * Non-ingredient lines (section headers, numbered instruction steps) are
 * dropped.
 *
 * @param {string} rawText
 * @returns {{items: Array<object>}}
 */
function parseRecipeText(rawText) {
  const lines = String(rawText || '').split(/\r?\n/);
  const candidates = lines.flatMap((line) => {
    const trimmed = line.trim();
    // Skip headers/steps before splitting so "1. Preheat the oven" isn't
    // mistaken for a quantity boundary and torn apart.
    if (!trimmed || SKIP_LINE_RE.test(trimmed) || NUMBERED_STEP_RE.test(trimmed)) {
      return [trimmed];
    }
    return splitLineIntoCandidates(trimmed);
  });
  const items = candidates.map(parseIngredientLine).filter(Boolean);
  return { items };
}

module.exports = { parseRecipeText, parseIngredientLine };
