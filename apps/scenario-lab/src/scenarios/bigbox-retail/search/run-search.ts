import { PRODUCTS } from "../catalog/index.js";
import { FACET_GROUPS, type FacetGroup } from "./facet-groups.js";
import { matchesQuery } from "./query-match.js";
import type { SearchState } from "./search-state.js";
import { SORT_OPTIONS } from "./sort-options.js";
import { AD_POSITIONS, sponsoredFor } from "./sponsored.js";
import type { Product } from "../types.js";

/** Listings a results page shows, ads not counted. */
export const PAGE_SIZE = 12;

export type SearchEntry = { product: Product; sponsored: boolean };
export type FacetOption = { value: string; count: number; checked: boolean };
export type SearchResults = {
  state: SearchState;
  /** Listings the query and its filters found, over every page. */
  total: number;
  pageCount: number;
  /** The page shown, which is the one asked for, kept within the pages there are. */
  page: number;
  /** The page's listings with its ads among them, top-left first. */
  entries: SearchEntry[];
  facets: Array<{ group: FacetGroup; options: FacetOption[] }>;
};

/**
 * One page of results for `state` at the shopper's store: the query's
 * listings, narrowed by the ticked filters, sorted, cut to the page, with that
 * page's ads placed among them.
 *
 * A filter's count is the number of the query's listings that carry it before
 * any filter is applied, and it never moves as filters are ticked, which is
 * how the store's sidebar has always counted.
 */
export function runSearch(state: SearchState, storeId: string): SearchResults {
  const found = PRODUCTS.filter((product) => matchesQuery(product, state.q));
  const chosen = new Map<string, string[]>();
  for (const [group, value] of state.facets) chosen.set(group, [...(chosen.get(group) ?? []), value]);
  const narrowed = found.filter((product) => FACET_GROUPS.every((group) => {
    const values = chosen.get(group.key);
    return values === undefined || values.some((value) => group.holds(product, product.variants[0]!, storeId, value));
  }));
  const sort = SORT_OPTIONS.find((option) => option.value === state.sort) ?? SORT_OPTIONS[0]!;
  const sorted = narrowed.map((product, index) => ({ product, index })).sort((left, right) => sort.compare(left.product, right.product) || left.index - right.index).map(({ product }) => product);
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const page = Math.min(state.page, pageCount);
  const entries: SearchEntry[] = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((product) => ({ product, sponsored: false }));
  if (entries.length > 0) {
    sponsoredFor(state.q, page).forEach((product, index) => entries.splice(Math.min(AD_POSITIONS[index]!, entries.length), 0, { product, sponsored: true }));
  }
  const facets = FACET_GROUPS.map((group) => ({
    group,
    options: group.values(found).map((value) => ({
      value,
      count: found.filter((product) => group.holds(product, product.variants[0]!, storeId, value)).length,
      checked: (chosen.get(group.key) ?? []).includes(value),
    })).filter((option) => option.count > 0 || option.checked),
  })).filter((facet) => facet.options.length > 0);
  return { state: { ...state, page }, total: sorted.length, pageCount, page, entries, facets };
}
