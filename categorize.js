// Shared food-category list and a free, keyword-based category guesser.
// No external API — used both as a fallback when the client doesn't send
// a category and to pre-fill a category on voice-parsed items.

const CATEGORIES = [
  { id: 'produce', label: 'Produce' },
  { id: 'dairy_eggs', label: 'Dairy & Eggs' },
  { id: 'meat_seafood', label: 'Meat & Seafood' },
  { id: 'frozen', label: 'Frozen' },
  { id: 'bakery', label: 'Bakery' },
  { id: 'grains_pasta', label: 'Grains & Pasta' },
  { id: 'canned_goods', label: 'Canned Goods' },
  { id: 'condiments_sauces', label: 'Condiments & Sauces' },
  { id: 'spices_baking', label: 'Spices & Baking' },
  { id: 'snacks', label: 'Snacks' },
  { id: 'beverages', label: 'Beverages' },
  { id: 'other', label: 'Other' },
];

const CATEGORY_IDS = new Set(CATEGORIES.map((c) => c.id));

// Keyword -> category, checked as whole words against the item name.
// Longer/more specific keywords first within each category so e.g. "ice
// cream" beats a bare "cream" match.
const KEYWORD_RULES = [
  ['frozen', ['ice cream', 'frozen', 'popsicle', 'frozen pizza', 'frozen peas', 'frozen fries']],
  ['produce', [
    'apple', 'banana', 'orange', 'grape', 'berry', 'strawberr', 'blueberr', 'lettuce',
    'spinach', 'kale', 'carrot', 'potato', 'onion', 'garlic', 'tomato', 'cucumber',
    'pepper', 'broccoli', 'cauliflower', 'avocado', 'lemon', 'lime', 'mushroom',
    'celery', 'zucchini', 'squash', 'melon', 'peach', 'pear', 'mango', 'herbs',
    'cilantro', 'parsley', 'basil',
  ]],
  ['dairy_eggs', [
    'milk', 'egg', 'cheese', 'yogurt', 'butter', 'cream cheese', 'sour cream',
    'cottage cheese', 'half and half', 'heavy cream',
  ]],
  ['meat_seafood', [
    'chicken', 'beef', 'pork', 'turkey', 'bacon', 'sausage', 'ham', 'steak',
    'ground beef', 'salmon', 'shrimp', 'fish', 'tuna', 'crab', 'lamb',
  ]],
  ['bakery', ['bread', 'bagel', 'bun', 'roll', 'tortilla', 'muffin', 'croissant', 'baguette']],
  ['grains_pasta', ['rice', 'pasta', 'noodle', 'spaghetti', 'macaroni', 'oats', 'oatmeal', 'cereal', 'quinoa', 'flour tortilla']],
  ['canned_goods', ['can of', 'canned', 'beans', 'soup', 'broth', 'stock', 'tomato sauce', 'tomato paste', 'corn', 'chickpea', 'lentil'
  ]],
  ['condiments_sauces', [
    'ketchup', 'mustard', 'mayo', 'mayonnaise', 'sauce', 'dressing', 'vinegar',
    'soy sauce', 'hot sauce', 'salsa', 'jam', 'jelly', 'honey', 'syrup', 'peanut butter',
  ]],
  ['spices_baking', [
    'flour', 'sugar', 'salt', 'pepper', 'spice', 'baking soda', 'baking powder',
    'vanilla', 'cinnamon', 'yeast', 'cocoa', 'oil', 'olive oil',
  ]],
  ['snacks', ['chips', 'crackers', 'cookies', 'candy', 'popcorn', 'pretzel', 'granola bar', 'nuts', 'trail mix']],
  ['beverages', ['water', 'juice', 'soda', 'coffee', 'tea', 'wine', 'beer', 'sparkling water']],
];

// Flatten to (keyword, category) pairs and check longest keyword first,
// globally — so a more specific phrase like "peanut butter" (condiments)
// wins over a shorter substring like "butter" (dairy) regardless of which
// category happened to be listed first above.
const FLAT_RULES = KEYWORD_RULES.flatMap(([category, keywords]) =>
  keywords.map((kw) => [kw, category])
).sort((a, b) => b[0].length - a[0].length);

function guessCategory(name) {
  const lower = (name || '').toLowerCase();
  for (const [kw, category] of FLAT_RULES) {
    if (lower.includes(kw)) return category;
  }
  return 'other';
}

