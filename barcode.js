// Free, keyless barcode -> product lookup via Open Food Facts
// (https://world.openfoodfacts.org), a public, community-maintained product
// database. No API key or paid service involved.

const { guessCategory, guessCategoryFromTags } = require('./categorize');

const OFF_BASE = 'https://world.openfoodfacts.org/api/v2/product';

// Best-effort parse of Open Food Facts' free-text "quantity" field, e.g.
// "500 g", "1 L", "12 x 330 ml". Falls back to a plain count of 1 with no
// unit when it can't make sense of the string.
function parseQuantityString(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return { quantity: 1, unit: '' };
  const match = raw.match(/([\d.]+)\s*([a-zA-Z]+)/);
  if (match) {
    const quantity = parseFloat(match[1]);
    return {
      quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
      unit: match[2].toLowerCase(),
    };
  }
  return { quantity: 1, unit: '' };
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
  const { quantity, unit } = parseQuantityString(product.quantity);
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
    quantity,
    unit,
  };
}

module.exports = { lookupBarcode, parseQuantityString };
