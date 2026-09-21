import type { Listing, PlacedBid } from "../types.js";
import { currentPrice } from "./bidding.js";
import { CONDITION_CODES, type SearchParams } from "./filters.js";
import { LISTINGS } from "./listings.js";
import { postagePence, poundsEstimate } from "./money.js";

function tokens(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9äöüéèàß]+/u).filter(Boolean);
}

/**
 * Whether a listing answers the keywords: every word must begin a word of the
 * title, brand or model, so "35" finds "35S", "350" and "35mm" as a real
 * marketplace's broad match does; a word written with a leading minus sign
 * excludes listings whose title holds that exact word.
 */
function matchesKeywords(listing: Listing, query: string): boolean {
  const words = query.split(/\s+/u).filter(Boolean);
  const excluded = words.filter((word) => word.startsWith("-") && word.length > 1).flatMap((word) => tokens(word.slice(1)));
  const wanted = words.filter((word) => !word.startsWith("-")).flatMap(tokens);
  const own = tokens(`${listing.title} ${listing.brand} ${listing.model}`);
  const titleWords = new Set(tokens(listing.title));
  return wanted.every((word) => own.some((candidate) => candidate.startsWith(word))) && !excluded.some((word) => titleWords.has(word));
}

type Facet = "format" | "conditions" | "models" | "types" | "price";

function passes(listing: Listing, params: SearchParams, bids: readonly PlacedBid[], skip?: Facet): boolean {
  if (!matchesKeywords(listing, params.query)) return false;
  const auction = listing.format === "auction" || listing.format === "auction-bin";
  const buyNow = listing.format !== "auction";
  if (skip !== "format" && params.format === "auction" && !auction) return false;
  if (skip !== "format" && params.format === "bin" && !buyNow) return false;
  if (skip !== "conditions" && params.conditions.length > 0 && !params.conditions.some((code) => CONDITION_CODES[code] === listing.condition)) return false;
  if (skip !== "models" && params.models.length > 0 && !params.models.includes(listing.model)) return false;
  if (skip !== "types" && params.types.length > 0 && !params.types.includes(listing.type)) return false;
  if (skip !== "price") {
    const pence = poundsEstimate(listing.currency, currentPrice(listing, bids));
    if (params.minPrice !== null && pence < params.minPrice) return false;
    if (params.maxPrice !== null && pence > params.maxPrice) return false;
  }
  return true;
}

function sortKey(listing: Listing, sort: string, bids: readonly PlacedBid[]): number {
  if (sort === "1") return listing.endsIn ?? Number.MAX_SAFE_INTEGER;
  if (sort === "10") return listing.listedAgo;
  if (sort === "15") return poundsEstimate(listing.currency, currentPrice(listing, bids)) + postagePence(listing.currency, listing.postage);
  return 0;
}

/** Every live listing the search returns, in the order its sort puts them. Ties keep Best Match order. */
export function searchListings(params: SearchParams, bids: readonly PlacedBid[]): Listing[] {
  const live = LISTINGS.filter((listing) => !listing.ended && passes(listing, params, bids));
  return live.map((listing, rank) => ({ listing, rank, key: sortKey(listing, params.sort, bids) }))
    .sort((left, right) => left.key - right.key || left.rank - right.rank)
    .map(({ listing }) => listing);
}

/**
 * The total the results header states. The index still holds auctions that
 * have ended, and the header counts them, so it is always a little more than
 * the listings a person can page through.
 */
export function statedTotal(params: SearchParams, bids: readonly PlacedBid[]): number {
  return LISTINGS.filter((listing) => passes(listing, params, bids)).length;
}

/** How many listings each value of a facet would leave, counted as the header counts: ended ones included. */
export function facetCounts(params: SearchParams, bids: readonly PlacedBid[], facet: "conditions" | "models" | "types"): Map<string, number> {
  const counts = new Map<string, number>();
  for (const listing of LISTINGS) {
    if (!passes(listing, params, bids, facet)) continue;
    const value = facet === "conditions"
      ? Object.keys(CONDITION_CODES).find((code) => CONDITION_CODES[code] === listing.condition)!
      : facet === "models" ? listing.model : listing.type;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

/**
 * One page of results. Pages overlap by two: each page after the first starts
 * two listings before the previous one ended, the way a re-ranking index
 * repeats listings across a page boundary. A person paging through sees those
 * two twice and counts them once.
 */
export function pageWindow(total: number, page: number, perPage: number): { start: number; end: number; page: number; pages: number } {
  const stride = perPage - 2;
  const pages = total <= perPage ? 1 : 1 + Math.ceil((total - perPage) / stride);
  const current = Math.min(Math.max(page, 1), pages);
  const start = (current - 1) * stride;
  return { start, end: Math.min(start + perPage, total), page: current, pages };
}
