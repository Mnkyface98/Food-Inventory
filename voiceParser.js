// Free, rule-based parser for turning a spoken/typed sentence into
// structured pantry/fridge/freezer inventory changes. No external API or
// key required — just keyword and pattern matching.

const { extractExpiration } = require('./dateParser');
const { guessLocation } = require('./categorize');

const NUMBER_WORDS = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, dozen: 12,
  couple: 2, few: 3, several: 4,
};

const USE_KEYWORDS = [
  'used', 'use', 'using', 'ran out of', 'run out of', 'out of', 'finished',
  'ate', 'eat', 'drank', 'drink', 'consumed', 'used up', 'threw out', 'thrown out',
];
const ADD_KEYWORDS = [
  'add', 'added', 'bought', 'buy', 'got', 'get', 'picked up', 'restocked',
  'stock', 'stocked', 'have', 'brought home',
];

const UNIT_WORDS = [
  'cans', 'can', 'bags', 'bag', 'boxes', 'box', 'bottles', 'bottle', 'jars', 'jar',
  'lbs', 'lb', 'pounds', 'pound', 'oz', 'ounces', 'ounce', 'cups', 'cup',
  'gallons', 'gallon', 'gal', 'liters', 'liter', 'l', 'packs', 'pack', 'packages', 'package',
  'dozen', 'loaves', 'loaf', 'cartons', 'carton', 'sticks', 'stick', 'heads', 'head',
  'bunches', 'bunch', 'pieces', 'piece', 'pcs',
];

const LOCATION_WORDS = {
  pantry: 'pantry',
  cupboard: 'pantry',
  cabinet: 'pantry',
  shelf: 'pantry',
  fridge: 'fridge',
  refrigerator: 'fridge',
  freezer: 'freezer',
};

function findKeyword(text, keywords) {
  for (const kw of keywords) {
    const re = new RegExp(`\\b${kw.replace(/ /g, '\\s+')}\\b`, 'i');
    if (re.test(text)) return kw;
  }
  return null;
}

function stripKeyword(text, keyword) {
  if (!keyword) return text;
  const re = new RegExp(`\\b${keyword.replace(/ /g, '\\s+')}\\b`, 'i');
  return text.replace(re, ' ');
}

function titleCase(str) {
  return str
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

// Compound quantity phrases checked before single-word numbers, longest first.
const COMPOUND_QUANTITIES = [
  ['half a dozen', 6],
  ['a couple of', 2],
  ['a couple', 2],
  ['a few', 3],
  ['a dozen', 12],
];

function parseSegment(rawSegment) {
  let text = rawSegment.trim();
  if (!text) return null;

  // Leading pronoun ("I used...", "we bought...") — strip first so it
  // doesn't block quantity detection later in the sentence.
  text = text.replace(/^\s*(i|we|you|they)\s+/i, ' ');

  // Action (add vs. use)
  const useMatch = findKeyword(text, USE_KEYWORDS);
  const addMatch = !useMatch ? findKeyword(text, ADD_KEYWORDS) : null;
  const action = useMatch ? 'use' : 'add';
  text = stripKeyword(text, useMatch || addMatch);

  // Location
  let location = null;
  for (const [word, loc] of Object.entries(LOCATION_WORDS)) {
    const re = new RegExp(`\\b(?:to|in|from)?\\s*(?:the)?\\s*${word}\\b`, 'i');
    if (re.test(text)) {
      location = loc;
      text = text.replace(re, ' ');
      break;
    }
  }

  // Quantity: compound phrase ("a few", "half a dozen") or a plain digit,
  // checked before unit-word matching so "dozen" isn't eaten as a unit
  // out from under "half a dozen".
  let quantity = 1;
  let quantityConsumed = false;
  const trimmedLower = text.trim().toLowerCase();
  const compound = COMPOUND_QUANTITIES.find(([phrase]) => trimmedLower.startsWith(phrase));
  const digitMatch = text.match(/\b(\d+(\.\d+)?)\b/);
  if (compound) {
    quantity = compound[1];
    text = text.trim().slice(compound[0].length);
    quantityConsumed = true;
  } else if (digitMatch) {
    quantity = parseFloat(digitMatch[1]);
    text = text.replace(digitMatch[0], ' ');
    quantityConsumed = true;
  }

  // Unit (e.g. "2 cans", "a jar")
  let unit = '';
  const unitRe = new RegExp(`\\b(${UNIT_WORDS.join('|')})\\b`, 'i');
  const unitMatch = text.match(unitRe);
  if (unitMatch) {
    unit = unitMatch[1].toLowerCase();
    text = text.replace(unitRe, ' ');
  }
  text = text.replace(/\bof\b/gi, ' ');

  // Single number word ("two eggs"), only if quantity wasn't already found.
  if (!quantityConsumed) {
    const words = text.trim().split(/\s+/);
    const firstWord = (words[0] || '').toLowerCase();
    if (NUMBER_WORDS[firstWord] !== undefined) {
      quantity = NUMBER_WORDS[firstWord];
      words.shift();
      text = words.join(' ');
    }
  }

  // Drop filler words that survive quantity/unit/location/action stripping
  // (articles, pronouns, and phrases like "the last of").
  const STOPWORDS = new Set([
    'i', 'we', 'my', 'our', 'the', 'a', 'an', 'that', 'this', 'is', 'are',
    'was', 'were', 'last', 'some', 'to', 'in', 'from',
  ]);
  text = text
    .split(/\s+/)
    .filter((w) => w && !STOPWORDS.has(w.toLowerCase()))
    .join(' ');

  const name = titleCase(text.replace(/\s+/g, ' ').trim());
  if (!name) return null;

  return {
    name,
    quantity,
    unit,
    location: location || guessLocation(name),
    action,
    expirationDate: null,
  };
}

/**
 * Parse a free-form sentence (from voice or typed text) into structured
 * pantry/fridge inventory changes, e.g. "add two cans of black beans to
 * the pantry and I used the last of the milk" -> two items.
 *
 * @param {string} transcript
 * @returns {{items: Array<{name:string, quantity:number, unit:string, location:string, action:string, expirationDate:string|null}>}}
 */
function parseTranscript(transcript) {
  // Pull out an expiration-date clause ("expires next friday", "best by
  // 8/25") from the *whole* sentence first, before splitting into items —
  // otherwise a clause like ", expires in 3 days" gets sheared apart by
  // the comma-based item split below. The extracted date is applied to
  // every item in the sentence, which covers the common case of one item
  // per utterance; a sentence naming several items with a single date is
  // an edge case the user can still fix in the review card.
  const { text: withoutDate, expirationDate } = extractExpiration(transcript);

  // Split on "and", commas, or "also" so one sentence can describe several items.
  const segments = withoutDate
    .split(/\band\b|,|\balso\b/i)
    .map((s) => s.trim())
    .filter(Boolean);

  const items = segments.map(parseSegment).filter(Boolean);
  if (expirationDate) {
    for (const item of items) item.expirationDate = expirationDate;
  }
  return { items };
}

module.exports = { parseTranscript };
