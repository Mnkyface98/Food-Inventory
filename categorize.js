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

module.exports = { CATEGORIES, CATEGORY_IDS, guessCategory };
