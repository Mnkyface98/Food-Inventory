// Free, keyless barcode -> product lookup via Open Food Facts
// (https://world.openfoodfacts.org), a public, community-maintained product
// database. No API key or paid service involved.

const { guessCategory, guessCategoryFromTags } = require('./categorize');

const OFF_BASE = 'https://world.openfoodfacts.org/api/v2/product';

// OFF spells units in various ways ("l", "liter", "litre"...) — map them
// onto the fixed set the app's Container Fullness feature understands.
// cl/dl convert into ml since we don't track those units directly.
const UNIT_ALIASES = {
  g: 'g', gram: 'g', grams: 'g',
  kg: 'kg', kilogram: 'kg', kilograms: 'kg',
  ml: 'ml', milliliter: 'ml', milliliters: 'ml', millilitre: 'ml', millilitres: 'ml',
  l: 'L', liter: 'L', liters: 'L', litre: 'L', litres: 'L',
  oz: 'oz', ounce: 'oz', ounces: 'oz',
  'fl oz': 'fl oz', floz: 'fl oz', 'fl. oz': 'fl oz', 'fluid ounce': 'fl oz', 'fluid ounces': 'fl oz',
  lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb',
};

// Open Food Facts' "quantity" field (e.g. "500 ml", "16 oz") describes how
// much is IN one package — not how many packages you have, and not a
// generic unit label either. Scanning a barcode always means you're
// adding exactly 1 of the product; this instead feeds the Container
// Fullness fields (assumed full, since it's presumably a fresh one),
// which is what actually uses a real amount for low-stock tracking.
// Returns null when the string can't be parsed into a unit this app knows.
function parsePackageSize(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const match = raw.match(/([\d.]+)\s*([a-zA-Z. ]+)/);
  if (!match) return null;
  let amount = parseFloat(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  let rawUnit = match[2].trim().toLowerCase().replace(/\.$/, '');
  if (rawUnit === 'cl') { amount *= 10; rawUnit = 'ml'; }
  else if (rawUnit === 'dl') { amount *= 100; rawUnit = 'ml'; }
  const unit = UNIT_ALIASES[rawUnit];
  return unit ? { amount, unit } : null;
}

/**
 * Look up a barcode (UPC/EAN) against Open Food Facts.
 * @param {string} code
 * @param {typeof fetch} fetchImpl injectable for testing
 * @returns {Promise<{barcode:string, name:string, brand:string, category:string, quantity:number, unit:string}>}
 */
async function lookupBarcode(code, fetchImpl = fetch) {
  const url = `${OFF_BASE}/${encodeURIComponent(code)}.json?fields=product_name,brands,categories_tags,quantity`;

  let res;
  try {
    res = await fetchImpl(url, { signal: AbortSignal.timeout(8000) });
  } catch (err) {
    const wrapped = new Error('Could not reach the barcode database. Check your connection and try again.');
    wrapped.code = 'LOOKUP_FAILED';
    throw wrapped;
  }
  if (!res.ok) {
    const err = new Error(`Barcode lookup failed (HTTP ${res.status}).`);
    err.code = 'LOOKUP_FAILED';
    throw err;
  }

  const data = await res.json();
  if (data.status !== 1 || !data.product || !data.product.product_name) {
    const err = new Error(`No product found for barcode ${code}. You can still add it manually.`);
    err.code = 'NOT_FOUND';
    throw err;
  }

  const product = data.product;
  const name = product.product_name.trim();
  // Prefer Open Food Facts' own category data over guessing from the name
  // — it knows "Nutella" is a hazelnut spread even though neither word
  // appears in the product name. Fall back to the name-based guess (and
  // ultimately "other") when OFF has no usable category tags.
  const category = guessCategoryFromTags(product.categories_tags) || guessCategory(name);
  const size = parsePackageSize(product.quantity);

  return {
    barcode: code,
    name,
    brand: (product.brands || '').split(',')[0].trim(),
    category,
    quantity: 1, // scanning a barcode always means you're adding 1 of this product
    unit: '', // a plain container word (e.g. "bottle") if you want to add one — not guessed
    fullnessUnit: size ? size.unit : null,
    fullnessAmount: size ? size.amount : null, // assumed full — it's presumably a fresh one
    fullnessTotal: size ? size.amount : null,
  };
}

module.exports = { lookupBarcode, parsePackageSize };
