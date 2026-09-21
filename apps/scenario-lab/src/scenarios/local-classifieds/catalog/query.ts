import { categoryBySlug, type CategorySlug } from "./categories.js";
import { listingConditions, type ListingCondition } from "./listing.js";
import { AVAILABILITY_OPTIONS, CONDITION_PARAMS, DAYS_OPTIONS, DEFAULT_RADIUS, DELIVERY_OPTIONS, RADIUS_OPTIONS, SORT_OPTIONS, type SortValue } from "./options.js";

/** Where a feed is shown: the marketplace's own front page, a category, or a search. */
export type FeedSurface = "home" | "category" | "search";

/**
 * Everything a results page is narrowed by. Empty `conditions` is any
 * condition; `null` prices and days are no limit. The address bar carries only
 * what differs from the defaults, under the names the filters write.
 */
export type FeedQuery = {
  surface: FeedSurface;
  category: CategorySlug | null;
  text: string;
  minPrice: number | null;
  maxPrice: number | null;
  radius: number;
  conditions: ListingCondition[];
  days: number | null;
  sort: SortValue;
  delivery: (typeof DELIVERY_OPTIONS)[number];
  availability: (typeof AVAILABILITY_OPTIONS)[number];
};

export function defaultFeedQuery(surface: FeedSurface, category: CategorySlug | null = null): FeedQuery {
  return { surface, category, text: "", minPrice: null, maxPrice: null, radius: DEFAULT_RADIUS, conditions: [], days: null, sort: "best_match", delivery: "all", availability: "available" };
}

/**
 * Reads a results page's address. A value the filters could not have written
 * falls back to its default, the way a real site shrugs off a hand-edited URL.
 */
export function parseFeedQuery(surface: FeedSurface, categorySlug: string | null, params: URLSearchParams): FeedQuery {
  const category = categorySlug === null ? null : (categoryBySlug(categorySlug)?.slug ?? null);
  const query = defaultFeedQuery(surface, category);
  query.text = (params.get("query") ?? "").trim().slice(0, 80);
  query.minPrice = price(params.get("minPrice"));
  query.maxPrice = price(params.get("maxPrice"));
  const radius = Number(params.get("radius"));
  if (RADIUS_OPTIONS.some((option) => option === radius)) query.radius = radius;
  const wanted = (params.get("itemCondition") ?? "").split(",");
  query.conditions = listingConditions.filter((condition) => wanted.includes(CONDITION_PARAMS[condition]));
  const days = Number(params.get("daysSinceListed"));
  if (DAYS_OPTIONS.some((option) => option === days)) query.days = days;
  const sort = SORT_OPTIONS.find((option) => option.value === params.get("sortBy"));
  if (sort) query.sort = sort.value;
  const delivery = DELIVERY_OPTIONS.find((option) => option === params.get("deliveryMethod"));
  if (delivery) query.delivery = delivery;
  const availability = AVAILABILITY_OPTIONS.find((option) => option === params.get("availability"));
  if (availability) query.availability = availability;
  return query;
}

/** The address-bar form of a query: only what differs from the defaults, always in the same order. */
export function feedQueryParams(query: FeedQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.text) params.set("query", query.text);
  if (query.minPrice !== null) params.set("minPrice", String(query.minPrice));
  if (query.maxPrice !== null) params.set("maxPrice", String(query.maxPrice));
  if (query.radius !== DEFAULT_RADIUS) params.set("radius", String(query.radius));
  if (query.conditions.length > 0) params.set("itemCondition", query.conditions.map((condition) => CONDITION_PARAMS[condition]).join(","));
  if (query.days !== null) params.set("daysSinceListed", String(query.days));
  if (query.sort !== "best_match") params.set("sortBy", query.sort);
  if (query.delivery !== "all") params.set("deliveryMethod", query.delivery);
  if (query.availability !== "available") params.set("availability", query.availability);
  return params;
}

/** One string per distinct result list, used to remember which batch of which list has already failed once. */
export function feedQueryKey(query: FeedQuery): string {
  return `${query.surface}:${query.category ?? ""}:${feedQueryParams(query).toString()}`;
}

function price(value: string | null): number | null {
  if (value === null || !/^\d{1,6}$/u.test(value.trim())) return null;
  return Number(value.trim());
}
