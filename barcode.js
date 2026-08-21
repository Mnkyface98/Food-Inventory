// Free, keyless barcode -> product lookup via Open Food Facts
// (https://world.openfoodfacts.org), a public, community-maintained product
// database. No API key or paid service involved.

const { guessCategory, guessCategoryFromTags } = require('./categorize');

const OFF_BASE = 'https://world.openfoodfacts.org/api/v2/product';

// Open Food Facts' "quantity" field (e.g. "500 ml", "16 oz", "12 x 330 ml")
// describes how much is IN one package — not how many packages you have.
// Scanning a barcode always means you're adding exactly one of that
// product, so this is used as a size descriptor for the item's `unit`
// field (e.g. "1 × 500 ml"), never as the item's quantity. Falls back to
// the raw string, or '' if there's nothing usable.
function parsePackageSize(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return '';
  const match = raw.match(/([\d.]+)\s*([a-zA-Z]+)/);
  if (!match) return raw.trim();
  const amount = parseFloat(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return raw.trim();
  return `${match[1]} ${match[2].toLowerCase()}`;
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

  return {
    barcode: code,
    name,
    brand: (product.brands || '').split(',')[0].trim(),
    category,
    quantity: 1, // scanning a barcode always means you're adding 1 of this product
    unit: parsePackageSize(product.quantity), // e.g. "500 ml" — package size, not a count
  };
}

module.exports = { lookupBarcode, parsePackageSize };
