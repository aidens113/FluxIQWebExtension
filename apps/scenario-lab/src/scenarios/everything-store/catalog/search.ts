import { EARBUD_ADS, EARBUDS, FEATURED_BRANDS } from "./earbuds/index.js";
import { HOUSEHOLD } from "./household.js";
import { KETTLE_ADS, KETTLES } from "./kettles/index.js";
import { SEARCH_PARAMS } from "./search-params.js";
import type { AdPlacement, Product, SearchFilters, SearchQuery } from "./types.js";

/**
 * What one search returns before it is cut into pages.
 *
 * `organic` is the filtered, sorted result list. `total` is what the results
 * bar claims: the true count once anything is narrowed, and the store's
 * habitual "over 1,000" for an unnarrowed earbud search, which is not true
 * and is what the real thing says. `brands` is the brand rail, built from
 * the unnarrowed results so a brand never disappears from it on selection.
 */
export type SearchOutcome = {
  keywords: string;
  organic: readonly Product[];
  ads: readonly AdPlacement[];
  featured: readonly Product[];
  alsoViewed: readonly Product[];
  brands: readonly string[];
  total: number | "over 1,000";
};

const POOLS: Readonly<Record<string, readonly Product[]>> = {
  all: [...EARBUDS, ...KETTLES, ...Object.values(HOUSEHOLD).filter((product) => !KETTLES.includes(product))],
  electronics: EARBUDS,
  home: [...KETTLES, HOUSEHOLD.batteries, HOUSEHOLD.cloths],
  grocery: [HOUSEHOLD.teaSampler],
  toys: [],
};

function words(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/u).filter(Boolean);
}

/** A listing matches when every word asked for is one of its title's words, singular or plural. */
function matches(product: Product, tokens: readonly string[]): boolean {
  const own = new Set(words(`${product.brand} ${product.title}`));
  return tokens.every((token) => own.has(token) || own.has(`${token}s`) || (token.endsWith("s") && own.has(token.slice(0, -1))));
}

/** The review filter reads the star icon, which is the average rounded to the nearest half star. */
function passesStars(product: Product): boolean {
  return Math.round(product.rating * 2) / 2 >= 4;
}

/** Each band in cents, both ends inclusive, as the rail's labels read: "$25 to $50" admits a listing at exactly $50.00. */
const BAND_BOUNDS: Readonly<Record<string, readonly [number, number]>> = {
  "under-25": [0, 2499],
  "25-50": [2500, 5000],
  "50-100": [5000, 10000],
  "100-up": [10000, Number.MAX_SAFE_INTEGER],
};

function passes(product: Product, filters: SearchFilters): boolean {
  if (filters.plus && !product.plus) return false;
  if (filters.stars4 && !passesStars(product)) return false;
  const band = filters.band ? BAND_BOUNDS[filters.band] : undefined;
  if (band && (product.priceCents < band[0] || product.priceCents > band[1])) return false;
  if (filters.low !== null && product.priceCents < filters.low) return false;
  if (filters.high !== null && product.priceCents > filters.high) return false;
  if (filters.brands.length > 0 && !filters.brands.includes(SEARCH_PARAMS.brandSlug(product.brand))) return false;
  return true;
}

function narrowed(filters: SearchFilters): boolean {
  return filters.plus || filters.stars4 || filters.band !== null || filters.low !== null || filters.high !== null || filters.brands.length > 0;
}

function sorted(products: readonly Product[], sort: SearchQuery["sort"]): Product[] {
  const list = [...products];
  if (sort === "price-asc") return list.sort((left, right) => left.priceCents - right.priceCents);
  if (sort === "price-desc") return list.sort((left, right) => right.priceCents - left.priceCents);
  if (sort === "review") return list.sort((left, right) => right.rating - left.rating || right.ratingCount - left.ratingCount);
  return list;
}

/**
 * Runs a search. Relevance order is the catalogue's authored order; the
 * other sorts are stable over it. Adverts and the house-brand carousel follow
 * the words searched for and ignore the filter rail entirely.
 */
export function searchCatalog(query: SearchQuery): SearchOutcome {
  const tokens = words(query.keywords);
  const pool = POOLS[query.department] ?? POOLS.all ?? [];
  const matching = tokens.length === 0 ? [] : pool.filter((product) => matches(product, tokens));
  const earbudSearch = matching.some((product) => product.kind === "earbuds");
  const kettleSearch = matching.some((product) => product.kind === "kettle");
  const organic = sorted(matching.filter((product) => passes(product, query.filters)), query.sort);
  return {
    keywords: query.keywords,
    organic,
    ads: earbudSearch ? EARBUD_ADS : kettleSearch ? KETTLE_ADS : [],
    featured: earbudSearch ? FEATURED_BRANDS : [],
    alsoViewed: earbudSearch ? [0, 2, 5, 8].map((rank) => EARBUDS[rank]).filter((product): product is Product => product !== undefined) : [],
    brands: [...new Set(matching.map((product) => product.brand))].slice(0, 12),
    total: earbudSearch && !narrowed(query.filters) ? "over 1,000" : organic.length,
  };
}
