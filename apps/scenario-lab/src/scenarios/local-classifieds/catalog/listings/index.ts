import { withIds, type Listing } from "../listing.js";
import { BICYCLE_LISTINGS } from "./bicycles.js";
import { FURNITURE_LISTINGS } from "./furniture.js";
import { HOUSEHOLD_LISTINGS } from "./household.js";

/** Every listing on the marketplace, in authored order. Nothing here depends on the lab seed. */
export const LISTINGS: readonly Listing[] = Object.freeze(withIds([...BICYCLE_LISTINGS, ...FURNITURE_LISTINGS, ...HOUSEHOLD_LISTINGS]));

export function listingById(id: string): Listing | undefined {
  return LISTINGS.find((listing) => listing.id === id);
}

/** The listing an authored key names. Throws, because a key is written in source and a missing one is a fixture defect. */
export function listingByKey(key: string): Listing {
  const listing = LISTINGS.find((candidate) => candidate.key === key);
  if (!listing) throw new Error(`Unknown listing key ${key}`);
  return listing;
}
