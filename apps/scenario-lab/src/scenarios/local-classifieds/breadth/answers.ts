import { listingByKey, matchingListings, placeById, sellerById, type FeedQuery } from "../catalog/index.js";
import { conditionLabel, priceText } from "../format/index.js";
import { listingPath } from "../view/index.js";
import { BUDGET_BIKE_QUERY, FURNITURE_QUERY, PRICE_CHECK_LISTING_KEY, TEST_RIDE_LISTING_KEY } from "./targets.js";

/**
 * The breadth tasks' answers, worked out from the catalog with the same search
 * the site runs. `tests/breadth.test.ts` pins each to literal listings, so a
 * catalog edit that changes an answer fails loudly instead of quietly moving it.
 */

/** Each listing a filtered feed shows, once, in its order, as its card reads: no advert and nothing from outside the search. */
export function cardRecords(query: FeedQuery): Array<Record<string, string>> {
  return matchingListings(query).map((listing) => ({
    title: listing.title,
    price: priceText(listing.price),
    location: placeById(listing.place).name,
    url: listingPath(listing),
  }));
}

export const furnitureRecords = (): Array<Record<string, string>> => cardRecords(FURNITURE_QUERY);

export const budgetBikeRecords = (): Array<Record<string, string>> => cardRecords(BUDGET_BIKE_QUERY);

/** The bike the test-ride question went to, as its listing page names it and its seller. */
export function testRideRecords(): Array<Record<string, string>> {
  const listing = listingByKey(TEST_RIDE_LISTING_KEY);
  return [{ title: listing.title, price: priceText(listing.price), seller: sellerById(listing.seller).name }];
}

/** The bike whose price was checked, as its listing page states it: the current price, not the one struck through. */
export function priceCheckRecords(): Array<Record<string, string>> {
  const listing = listingByKey(PRICE_CHECK_LISTING_KEY);
  return [{ title: listing.title, price: priceText(listing.price), condition: conditionLabel(listing.condition) }];
}
