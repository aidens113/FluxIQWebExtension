import { defaultFeedQuery, type FeedQuery } from "./catalog/index.js";

/**
 * What each task is after, stated as the site would search for it: the three
 * searches a person runs, the listing the offer is for and its amount, and the
 * three tables the save task saves.
 */

/** The extraction task's search: bicycles within 10 miles, £100 to £400, new to good, cheapest first. */
export const BIKE_QUERY: FeedQuery = { ...defaultFeedQuery("category", "bicycles"), radius: 10, minPrice: 100, maxPrice: 400, conditions: ["new", "like-new", "good"], sort: "price_ascend" };

/** The offer task's search: folding bikes within 10 miles, like new, listed in the last week, cheapest first. */
export const FOLDING_QUERY: FeedQuery = { ...defaultFeedQuery("search"), text: "folding bike", radius: 10, conditions: ["like-new"], days: 7, sort: "price_ascend" };

/** The save task's search: dining tables within 5 miles, cheapest first. */
export const DINING_QUERY: FeedQuery = { ...defaultFeedQuery("search"), text: "dining table", radius: 5, sort: "price_ascend" };

/** The listing the offer is for, the amount, and the three tables the save task saves. */
export const OFFER_LISTING_KEY = "folding-16in";
export const OFFER_AMOUNT = 140;
export const SAVED_TABLE_KEYS = ["pine-round-table", "glass-table", "industrial-table"] as const;

