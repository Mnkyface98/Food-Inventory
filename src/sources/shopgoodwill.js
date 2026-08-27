import { makeListing } from "../listing.js";

/**
 * ShopGoodwill.com source.
 *
 * *** UNVERIFIED / BEST-EFFORT ***
 * ShopGoodwill has no public, documented API. This targets the internal
 * JSON endpoint their own web frontend calls
 * (buyerapi.shopgoodwill.com/api/Items/Search), reconstructed from public
 * knowledge of how their site works. Outbound network access in the
 * environment this was written in does not reach shopgoodwill.com, so this
 * has NOT been exercised against the live endpoint.
 *
 * Before relying on this:
 *   1. Open shopgoodwill.com in a browser, search "wall art", open DevTools
 *      Network tab, and find the actual request the search box fires.
 *   2. Compare its request body / response shape against REQUEST_BODY_BASE
 *      and mapListing below, and adjust field names as needed.
 *   3. Respect their Terms of Service and rate limits — this is an
 *      unofficial integration, not a sanctioned one.
 */

const SEARCH_URL = "https://buyerapi.shopgoodwill.com/api/Items/Search";

const REQUEST_BODY_BASE = {
  isSize: false,
  isWeddingCategory: false,
  isMultipleCategoryIds: false,
  isFromHeaderMenuTab: false,
  layout: "list",
  searchText: "",
  selectedCopyRegionId: "",
  selectedGroup: "",
  selectedCategoryIds: "",
  selectedSellerId: "",
  lowPrice: "0",
  highPrice: "999999",
  searchBuyNowOnly: "",
  searchPickupOnly: false,
  searchNoPickupOnly: false,
  searchOneCentShippingOnly: false,
  searchDescriptions: false,
  closedAuctionEndingDate: "",
  closedAuctionDaysBack: "0",
  page: 1,
  pageSize: 40,
  sortColumn: "0",
  sortDescending: true,
};

/**
 * @param {string} query
 * @param {number} limit
 * @returns {Promise<import("../listing.js").Listing[]>}
 */
export async function searchShopGoodwill(query, limit = 10) {
  const body = {
    ...REQUEST_BODY_BASE,
    searchText: query,
    pageSize: Math.min(limit, 40),
  };

  const res = await fetch(SEARCH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(
      `ShopGoodwill search failed (${res.status}). This endpoint is unofficial ` +
        `and may have changed — check the request shape via browser DevTools. ` +
        `Response: ${await res.text()}`,
    );
  }

  const data = await res.json();
  const items = Array.isArray(data) ? data : data.searchResults || data.items || [];

  return items.slice(0, limit).map(mapListing);
}

function mapListing(item) {
  const id = item.itemId ?? item.id;
  return makeListing({
    source: "shopgoodwill",
    id,
    title: item.title ?? item.itemTitle ?? "",
    url: `https://shopgoodwill.com/item/${id}`,
    imageUrls: [item.imageUrl ?? item.imageServerUrl].filter(Boolean),
    price: item.currentPrice != null ? `$${item.currentPrice}` : undefined,
    location: [item.city, item.state].filter(Boolean).join(", ") || undefined,
    endsAt: item.endTime ?? item.utcEndTime,
  });
}
