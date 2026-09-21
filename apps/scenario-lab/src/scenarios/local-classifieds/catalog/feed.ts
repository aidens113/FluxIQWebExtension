import type { Advert } from "./adverts.js";
import type { Listing } from "./listing.js";
import { advertsFor, matchingListings, outsideListings } from "./matching.js";
import type { FeedQuery } from "./query.js";

/** How many cards the feed sends at a time; the page asks for the next batch as the last one scrolls into view. */
export const FEED_BATCH_SIZE = 6;

export type FeedEntry = { kind: "listing"; listing: Listing } | { kind: "advert"; advert: Advert };

/**
 * One results list as the feed serves it, in batches.
 *
 * - `entries` is the matching listings in order, with the page's adverts
 *   dropped into it, and one listing sent twice: the first card of a later
 *   batch repeats the last listing of the batch before, which is what
 *   offset-paged infinite scroll does to a list that shifted between two
 *   requests. The seed decides where the adverts and the repeat fall.
 * - `outside` follows the last batch under "Results outside your search".
 * - `failingBatch` is the batch whose first request in a session fails and
 *   whose retry succeeds; `null` for a list too short to have one.
 */
export type ComposedFeed = { entries: FeedEntry[]; outside: Listing[]; failingBatch: number | null; batchCount: number; matchCount: number };

export function composeFeed(query: FeedQuery, seed: number): ComposedFeed {
  const turn = ((seed % 9_973) + 9_973) % 9_973;
  const matches = matchingListings(query);
  const entries: FeedEntry[] = matches.map((listing) => ({ kind: "listing", listing }));
  const adverts = advertsFor(query, seed);
  const firstSlot = Math.min(turn % 2, entries.length);
  adverts.forEach((advert, index) => {
    const slot = firstSlot + index * (FEED_BATCH_SIZE + (turn % 3));
    if (slot <= entries.length) entries.splice(slot, 0, { kind: "advert", advert });
  });
  if (entries.length > FEED_BATCH_SIZE) {
    const boundary = entries.length > 2 * FEED_BATCH_SIZE && turn % 2 === 1 ? 2 * FEED_BATCH_SIZE : FEED_BATCH_SIZE;
    const repeated = entries.slice(0, boundary).reverse().find((entry) => entry.kind === "listing");
    if (repeated) entries.splice(boundary, 0, repeated);
  }
  const batchCount = Math.max(1, Math.ceil(entries.length / FEED_BATCH_SIZE));
  const failingBatch = batchCount >= 3 ? 1 + ((turn + 1) % 2) : batchCount === 2 ? 1 : null;
  return { entries, outside: outsideListings(query), failingBatch, batchCount, matchCount: matches.length };
}

/** The cards of one batch, 0-based. */
export function feedBatch(feed: ComposedFeed, index: number): FeedEntry[] {
  return feed.entries.slice(index * FEED_BATCH_SIZE, (index + 1) * FEED_BATCH_SIZE);
}
