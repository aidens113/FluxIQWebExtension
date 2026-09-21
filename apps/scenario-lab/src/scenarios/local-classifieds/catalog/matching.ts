import { ADVERTS, type Advert } from "./adverts.js";
import { fnv } from "./identity.js";
import type { Listing } from "./listing.js";
import { LISTINGS } from "./listings/index.js";
import { placeById } from "./places.js";
import type { SortValue } from "./options.js";
import type { FeedQuery } from "./query.js";

/** The words of a title, lower-cased, as the search box compares them. */
function words(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/u).filter(Boolean);
}

/** Every word of the search must start some word of the title: "bike" finds "bikes", and "table" does not find "stable". */
export function matchesText(title: string, text: string): boolean {
  const wanted = words(text);
  const have = words(title);
  return wanted.every((word) => have.some((candidate) => candidate.startsWith(word)));
}

/** Whether a listing belongs on the page before any filter narrows it: its category or search, and its availability. */
function inScope(listing: Listing, query: FeedQuery): boolean {
  if (query.category !== null && listing.category !== query.category) return false;
  if (query.text && !matchesText(listing.title, query.text)) return false;
  return query.availability === "sold" ? listing.sold === true : listing.sold !== true;
}

function passesFilters(listing: Listing, query: FeedQuery): boolean {
  if (placeById(listing.place).miles > query.radius) return false;
  if (query.minPrice !== null && listing.price < query.minPrice) return false;
  if (query.maxPrice !== null && listing.price > query.maxPrice) return false;
  if (query.conditions.length > 0 && !query.conditions.includes(listing.condition)) return false;
  if (query.days !== null && listing.hours > query.days * 24) return false;
  if (query.delivery === "local_pick_up" && listing.delivery === "shipping") return false;
  if (query.delivery === "shipping" && listing.delivery === "pickup") return false;
  return true;
}

export function matchesQuery(listing: Listing, query: FeedQuery): boolean {
  return inScope(listing, query) && passesFilters(listing, query);
}

/** Orders listings the way the sort menu says. Ties fall back to the newest, then to the id, so every order is total. */
export function sortListings(listings: readonly Listing[], sort: SortValue): Listing[] {
  const miles = (listing: Listing) => placeById(listing.place).miles;
  const newest = (left: Listing, right: Listing) => left.hours - right.hours || left.id.localeCompare(right.id);
  const compare: Record<SortValue, (left: Listing, right: Listing) => number> = {
    best_match: (left, right) => suggestedRank(left) - suggestedRank(right) || newest(left, right),
    price_ascend: (left, right) => left.price - right.price || newest(left, right),
    price_descend: (left, right) => right.price - left.price || newest(left, right),
    creation_time_descend: newest,
    distance_ascend: (left, right) => miles(left) - miles(right) || newest(left, right),
  };
  return [...listings].sort(compare[sort]);
}

/** "Suggested" order: mostly recent, shuffled a little the way an engagement ranking is. */
function suggestedRank(listing: Listing): number {
  return listing.hours + (fnv(listing.key) % 72);
}

/** The listings a results page shows, in its order. */
export function matchingListings(query: FeedQuery): Listing[] {
  return sortListings(LISTINGS.filter((listing) => matchesQuery(listing, query)), query.sort);
}

/**
 * What the page shows once the real results run out, under "Results outside
 * your search": listings in the same category or search that one of the
 * filters turned away, nearest first. Six at most.
 */
export function outsideListings(query: FeedQuery): Listing[] {
  const outside = LISTINGS.filter((listing) => inScope(listing, query) && !passesFilters(listing, query));
  return sortListings(outside, "distance_ascend").slice(0, 6);
}

/**
 * The adverts bought against this page: its category, or any word of its
 * search. The front page carries the two the seed picks. No filter applies to
 * an advert, which is the point of buying one.
 */
export function advertsFor(query: FeedQuery, seed: number): Advert[] {
  if (query.surface === "home") {
    const first = Math.abs(seed) % ADVERTS.length;
    return [ADVERTS[first]!, ADVERTS[(first + 2) % ADVERTS.length]!];
  }
  const wanted = words(query.text);
  return ADVERTS.filter((advert) => (query.category !== null && advert.categories.includes(query.category))
    || (query.category === null && wanted.some((word) => advert.keywords.includes(word)))).slice(0, 2);
}
