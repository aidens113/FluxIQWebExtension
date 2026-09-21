import type { CategorySlug } from "./categories.js";
import { listingIdFor } from "./identity.js";
import type { PlaceId } from "./places.js";
import type { SellerId } from "./sellers.js";

export const listingConditions = ["new", "like-new", "good", "fair"] as const;

export type ListingCondition = (typeof listingConditions)[number];

/** How the buyer can take the item: collect it, have it posted, or either. */
export type ListingDelivery = "pickup" | "shipping" | "both";

/**
 * One listing as it was written. `price` is whole pounds and 0 means Free;
 * `was` is the price before the seller reduced it. `hours` is how long ago it
 * was listed, measured from the marketplace's fixed reference time, never the
 * wall clock, so a run at any hour reads the same page.
 */
export type AuthoredListing = {
  key: string;
  title: string;
  category: CategorySlug;
  price: number;
  was?: number;
  condition: ListingCondition;
  place: PlaceId;
  hours: number;
  seller: SellerId;
  delivery: ListingDelivery;
  sold?: true;
  description: string;
  details?: ReadonlyArray<readonly [string, string]>;
};

export type Listing = AuthoredListing & { id: string };

export function withIds(listings: readonly AuthoredListing[]): Listing[] {
  return listings.map((listing) => ({ ...listing, id: listingIdFor(listing.key) }));
}
