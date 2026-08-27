/**
 * Normalized shape every source module returns, so downstream analysis and
 * reporting don't need to know which site a listing came from.
 *
 * @typedef {Object} Listing
 * @property {string} source        - "ebay" | "shopgoodwill" | "estatesales"
 * @property {string} id            - source-specific unique id
 * @property {string} title
 * @property {string} url           - link to the live listing
 * @property {string[]} imageUrls   - direct image URLs, largest first
 * @property {string} [price]       - raw price string as shown on the site
 * @property {string} [location]
 * @property {string} [description]
 * @property {string} [endsAt]      - ISO date if the listing/auction has an end time
 */

export function makeListing(fields) {
  return {
    source: fields.source,
    id: String(fields.id),
    title: fields.title || "",
    url: fields.url,
    imageUrls: fields.imageUrls || [],
    price: fields.price,
    location: fields.location,
    description: fields.description,
    endsAt: fields.endsAt,
  };
}
