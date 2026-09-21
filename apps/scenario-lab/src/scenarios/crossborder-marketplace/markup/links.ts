import { SHIP_FROM_CODES, type SearchQuery, type SearchSort, type ShipOrigin } from "../catalog/index.js";
import { parseTypedPrice, type RegionCode } from "../locale/index.js";

export const MARKET_ROOT = "/scenarios/crossborder-marketplace/";

const SORTS: readonly SearchSort[] = ["default", "orders", "newest", "price_asc", "price_desc"];
const CODE_OF: Readonly<Record<ShipOrigin, string>> = { China: "CN", Spain: "ES", Poland: "PL", "Czech Republic": "CZ" };

export function itemHref(listingId: string): string {
  return `${MARKET_ROOT}item/${listingId}`;
}

/**
 * A results URL, written the way the storefront writes its own: filters as
 * short codes, the page last. `minPrice`/`maxPrice` carry what the buyer typed
 * in their own currency, so they are passed through as text.
 */
export function searchHref(query: { q: string; shipFrom?: readonly ShipOrigin[]; freeShipping?: boolean; fourStars?: boolean; minPrice?: string; maxPrice?: string; sort?: SearchSort; page?: number }): string {
  const params = new URLSearchParams({ q: query.q });
  if (query.shipFrom && query.shipFrom.length > 0) params.set("shipFrom", query.shipFrom.map((origin) => CODE_OF[origin]).join(","));
  if (query.freeShipping) params.set("freeShipping", "y");
  if (query.fourStars) params.set("minStar", "4");
  if (query.minPrice) params.set("minPrice", query.minPrice);
  if (query.maxPrice) params.set("maxPrice", query.maxPrice);
  if (query.sort && query.sort !== "default") params.set("sort", query.sort);
  if (query.page && query.page > 1) params.set("page", String(query.page));
  return `${MARKET_ROOT}search?${params.toString()}`;
}

/** Reads a results URL back into a query, ignoring anything the storefront would not have written. */
export function readSearchQuery(params: URLSearchParams, region: RegionCode): SearchQuery {
  const shipFrom = (params.get("shipFrom") ?? "").split(",").map((code) => SHIP_FROM_CODES[code.trim().toUpperCase()]).filter((origin): origin is ShipOrigin => origin !== undefined);
  const sortParam = params.get("sort");
  const page = Number(params.get("page") ?? "1");
  return {
    q: (params.get("q") ?? "").slice(0, 120),
    shipFrom: [...new Set(shipFrom)],
    freeShipping: params.get("freeShipping") === "y",
    fourStars: params.get("minStar") === "4",
    minCents: parseTypedPrice(params.get("minPrice"), region),
    maxCents: parseTypedPrice(params.get("maxPrice"), region),
    sort: SORTS.find((sort) => sort === sortParam) ?? "default",
    page: Number.isInteger(page) && page >= 1 && page <= 50 ? page : 1,
  };
}
