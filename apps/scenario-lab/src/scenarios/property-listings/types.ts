/**
 * The property search site's vocabulary: what a listing is, what a search asks
 * for, and the renderings the fixture can be armed into.
 *
 * `baseline` is the site as it ships. The three armed renderings are each one
 * thing a property portal does between a recording and a run, and one thing
 * only:
 *
 * - `agent-withheld` -- some sellers stop naming their agent on the results
 *   card, so that line is absent rather than blank and the field reads as no
 *   value at all.
 * - `renamed-pagination` -- the Next control keeps its place and its hook but
 *   becomes a link labelled "More homes", and the page counter is reworded, so
 *   a reader that recognises pagination by its words has to cope while one
 *   that follows the control does not.
 * - `redesigned-search` -- the search panel was redesigned: the Search button
 *   is gone and a button reading "Show homes" stands in its place, which is
 *   the same action under a new name.
 */
export const propertyVariants = ["baseline", "agent-withheld", "renamed-pagination", "redesigned-search"] as const;

export type PropertyVariant = (typeof propertyVariants)[number];

/** How the results are ordered; the site opens on the most recently listed. */
export type PropertySort = "recent" | "price-asc" | "price-desc";

/**
 * One home on the market. `priceGbp` and `floorAreaSqFt` are whole numbers the
 * page formats; `floorAreaSqFt` is absent when the agent published no floor
 * area, which is common enough on a real portal to be the normal case rather
 * than an error. `newBuild` is what leaves a home without a council tax band:
 * the band is set after completion, so the detail page has no row for it.
 */
export type PropertyListing = {
  reference: string;
  slug: string;
  address: string;
  area: string;
  bedrooms: number;
  propertyType: string;
  priceGbp: number;
  floorAreaSqFt?: number;
  agent: string;
  listedDaysAgo: number;
  tenure: string;
  epcRating: string;
  newBuild: boolean;
};

/** What the search panel is asking for. Empty strings are "any", as each select's first option is. */
export type PropertySearch = {
  page: number;
  area: string;
  beds: string;
  band: string;
  newThisWeek: boolean;
  sort: PropertySort;
};

/** One page of matches for a search; `search.page` is clamped to `pageCount`. */
export type PropertyResults = {
  search: PropertySearch;
  matchCount: number;
  pageCount: number;
  items: readonly PropertyListing[];
};

export type PropertyListingsState = {
  variant: PropertyVariant;
  /** The search last served. The start page itself always shows the default search. */
  search: PropertySearch;
  /** What `search` yields under `variant`: the oracle a run's final state is checked against. */
  oracle: { matchCount: number; pageCount: number; references: string[] };
  /** Every search served, oldest first, capped. */
  searchHistory: PropertySearch[];
  /** References of listing pages opened, oldest first, capped. */
  listingViews: string[];
};
