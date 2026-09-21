import { AD_ONLY_LISTINGS, listingById, ORGANIC_LISTINGS } from "./listings.js";
import type { Listing, ResultSlot, ShipOrigin } from "./types.js";

export type SearchSort = "default" | "orders" | "newest" | "price_asc" | "price_desc";

/** What a results URL asks for. Prices are euro cents; the page converts what the buyer typed. */
export type SearchQuery = {
  q: string;
  shipFrom: readonly ShipOrigin[];
  freeShipping: boolean;
  fourStars: boolean;
  minCents: number | null;
  maxCents: number | null;
  sort: SearchSort;
  page: number;
};

export type ResultPage = {
  slots: readonly ResultSlot[];
  page: number;
  pageCount: number;
  /** Organic results the query matches before any filter: what the header count shows, filtered or not. */
  unfilteredCount: number;
  /** Whether the buyer narrowed anything, which is what decides the ad rotation and the repeats. */
  narrowed: boolean;
};

/** Cards on a full results page, paid placements included. */
export const RESULTS_PER_PAGE = 20;
/** Where a page's three paid placements sit, counted from zero. */
const AD_POSITIONS = [1, 8, 15] as const;
const ORGANIC_PER_PAGE = RESULTS_PER_PAGE - AD_POSITIONS.length;

export const SHIP_FROM_CODES: Readonly<Record<string, ShipOrigin>> = { CN: "China", ES: "Spain", PL: "Poland", CZ: "Czech Republic" };

const id = (index: number) => ORGANIC_LISTINGS[index]!.id;
const AD_COPY = (organicIndex: number) => ORGANIC_LISTINGS[organicIndex]!;
const AD_ONLY = (index: number) => AD_ONLY_LISTINGS[index]!;

/**
 * Paid placements per page. Three of the nine are paid copies of organic
 * results -- the same listing, shown twice on the page it is bought on -- and
 * one of the six others is not a hub at all. A narrowed search gets its own
 * rotation, and it ignores the filters exactly as a real ad slot does: a
 * charger shows up under "Ships from Spain".
 */
const BROAD_ADS: readonly (readonly Listing[])[] = [
  [AD_COPY(4), AD_ONLY(0), AD_COPY(11)],
  [AD_ONLY(1), AD_ONLY(2), AD_COPY(29)],
  [AD_ONLY(3), AD_COPY(23), AD_ONLY(4)],
];
const NARROWED_ADS: readonly (readonly Listing[])[] = [
  [AD_ONLY(0), AD_ONLY(2), AD_COPY(4)],
  [AD_ONLY(3), AD_ONLY(4), AD_COPY(29)],
];

/**
 * Results a broad, Best Match search repeats at the top of a later page, the
 * way a ranking that moved between two requests does. Two of the three are
 * results a Spain, free-shipping, 4.5-star reader is collecting, so a reader
 * who does not deduplicate collects them twice.
 */
const REPEATED_ON_PAGE: Readonly<Record<number, readonly string[]>> = { 2: [id(16), id(14)], 3: [id(31)] };

export function normalizeSearchText(text: string): string {
  return text.toLowerCase().replace(/[-_]+/gu, " ").replace(/\s+/gu, " ").trim();
}

/** Whether a query is one the catalogue answers: a USB-C (or Type-C) hub, however it is spelled. */
export function matchesHubQuery(text: string): boolean {
  const words = normalizeSearchText(text);
  return /\bhubs?\b/u.test(words) && (/\busb\b/u.test(words) || /\btype c\b/u.test(words) || /\busbc\b/u.test(words));
}

export function searchResults(query: SearchQuery): ResultPage {
  const matched = matchesHubQuery(query.q) ? ORGANIC_LISTINGS : [];
  const narrowed = query.shipFrom.length > 0 || query.freeShipping || query.fourStars || query.minCents !== null || query.maxCents !== null;
  const filtered = sortListings(matched.filter((listing) => passesFilters(listing, query)), query.sort);
  const repeats = !narrowed && query.sort === "default";
  const pages = paginate(filtered, repeats);
  const pageCount = pages.length;
  const page = Math.min(Math.max(1, query.page), Math.max(1, pageCount));
  const organic = pages[page - 1] ?? [];
  const ads = organic.length === 0 ? [] : (narrowed ? NARROWED_ADS : BROAD_ADS)[page - 1] ?? [];
  return { slots: withAds(organic, ads), page, pageCount, unfilteredCount: matched.length, narrowed };
}

function passesFilters(listing: Listing, query: SearchQuery): boolean {
  if (query.shipFrom.length > 0 && !listing.origins.some((origin) => query.shipFrom.includes(origin))) return false;
  if (query.freeShipping && listing.shipping.kind !== "free") return false;
  if (query.fourStars && (listing.rating === null || listing.rating < 40)) return false;
  if (query.minCents !== null && listing.priceCents < query.minCents) return false;
  if (query.maxCents !== null && listing.priceCents > query.maxCents) return false;
  return true;
}

function sortListings(listings: readonly Listing[], sort: SearchSort): Listing[] {
  const ranked = [...listings];
  if (sort === "orders") ranked.sort((left, right) => soldCount(right) - soldCount(left));
  if (sort === "newest") ranked.sort((left, right) => right.id.localeCompare(left.id));
  if (sort === "price_asc") ranked.sort((left, right) => left.priceCents - right.priceCents);
  if (sort === "price_desc") ranked.sort((left, right) => right.priceCents - left.priceCents);
  return ranked;
}

function soldCount(listing: Listing): number {
  const digits = listing.sold.replace(/[^0-9]/gu, "");
  return digits === "" ? 0 : Number(digits);
}

/** Organic results per page, each later page of a repeating search opening with the results it repeats. */
function paginate(listings: readonly Listing[], repeats: boolean): Listing[][] {
  const pages: Listing[][] = [];
  let next = 0;
  while (next < listings.length) {
    const repeated = repeats ? (REPEATED_ON_PAGE[pages.length + 1] ?? []).map((repeatId) => listingById(repeatId)!) : [];
    const fresh = listings.slice(next, next + ORGANIC_PER_PAGE - repeated.length);
    pages.push([...repeated, ...fresh]);
    next += fresh.length;
  }
  return pages;
}

function withAds(organic: readonly Listing[], ads: readonly Listing[]): ResultSlot[] {
  const slots: ResultSlot[] = organic.map((listing) => ({ listing, sponsored: false }));
  AD_POSITIONS.forEach((position, index) => {
    const ad = ads[index];
    if (ad && position <= slots.length) slots.splice(position, 0, { listing: ad, sponsored: true });
  });
  return slots;
}
