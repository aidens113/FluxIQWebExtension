import type { RenderContext, ScenarioRouteRequest, ScenarioRouteResponse } from "../../types.js";
import { advertById, composeFeed, feedQueryKey, listingById, parseFeedQuery, PLACES, type FeedSurface } from "./catalog/index.js";
import { humanCheckDue } from "./limits.js";
import { accountPage, advertPage, listingPage, mapPage, pageBuild, peoplePage, resultsPage, type AccountPage } from "./pages/index.js";
import { buyingCount, latestOffer, offerReceiptText } from "./readouts.js";
import type { ClassifiedsState } from "./types.js";
import { batchMarkup, listingPanelMarkup, outsideMarkup } from "./view/index.js";

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
/** The map is framed by the marketplace on the lab's other loopback port, so it names that ancestry rather than 'self'. */
const MAP_FRAME_CSP = "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors http://127.0.0.1:*";
const ACCOUNT_PAGES: readonly AccountPage[] = ["saved", "inbox", "buying", "notifications", "selling"];
const FAILED_BATCH_MESSAGE = "Couldn't load more listings.";

/**
 * Every address under the marketplace except its front page, which the
 * scenario's `render` serves. Pages follow the armed rendering and the
 * session; the JSON addresses are what the pages fetch.
 *
 * Errors the page recovers from are answered 200 with an error in the body,
 * the way a GraphQL endpoint answers, so a browser logs nothing for them.
 */
export function routeClassifieds(state: ClassifiedsState, request: ScenarioRouteRequest, context: RenderContext, now: number): ScenarioRouteResponse | undefined {
  const build = pageBuild(context.seed, context.runToken, context.alternateOrigin);
  const path = request.subpath;
  if (path === "browse" || path === "browse/") return html(resultsPage(build, state, parseFeedQuery("home", null, request.query)));
  if (path === "search" || path === "search/") return html(resultsPage(build, state, parseFeedQuery("search", null, request.query)));
  const category = /^category\/([a-z-]+)\/?$/u.exec(path)?.[1];
  if (category !== undefined) {
    const query = parseFeedQuery("category", category, request.query);
    return query.category === null ? undefined : html(resultsPage(build, state, query));
  }
  if (path === "feed.json") return feed(state, request, build, now);
  const item = /^item\/(\d{16})\/(detail\.json|receipt\.json)?$/u.exec(path);
  if (item) {
    const listing = listingById(item[1]!);
    if (!listing) return undefined;
    if (item[2] === "detail.json") {
      const mapOrigin = context.alternateOrigin ?? "";
      return json({ html: listingPanelMarkup(build.sheet, build.ids, listing, state, mapOrigin) });
    }
    if (item[2] === "receipt.json") {
      const offer = latestOffer(state, listing.id);
      return json({ receipt: offer ? offerReceiptText(offer) : null, buying: buyingCount(state) });
    }
    return { ...html(listingPage(build, state, listing)), mutation: { operation: "view", payload: { id: listing.id } } };
  }
  const account = ACCOUNT_PAGES.find((name) => path === name || path === `${name}/`);
  if (account) return html(accountPage(build, state, account));
  if (path === "people" || path === "people/") return html(peoplePage(build, state, (request.query.get("q") ?? "").trim().slice(0, 80)));
  const advert = /^ad\/([a-z0-9-]+)\/?$/u.exec(path)?.[1];
  if (advert !== undefined) {
    const found = advertById(advert);
    return found ? html(advertPage(build, found)) : undefined;
  }
  const place = PLACES.find((candidate) => path === `map/${candidate.id}/`);
  if (place) return { status: 200, headers: { "content-security-policy": MAP_FRAME_CSP }, body: mapPage(place) };
  return undefined;
}

/**
 * One batch of a results feed. A new search -- the first batch -- is where the
 * "checking your browser" pause can come instead of listings, and each is
 * logged for it. The batch the list has chosen to fail fails on its first
 * request in the session and loads on the next.
 */
function feed(state: ClassifiedsState, request: ScenarioRouteRequest, build: ReturnType<typeof pageBuild>, now: number): ScenarioRouteResponse | undefined {
  const surface = request.query.get("surface");
  if (surface !== "home" && surface !== "category" && surface !== "search") return undefined;
  const query = parseFeedQuery(surface satisfies FeedSurface, request.query.get("category"), request.query);
  if (surface === "category" && query.category === null) return undefined;
  const batch = Number(request.query.get("batch"));
  if (!Number.isSafeInteger(batch) || batch < 0) return undefined;
  const layout = state.mode === "list-layout" ? "list" : "grid";
  if (batch === 0) {
    const logged = { operation: "feed-request", payload: { at: now } };
    if (humanCheckDue(state.feedLog, now)) return { ...json({ challenge: true }), mutation: logged };
    return { ...json(batchBody(query, batch, build, layout)), mutation: logged };
  }
  const composed = composeFeed(query, build.seed);
  if (batch >= composed.batchCount) return json({ html: "", next: null, end: outsideMarkup(composed, build.sheet, layout) });
  const key = `${feedQueryKey(query)}|${batch}`;
  if (batch === composed.failingBatch && !state.failedBatches.includes(key)) {
    return { ...json({ error: FAILED_BATCH_MESSAGE }), mutation: { operation: "batch-failed", payload: { key } } };
  }
  return json(batchBody(query, batch, build, layout));
}

function batchBody(query: ReturnType<typeof parseFeedQuery>, batch: number, build: ReturnType<typeof pageBuild>, layout: "grid" | "list") {
  const composed = composeFeed(query, build.seed);
  const next = batch + 1 < composed.batchCount ? batch + 1 : null;
  return { html: batchMarkup(composed, batch, build.sheet, layout), next, ...(next === null ? { end: outsideMarkup(composed, build.sheet, layout) } : {}) };
}

function html(body: string): ScenarioRouteResponse {
  return { status: 200, body };
}

function json(value: unknown): ScenarioRouteResponse {
  return { status: 200, headers: JSON_HEADERS, body: JSON.stringify(value) };
}
