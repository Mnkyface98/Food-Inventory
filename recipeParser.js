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
 * into candidate items to use from inventory, one per plausible
 * ingredient line. Non-ingredient lines (section headers, numbered
 * instruction steps) are dropped.
 *
 * @param {string} rawText
 * @returns {{items: Array<object>}}
 */
function parseRecipeText(rawText) {
  const lines = String(rawText || '').split(/\r?\n/);
  const items = lines.map(parseIngredientLine).filter(Boolean);
  return { items };
}

module.exports = { parseRecipeText, parseIngredientLine };
