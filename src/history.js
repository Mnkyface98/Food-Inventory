import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_PATH = path.join("data", "seen.json");

/**
 * Tracks which listings (by source+id) have already been analyzed across
 * runs, so re-running the same search doesn't re-spend API calls re-reading
 * a listing you've already seen the writeup for.
 */
export async function loadHistory(historyPath = DEFAULT_PATH) {
  try {
    const raw = await fs.readFile(historyPath, "utf8");
    return new Map(Object.entries(JSON.parse(raw)));
  } catch (err) {
    if (err.code === "ENOENT") return new Map();
    throw err;
  }
}

export async function saveHistory(history, historyPath = DEFAULT_PATH) {
  await fs.mkdir(path.dirname(historyPath), { recursive: true });
  await fs.writeFile(historyPath, JSON.stringify(Object.fromEntries(history), null, 2));
}

export function listingKey(listing) {
  return `${listing.source}:${listing.id}`;
}

/**
 * Splits listings into ones already recorded in history and new ones.
 */
export function partitionSeen(listings, history) {
  const seen = [];
  const fresh = [];
  for (const listing of listings) {
    (history.has(listingKey(listing)) ? seen : fresh).push(listing);
  }
  return { seen, fresh };
}

/**
 * Records a listing + its analysis tier/timestamp into history (mutates the
 * Map in place — call saveHistory afterwards to persist).
 */
export function recordSeen(history, listing, tier) {
  history.set(listingKey(listing), {
    title: listing.title,
    tier,
    seenAt: new Date().toISOString(),
  });
}
