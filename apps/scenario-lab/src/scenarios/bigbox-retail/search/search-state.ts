import { SITE_ROOT } from "../catalog/index.js";
import { SORT_OPTIONS } from "./sort-options.js";

/**
 * What a results URL asks for. `facets` keeps the order the shopper ticked
 * them in, because that is the order the URL spells them in.
 */
export type SearchState = { q: string; facets: ReadonlyArray<readonly [string, string]>; sort: string; page: number };

const FACET_SEPARATOR = "||";

/** Reads `?q=&facet=group:value||group:value&sort=&page=` the way the results page does. */
export function readSearchState(query: URLSearchParams): SearchState {
  const facets = (query.get("facet") ?? "").split(FACET_SEPARATOR).flatMap((entry) => {
    const colon = entry.indexOf(":");
    return colon > 0 ? [[entry.slice(0, colon), entry.slice(colon + 1)] as const] : [];
  });
  const sort = SORT_OPTIONS.some((option) => option.value === query.get("sort")) ? query.get("sort")! : SORT_OPTIONS[0]!.value;
  const page = Number.parseInt(query.get("page") ?? "1", 10);
  return { q: (query.get("q") ?? "").trim(), facets, sort, page: Number.isSafeInteger(page) && page > 0 ? page : 1 };
}

/** The results URL for `state`, root-relative. A default sort and the first page are left out, as the site leaves them out. */
export function searchHref(state: SearchState): string {
  const query = new URLSearchParams({ q: state.q });
  if (state.facets.length > 0) query.set("facet", state.facets.map(([group, value]) => `${group}:${value}`).join(FACET_SEPARATOR));
  if (state.sort !== SORT_OPTIONS[0]!.value) query.set("sort", state.sort);
  if (state.page > 1) query.set("page", String(state.page));
  return `${SITE_ROOT}search?${query.toString()}`;
}
