import { STORE_PATHS } from "./store-paths.js";
import type { PriceBand, SearchFilters, SearchQuery, SortOrder } from "./types.js";

const BANDS: readonly PriceBand[] = ["under-25", "25-50", "50-100", "100-up"];
const SORTS: readonly SortOrder[] = ["featured", "price-asc", "price-desc", "review"];
const DEPARTMENTS = ["all", "electronics", "home", "grocery", "toys"] as const;

function dollarsToCents(value: string | null): number | null {
  if (value === null || !/^\d{1,5}(?:\.\d{1,2})?$/u.test(value.trim())) return null;
  return Math.round(Number(value.trim()) * 100);
}

function centsToDollars(cents: number): string {
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

/** A brand name as the filter rail's parameter spells it. */
function brandSlug(brand: string): string {
  return brand.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "");
}

function parse(params: URLSearchParams): SearchQuery {
  const refinements = (params.get("rh") ?? "").split(",").map((token) => token.trim()).filter(Boolean);
  const bandToken = refinements.find((token) => token.startsWith("price-"))?.slice("price-".length);
  const filters: SearchFilters = {
    plus: refinements.includes("plus"),
    stars4: refinements.includes("stars-4"),
    band: BANDS.find((band) => band === bandToken) ?? null,
    low: dollarsToCents(params.get("low")),
    high: dollarsToCents(params.get("high")),
    brands: refinements.filter((token) => token.startsWith("brand-")).map((token) => token.slice("brand-".length)),
  };
  const page = Number(params.get("page") ?? "1");
  const department = params.get("i") ?? "all";
  return {
    keywords: (params.get("k") ?? "").trim().slice(0, 120),
    department: (DEPARTMENTS as readonly string[]).includes(department) ? department : "all",
    filters,
    sort: SORTS.find((sort) => sort === params.get("s")) ?? "featured",
    page: Number.isSafeInteger(page) && page >= 1 ? page : 1,
  };
}

/**
 * The address of a search. Parameters appear in the order the store writes
 * them, and an unset one is left out, so two routes to the same search read
 * the same URL.
 */
function href(query: SearchQuery): string {
  const params = new URLSearchParams();
  params.set("k", query.keywords);
  if (query.department !== "all") params.set("i", query.department);
  const refinements = [
    ...(query.filters.plus ? ["plus"] : []),
    ...(query.filters.stars4 ? ["stars-4"] : []),
    ...(query.filters.band ? [`price-${query.filters.band}`] : []),
    ...query.filters.brands.map((brand) => `brand-${brand}`),
  ];
  if (refinements.length > 0) params.set("rh", refinements.join(","));
  if (query.filters.low !== null) params.set("low", centsToDollars(query.filters.low));
  if (query.filters.high !== null) params.set("high", centsToDollars(query.filters.high));
  if (query.sort !== "featured") params.set("s", query.sort);
  if (query.page > 1) params.set("page", String(query.page));
  return `${STORE_PATHS.search}?${params.toString()}`;
}

/** Reading and writing a search's URL, and the brand slug the rail uses. */
export const SEARCH_PARAMS = { parse, href, brandSlug } as const;