// Open Food Facts' own category taxonomy (its `categories_tags` field,
// e.g. "en:hazelnut-spreads") is far more specific than a product's bare
// name — a barcode scan for "Nutella" won't have "hazelnut" or "spread"
// in its name, but OFF already knows it's a spread. When that data is
// available (i.e. only from a barcode lookup), prefer it over guessing
// from the name. Same longest-tag-wins approach as the name-based rules.
const OFF_TAG_RULES = [
  ['frozen', ['frozen-foods', 'ice-creams', 'ice-cream', 'sorbets', 'frozen-desserts']],
  ['produce', [
    'fresh-vegetables', 'fresh-fruits', 'vegetables', 'fruits', 'herbs', 'mushrooms',
    'salads', 'fresh-produce',
  ]],
  ['dairy_eggs', [
    'dairies', 'milks', 'cheeses', 'yogurts', 'yoghurts', 'eggs', 'butters', 'creams',
    'fermented-milk-products',
  ]],
  ['meat_seafood', [
    'meats', 'poultries', 'poultry', 'seafood', 'fishes', 'sausages', 'cold-cuts',
    'charcuterie', 'shellfish',
  ]],
  ['bakery', ['breads', 'bakery-products', 'viennoiseries', 'cakes', 'pastries']],
  ['grains_pasta', [
    'cereals-and-potatoes', 'pastas', 'rices', 'breakfast-cereals', 'noodles', 'flours-and-grains',
  ]],
  ['canned_goods', [
    'canned-foods', 'canned-vegetables', 'canned-fish', 'soups', 'legumes', 'beans',
    'chickpeas', 'lentils', 'canned-plant-based-foods',
  ]],
  ['condiments_sauces', [
    'sauces', 'condiments', 'spreads', 'dressings', 'vinegars', 'ketchups', 'mustards',
    'mayonnaises', 'chocolate-spreads', 'nut-spreads', 'jams',
  ]],
  ['spices_baking', [
    'spices', 'flours', 'sugars', 'baking-products', 'oils-and-fats', 'salts', 'vegetable-oils',
    'herbs-and-spices',
  ]],
  ['snacks', [
    'snacks', 'chips-and-fries', 'biscuits-and-cakes', 'sweet-snacks', 'salty-snacks',
    'candies', 'chocolates', 'nuts', 'crackers',
  ]],
  ['beverages', [
    'beverages', 'waters', 'juices', 'sodas', 'teas', 'coffees', 'alcoholic-beverages',
    'plant-based-beverages', 'energy-drinks',
  ]],
];

const OFF_FLAT_TAG_RULES = OFF_TAG_RULES.flatMap(([category, tags]) =>
  tags.map((tag) => [tag, category])
).sort((a, b) => b[0].length - a[0].length);

/**
 * Guess a category from Open Food Facts' `categories_tags` array (e.g.
 * ["en:spreads", "en:hazelnut-spreads"]). Returns null if none of the
 * tags match anything, so the caller can fall back to name-based
 * guessCategory() instead of defaulting straight to "other".
 */
function guessCategoryFromTags(categoriesTags) {
  if (!Array.isArray(categoriesTags) || categoriesTags.length === 0) return null;
  // Strip language prefixes ("en:", "fr:", ...) and join into one string
  // to scan — order doesn't matter since we always take the longest,
  // most-specific matching tag across all of them.
  const joined = categoriesTags
    .map((t) => String(t).toLowerCase().replace(/^[a-z]{2,3}:/, ''))
    .join(' ');
  for (const [tag, category] of OFF_FLAT_TAG_RULES) {
    if (joined.includes(tag)) return category;
  }
  return null;
}

// Common items that hint at a default storage location when none is stated.
const FRIDGE_HINTS = ['milk', 'egg', 'cheese', 'yogurt', 'butter', 'cream', 'juice', 'leftover'];
const FREEZER_HINTS = ['ice cream', 'frozen', 'popsicle'];

function includesWord(lower, hint) {
  return new RegExp(`\\b${hint}`, 'i').test(lower);
}

function guessLocation(name) {
  const lower = (name || '').toLowerCase();
  if (FREEZER_HINTS.some((h) => includesWord(lower, h))) return 'freezer';
  if (FRIDGE_HINTS.some((h) => includesWord(lower, h))) return 'fridge';
  return 'pantry';
}

module.exports = { CATEGORIES, CATEGORY_IDS, guessCategory, guessCategoryFromTags, guessLocation };
