// The effect the answer-first draft keeps for the hood Flow's search step (t1090).
//
// Case 14's script carries no recorded effect on its search, so the effect check never ran
// there. In kestrel `run-mwz2jc4w` the same search did carry one, and the replay stopped
// `core.step.effect_not_seen` on the bot check the search landed on (t1083, K1). Case 14b
// saves the Flow with this effect on the search (`s1`): the home page to the results page,
// signed by the host's own `webAutomationRouteEffect` over the two route states, as the
// draft's build routing signs it (`framework/automation-service/route-state/build-routing.ts`).
//
// The pages are the auction-marketplace's, as the browser reports them (paths and the header
// names that matter here); the bot check is on neither, and shows none of what the search took away.

import type { JsonObject } from "fluxiq/core";
import { webAutomationRouteEffect } from "@fluxiq-web-extension/domain/node";

const HOME = "/scenarios/auction-marketplace/";
const RESULTS = "/scenarios/auction-marketplace/sch/i.html";
const HEADER = ["Sign out", "Daily Deals", "Help & Contact", "Sell", "Watchlist", "My Hammerline", "Search for anything", "Select a category for search", "Search", "Advanced"];

function routeState(path: string, controls: readonly string[]): JsonObject {
  return { page: { location: `http://127.0.0.1${path}`, path, controls: controls.join(" | ") } };
}

/** The search step's recorded effect: what the home page offered is gone, what the results page offers is there, and `from` and `path` name the two pages. */
export const HOOD_SEARCH_EFFECT: JsonObject = webAutomationRouteEffect(
  routeState(HOME, [...HEADER, "Kestrel 35S rangefinder camera", "Featured collections", "Trending on Hammerline", "Shop now"]),
  routeState(RESULTS, [...HEADER, "Seller refurbished", "Auction", "Buy it now", "Sort: Best Match", "Save this search", "Filter", "Condition", "Format", "Item location", "Delivery options"])
);
