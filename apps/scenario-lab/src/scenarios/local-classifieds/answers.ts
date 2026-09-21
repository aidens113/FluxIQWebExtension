import { listingByKey, matchingListings, placeById, sortListings, type Listing } from "./catalog/index.js";
import { priceText } from "./format/index.js";
import { savedTotalText } from "./readouts.js";
import { PRIOR_SAVED_KEYS } from "./state.js";
import { BIKE_QUERY, SAVED_TABLE_KEYS } from "./targets.js";
import { listingPath } from "./view/index.js";

/**
 * The answers the manifest judges by, worked out from the catalog with the
 * same search the site runs, so the oracle and the page cannot drift apart.
 * The scenario test pins each answer to literal titles as well, so a catalog
 * edit that changes an answer fails loudly instead of quietly moving it.
 */

/** Each bike once, in the order the site lists them, with no advert and nothing from outside the search. */
export function bikeRecords(): Array<Record<string, string>> {
  return matchingListings(BIKE_QUERY).map((listing) => ({
    title: listing.title,
    price: priceText(listing.price),
    location: placeById(listing.place).name,
    url: listingPath(listing),
  }));
}

/** Everything saved once the three tables are, cheapest first, as the saved list shows them. */
export function savedListings(): Listing[] {
  return sortListings([...PRIOR_SAVED_KEYS, ...SAVED_TABLE_KEYS].map((key) => listingByKey(key)), "price_ascend");
}

export function savedRecords(): Array<Record<string, string>> {
  return savedListings().map((listing) => ({ title: listing.title, price: priceText(listing.price), status: listing.sold ? "Sold" : "Available" }));
}

export const SAVED_TOTAL_AFTER = savedTotalText(PRIOR_SAVED_KEYS.length + SAVED_TABLE_KEYS.length);
