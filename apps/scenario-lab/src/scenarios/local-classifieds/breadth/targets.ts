import { defaultFeedQuery, type FeedQuery } from "../catalog/index.js";

/**
 * What each of the four breadth tasks is after, stated as the site would
 * search for it. Every answer is worked out from these with the site's own
 * search (`answers.ts`), so the oracle and the page cannot drift apart.
 */

/** Furniture within 5 miles of Kelford at £100 or less, newest listings first. */
export const FURNITURE_QUERY: FeedQuery = { ...defaultFeedQuery("category", "furniture"), radius: 5, maxPrice: 100, sort: "creation_time_descend" };

/** Road bikes within 5 miles, new to good, cheapest first: the first real listing is the one to message. */
export const ROAD_QUERY: FeedQuery = { ...defaultFeedQuery("search"), text: "road bike", radius: 5, conditions: ["new", "like-new", "good"], sort: "price_ascend" };

/** The listing the test-ride question goes to, and the question, word for word as the instruction gives it. */
export const TEST_RIDE_LISTING_KEY = "road-56";
export const TEST_RIDE_MESSAGE = "Hi, could I test ride it on Saturday morning?";

/** The listing whose price decides whether an offer goes, the limit it is checked against, and the offer it would get. */
export const PRICE_CHECK_LISTING_KEY = "carbon-road";
export const PRICE_CHECK_LIMIT = 350;
export const PRICE_CHECK_OFFER = 320;

/**
 * What Alex Rowe said he would accept for his road bike, in the account's
 * existing conversation with him (`view/inbox.ts`, and the chat window). The
 * buyer's own earlier "Would you take £180?" sits in the same thread.
 */
export const ALEX_FIGURE = 200;

/** Bicycles within 10 miles, new to good, at or under Alex's figure, cheapest first. */
export const BUDGET_BIKE_QUERY: FeedQuery = { ...defaultFeedQuery("category", "bicycles"), radius: 10, maxPrice: ALEX_FIGURE, conditions: ["new", "like-new", "good"], sort: "price_ascend" };
