import type { RenderContext, ScenarioRouteRequest, ScenarioRouteResponse } from "../../types.js";
import { listingById, parseSearchParams, SELLERS } from "./catalog/index.js";
import {
  auctionClasses, flyoutListsMarkup, listingImage, renderBidHistory, renderChallenge, renderDescription, renderItem, renderResults,
  renderSeller, renderWatchlist, safeReturnPath, similarItemsMarkup,
} from "./pages/index.js";
import { CHALLENGE_SUBPATH, itemPath, MARKET_ROOT, RESULTS_SUBPATH, WATCHLIST_SUBPATH } from "./paths.js";
import type { AuctionState, Listing } from "./types.js";

/** Results pages a visitor may load before the bot check stops them, once. */
const CHALLENGE_AFTER_VIEWS = 3;

/** The seller description's frame is served from the second origin and may be framed by the marketplace on the first. */
const DESCRIPTION_CSP = "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; object-src 'none'; base-uri 'none'; frame-ancestors http://127.0.0.1:*";

function html(body: string): ScenarioRouteResponse {
  return { status: 200, body };
}

function liveListing(id: string | undefined): Listing | undefined {
  const listing = id === undefined ? undefined : listingById(id);
  return listing && !listing.ended ? listing : undefined;
}

/**
 * Every marketplace address below the home page.
 *
 * - `sch/i.html` is the results page. Serving one counts it, and the fourth
 *   results page of a session is sent to the bot check instead, which returns
 *   the visitor to the address they asked for once passed.
 * - `itm/<item number>` is a listing, `desc/<item number>` its seller's
 *   description, `img/<item number>/<n>.svg` its photographs,
 *   `bfl/viewbids/<item number>` its bid history.
 * - `sspa/click` is the ad server's redirect to the advertised listing.
 * - `str/<seller>` is a seller's shop and `mye/watchlist` the watchlist.
 * - `fragments/header` and `fragments/similar/<item number>` are what the
 *   pages fetch to refresh themselves.
 *
 * Anything else, an ended listing included, is a 404.
 */
export function routeAuctionMarketplace(state: AuctionState, request: ScenarioRouteRequest, context: RenderContext): ScenarioRouteResponse | undefined {
  const { subpath, query } = request;
  if (subpath === RESULTS_SUBPATH) {
    if (!state.challengePassed && state.resultsViews >= CHALLENGE_AFTER_VIEWS) {
      const back = `${MARKET_ROOT}${RESULTS_SUBPATH}?${query.toString()}`;
      return { status: 302, headers: { location: `${MARKET_ROOT}${CHALLENGE_SUBPATH}?ru=${encodeURIComponent(back)}` } };
    }
    return { ...html(renderResults(state, context, auctionClasses(context.seed), parseSearchParams(query))), mutation: { operation: "view-results" } };
  }
  if (subpath === CHALLENGE_SUBPATH) return html(renderChallenge(context, safeReturnPath(query.get("ru"))));
  if (subpath === WATCHLIST_SUBPATH) return html(renderWatchlist(state, context));
  if (subpath === "fragments/header") return html(Object.values(flyoutListsMarkup(auctionClasses(context.seed), state)).join(""));
  if (subpath === "sspa/click") {
    const listing = liveListing(query.get("id") ?? undefined);
    return listing ? { status: 302, headers: { location: itemPath(listing.id) } } : undefined;
  }
  const seller = /^str\/([a-z0-9._-]+)$/u.exec(subpath)?.[1];
  if (seller !== undefined) {
    const found = SELLERS.find((candidate) => candidate.id === decodeURIComponent(seller));
    return found ? html(renderSeller(state, context, found)) : undefined;
  }
  const [, kind, id, rest] = /^(itm|desc|img|bfl\/viewbids|fragments\/similar)\/(\d{12})(?:\/(\d)\.svg)?$/u.exec(subpath) ?? [];
  const listing = liveListing(id);
  if (!listing) return undefined;
  if (kind === "itm" && rest === undefined) return html(renderItem(state, context, listing));
  if (kind === "desc" && rest === undefined) return { status: 200, headers: { "content-security-policy": DESCRIPTION_CSP }, body: renderDescription(listing) };
  if (kind === "img" && rest !== undefined) return { status: 200, headers: { "content-type": "image/svg+xml" }, body: listingImage(listing, Number(rest)) };
  if (kind === "bfl/viewbids" && rest === undefined) return html(renderBidHistory(state, context, listing));
  if (kind === "fragments/similar" && rest === undefined) return html(similarItemsMarkup(state, context, listing));
  return undefined;
}
