import type { ListingCondition } from "./listing.js";

/**
 * What the results page's filters offer, and how each choice is spelled in
 * the address bar: the vocabulary a query is written in.
 */

/** The radii the location picker offers, in miles. */
export const RADIUS_OPTIONS = [1, 2, 5, 10, 20, 40, 60, 100] as const;
export const DEFAULT_RADIUS = 20;

export const SORT_OPTIONS = [
  { value: "best_match", label: "Suggested" },
  { value: "price_ascend", label: "Price: lowest first" },
  { value: "price_descend", label: "Price: highest first" },
  { value: "creation_time_descend", label: "Date listed: newest first" },
  { value: "distance_ascend", label: "Distance: nearest first" },
] as const;

export type SortValue = (typeof SORT_OPTIONS)[number]["value"];

/** How a condition travels in the address bar, as the filter sends it. */
export const CONDITION_PARAMS: Readonly<Record<ListingCondition, string>> = { "new": "new", "like-new": "used_like_new", good: "used_good", fair: "used_fair" };

export const DAYS_OPTIONS = [1, 7, 30] as const;
export const DELIVERY_OPTIONS = ["all", "local_pick_up", "shipping"] as const;
export const AVAILABILITY_OPTIONS = ["available", "sold"] as const;
