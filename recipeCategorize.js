// Recipe categories — distinct from the food-storage categories in
// categorize.js (which group pantry/fridge items by grocery aisle). These
// group recipes by meal type instead, for the collapsible category list
// under Save Recipes. A fixed, small, hand-picked list (unlike item
// categories, nothing here is auto-guessed) — the user always chooses one
// from a dropdown when saving a recipe, defaulting to "Other".

const RECIPE_CATEGORIES = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'sandwiches_wraps', label: 'Sandwiches & Wraps' },
  { id: 'soups_salads', label: 'Soups & Salads' },
  { id: 'main_dishes', label: 'Main Dishes' },
  { id: 'sides_snacks', label: 'Sides & Snacks' },
  { id: 'desserts_baking', label: 'Desserts & Baking' },
  { id: 'beverages', label: 'Beverages' },
  { id: 'other', label: 'Other' },
];

const RECIPE_CATEGORY_IDS = new Set(RECIPE_CATEGORIES.map((c) => c.id));

module.exports = { RECIPE_CATEGORIES, RECIPE_CATEGORY_IDS };
