/** Where the marketplace lives in the lab, and the addresses of its pages, shaped the way a real auction site shapes them. */
export const MARKET_ROOT = "/scenarios/auction-marketplace/";

export const RESULTS_SUBPATH = "sch/i.html";
export const WATCHLIST_SUBPATH = "mye/watchlist";
export const CHALLENGE_SUBPATH = "splashui/challenge";

/** A listing page, optionally with the tracking parameters a results card appends. */
export function itemPath(id: string, tracking = ""): string {
  return `${MARKET_ROOT}itm/${id}${tracking === "" ? "" : `?${tracking}`}`;
}

export function resultsPath(queryString: string): string {
  return `${MARKET_ROOT}${RESULTS_SUBPATH}?${queryString}`;
}
