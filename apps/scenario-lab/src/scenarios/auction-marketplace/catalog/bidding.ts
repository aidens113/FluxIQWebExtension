import type { Listing, PlacedBid } from "../types.js";

/** The bid increment at a price, in minor units, from the marketplace's published table. */
export function bidIncrement(minor: number): number {
  if (minor < 100) return 5;
  if (minor < 500) return 20;
  if (minor < 1_500) return 50;
  if (minor < 6_000) return 100;
  if (minor < 15_000) return 200;
  if (minor < 30_000) return 500;
  if (minor < 60_000) return 1_000;
  return 2_000;
}

/** The auction's price as it now stands, after any bid the person placed on it. */
export function currentPrice(listing: Listing, bids: readonly PlacedBid[]): number {
  const mine = bids.filter((bid) => bid.itemId === listing.id);
  return mine[mine.length - 1]?.current ?? listing.price;
}

/** The number of bids the auction now shows. */
export function bidCount(listing: Listing, bids: readonly PlacedBid[]): number {
  return listing.bids + bids.filter((bid) => bid.itemId === listing.id).length;
}

/** The least a new bid may be: the current price plus one increment. */
export function minimumBid(listing: Listing, bids: readonly PlacedBid[]): number {
  const current = currentPrice(listing, bids);
  return current + bidIncrement(current);
}

/**
 * Resolves a maximum bid against the current high bidder's hidden maximum, as
 * proxy bidding does: a higher maximum wins at one increment over the other
 * maximum, never more than it offered; a lower one is outbid at once, and the
 * price rises to one increment over it.
 */
export function resolveBid(listing: Listing, bids: readonly PlacedBid[], maxBid: number): PlacedBid {
  const rival = Math.max(listing.competitorMax ?? listing.price, currentPrice(listing, bids));
  if (maxBid > rival) return { itemId: listing.id, maxBid, current: Math.min(maxBid, rival + bidIncrement(rival)), winning: true };
  return { itemId: listing.id, maxBid, current: Math.min(rival, maxBid + bidIncrement(maxBid)), winning: false };
}
