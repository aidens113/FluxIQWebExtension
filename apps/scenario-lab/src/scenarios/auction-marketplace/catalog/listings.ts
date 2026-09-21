import type { Listing } from "../types.js";
import { ACCESSORIES } from "./accessories.js";
import { CAMERAS } from "./cameras.js";

const BY_HANDLE: Readonly<Record<string, Listing>> = { ...CAMERAS, ...ACCESSORIES };

/**
 * The order the site's Best Match ranks listings in, which is also the order
 * the index holds them. It is an authored order, not a computed one, so it
 * can put what it likes where it likes: the 35S the person last looked at
 * first, and two genuine auctions on each page seam, where the default page
 * size shows them twice.
 */
const BEST_MATCH = [
  "l1", "m1", "x4", "a1", "m7", "o3", "l2", "x9", "m2", "a2", "x1", "l4", "m9", "x7", "a6", "o1", "m10", "l7", "x5", "a3", "o6", "x11",
  "m3", "m6", "l3", "a7", "x2", "m8", "l5", "o4", "x12", "a4", "l6", "x3", "o2", "l9", "x8", "a5", "x13", "l8", "o5", "a8", "x10", "l10",
  "m4", "m5", "a9", "x6", "o7", "a10",
  "e1", "e2", "n1", "n2", "n3", "n4",
] as const;

/** Every listing in the fixture's slice of the marketplace, in Best Match order. */
export const LISTINGS: readonly Listing[] = BEST_MATCH.map((handle) => listingByHandle(handle));

/** A listing by its catalog handle (`m7`, `l1`, ...), which only the fixture's own code uses. */
export function listingByHandle(handle: string): Listing {
  const listing = BY_HANDLE[handle];
  if (!listing) throw new Error(`Unknown listing handle ${handle}`);
  return listing;
}

/** A live or ended listing by its item number. */
export function listingById(id: string): Listing | undefined {
  return LISTINGS.find((listing) => listing.id === id);
}
