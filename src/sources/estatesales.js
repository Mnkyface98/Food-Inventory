import * as cheerio from "cheerio";
import { makeListing } from "../listing.js";

/**
 * EstateSales.net source.
 *
 * *** UNVERIFIED / BEST-EFFORT ***
 * EstateSales.net has no API at all — this scrapes their public search HTML.
 * It has NOT been run against the live site (this environment's outbound
 * network doesn't reach it), so the CSS selectors below are a best guess
 * based on typical listing-page structure and will very likely need
 * correcting once you point it at the real page.
 *
 * Also worth checking before relying on this:
 *   - EstateSales.net's robots.txt and Terms of Service for what automated
 *     access they permit.
 *   - Rate limit yourself (this module does one request per call; don't
 *     loop it tightly).
 *   - Estate-sale listings are usually photos of a *sale*, not individual
 *     itemized art lots the way eBay/ShopGoodwill are — so "search for wall
 *     art" here really means "find sales whose listing mentions art/prints/
 *     paintings," and a human still has to look at the sale's photo gallery.
 */

const SEARCH_URL = "https://www.estatesales.net/search";

/**
 * @param {string} query
 * @param {number} limit
 * @returns {Promise<import("../listing.js").Listing[]>}
 */
export async function searchEstateSales(query, limit = 10) {
  const params = new URLSearchParams({ q: query });
  const res = await fetch(`${SEARCH_URL}?${params}`, {
    headers: {
      // A descriptive UA is more honest (and more polite) than pretending
      // to be a browser.
      "User-Agent": "thrift-art-scout/0.1 (personal research tool)",
    },
  });

  if (!res.ok) {
    throw new Error(`EstateSales.net search failed: ${res.status}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  const results = [];
  // GUESS: adjust this selector to match the real listing card markup.
  $(".sale-card, .listing-card, [data-testid='sale-card']").each((_, el) => {
    if (results.length >= limit) return;
    const card = $(el);
    const link = card.find("a").first();
    const href = link.attr("href");
    if (!href) return;

    const title = card.find("h2, h3, .sale-title").first().text().trim() || link.text().trim();
    const image = card.find("img").first().attr("src");
    const location = card.find(".sale-location, .location").first().text().trim() || undefined;
    const description = card.find(".sale-description, .description").first().text().trim() || undefined;

    results.push(
      makeListing({
        source: "estatesales",
        id: href,
        title,
        url: new URL(href, SEARCH_URL).toString(),
        imageUrls: image ? [new URL(image, SEARCH_URL).toString()] : [],
        location,
        description,
      }),
    );
  });

  return results;
}
