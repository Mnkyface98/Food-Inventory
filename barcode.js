// Free, keyless barcode -> product lookup via Open Food Facts
// (https://world.openfoodfacts.org), a public, community-maintained product
// database. No API key or paid service involved.

const { guessCategory, guessCategoryFromTags, guessLocation } = require('./categorize');

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

// Maps Open Food Facts' packaging_tags (e.g. "en:glass-jar", "en:tetra-
// pak", "en:aluminium-can") onto the app's own container-type dropdown
// (bottle, box, piece, can, bag, jar, package, carton, stick, bunch).
// Longest/most-specific phrase wins so "tetra pak" (a carton) isn't
// mistaken for a generic "box" it also happens to mention. Not every
// product has this data, or a mappable one when it does — returns ''
// (no guess) rather than forcing a wrong pick.
const PACKAGING_UNIT_TAG_RULES = [
  ['tetra pak', 'carton'], ['brick', 'carton'], ['carton', 'carton'],
  ['glass jar', 'jar'], ['jar', 'jar'],
  ['aluminium can', 'can'], ['steel can', 'can'], ['metal can', 'can'], ['can', 'can'],
  ['cardboard box', 'box'], ['box', 'box'],
  ['plastic bottle', 'bottle'], ['glass bottle', 'bottle'], ['bottle', 'bottle'],
  ['pouch', 'bag'], ['sachet', 'bag'], ['bag', 'bag'],
  ['stick', 'stick'],
].sort((a, b) => b[0].length - a[0].length);

function guessPackagingUnit(packagingTags) {
  if (!Array.isArray(packagingTags) || packagingTags.length === 0) return '';
  const joined = packagingTags
    .map((t) => String(t).toLowerCase().replace(/^[a-z]{2,3}:/, '').replace(/-/g, ' '))
    .join(' ');
  for (const [phrase, unit] of PACKAGING_UNIT_TAG_RULES) {
    if (new RegExp(`\\b${phrase.replace(/ /g, '\\s+')}\\b`).test(joined)) return unit;
  }
  return '';
}

/**
 * Look up a barcode (UPC/EAN) against Open Food Facts.
 * @param {string} code
 * @param {typeof fetch} fetchImpl injectable for testing
 * @returns {Promise<{barcode:string, name:string, brand:string, category:string, quantity:number, unit:string, location:string, fullnessUnit:?string, fullnessAmount:?number, fullnessTotal:?number}>}
 */
async function lookupBarcode(code, fetchImpl = fetch) {
  const url = `${OFF_BASE}/${encodeURIComponent(code)}.json?fields=product_name,brands,categories_tags,quantity,packaging_tags`;

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
    // Best-effort from OFF's own packaging data (e.g. "en:glass-jar") —
    // still blank, not guessed, when OFF has nothing usable, same as
    // location/fullness below; every field here is "use what the barcode
    // actually told us," never a forced guess dressed up as fact.
    unit: guessPackagingUnit(product.packaging_tags),
    location: guessLocation(name),
    fullnessUnit: size ? size.unit : null,
    fullnessAmount: size ? size.amount : null, // assumed full — it's presumably a fresh one
    fullnessTotal: size ? size.amount : null,
  };
}

module.exports = { lookupBarcode, parsePackageSize };
