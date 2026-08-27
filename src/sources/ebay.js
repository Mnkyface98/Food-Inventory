import { makeListing } from "../listing.js";

/**
 * eBay Browse API source.
 *
 * This is the one source in this project backed by an official, documented
 * API (https://developer.ebay.com/api-docs/buy/browse/overview.html), so it
 * should work as written once you have real client credentials — it has
 * NOT been exercised against the live API in this session because outbound
 * network access here is restricted to a small allowlist that does not
 * include api.ebay.com.
 */

let cachedToken = null;
let cachedTokenExpiry = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < cachedTokenExpiry) return cachedToken;

  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "EBAY_CLIENT_ID / EBAY_CLIENT_SECRET not set. See .env.example.",
    );
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "https://api.ebay.com/oauth/api_scope",
    }),
  });

  if (!res.ok) {
    throw new Error(`eBay OAuth token request failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  cachedToken = data.access_token;
  // Refresh a little early rather than exactly on expiry.
  cachedTokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken;
}

/**
 * @param {string} query - search keywords, e.g. "vintage oil painting"
 * @param {number} limit
 * @returns {Promise<import("../listing.js").Listing[]>}
 */
export async function searchEbay(query, limit = 10) {
  const token = await getAccessToken();

  const params = new URLSearchParams({
    q: query,
    limit: String(limit),
  });
  if (process.env.EBAY_CATEGORY_ID) {
    params.set("category_ids", process.env.EBAY_CATEGORY_ID);
  }

  const res = await fetch(
    `https://api.ebay.com/buy/browse/v1/item_summary/search?${params}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        // Marketplace ID controls currency/region; adjust if you're outside the US.
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
      },
    },
  );

  if (!res.ok) {
    throw new Error(`eBay search failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const items = data.itemSummaries || [];

  return items.map((item) =>
    makeListing({
      source: "ebay",
      id: item.itemId,
      title: item.title,
      url: item.itemWebUrl,
      imageUrls: [item.image?.imageUrl, ...(item.additionalImages || []).map((i) => i.imageUrl)].filter(
        Boolean,
      ),
      price: item.price ? `${item.price.value} ${item.price.currency}` : undefined,
      location: item.itemLocation
        ? [item.itemLocation.city, item.itemLocation.stateOrProvince, item.itemLocation.country]
            .filter(Boolean)
            .join(", ")
        : undefined,
      description: item.shortDescription,
    }),
  );
}
