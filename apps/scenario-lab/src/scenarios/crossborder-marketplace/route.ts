import type { RenderContext, ScenarioRouteRequest, ScenarioRouteResponse } from "../../types.js";
import { listingById } from "./catalog/index.js";
import {
  accountFlyoutMarkup, feedPage, FEED_PAGES, miniCartMarkup, renderCartPage, renderCheckoutPage, renderItemDescription, renderItemPage,
  renderOrderPage, renderPaymentFrame, renderSearchPage, renderVerifyPage, resultCard, searchCardsFragment,
} from "./markup/index.js";
import type { MarketState } from "./state/index.js";
import { marketClasses } from "./styles/index.js";

const ITEM = /^item\/(\d{13})$/u;
const ITEM_DESCRIPTION = /^item\/(\d{13})\/description$/u;
const ORDER = /^order\/(\d{16})$/u;
const IMAGE = /^img\/([a-z0-9-]+)\.svg$/u;

/** Seconds the feed tells a rate-limited client to wait. */
export const FEED_RETRY_AFTER_SECONDS = 3;

/**
 * Every page under the storefront but the home page. Full page loads report
 * themselves (`page-view`), which is what makes element ids change from load
 * to load; a results page reports `search-load` instead, and every third one
 * since the last check is replaced by the "verify you are human" page
 * (`search-challenge`) until that page is answered. Fragments, frames, images
 * and the flyout refresh report nothing. The feed's second request is refused
 * with 429 and a retry-after. Anything else is a 404.
 */
export function routeMarket(state: MarketState, request: ScenarioRouteRequest, context: RenderContext): ScenarioRouteResponse | undefined {
  const c = marketClasses(state.seed, state.mode);
  const { subpath, query } = request;
  if (subpath === "search") {
    if (state.search.challenged || state.search.loadsSinceCheck >= 2) {
      return { status: 200, body: renderVerifyPage(context, c), mutation: { operation: "search-challenge", payload: {} } };
    }
    return { status: 200, body: renderSearchPage(state, context, c, query), mutation: { operation: "search-load", payload: {} } };
  }
  if (subpath === "search/cards") return { status: 200, body: searchCardsFragment(state, c, query) };
  const item = ITEM.exec(subpath)?.[1];
  if (item !== undefined) {
    const listing = listingById(item);
    return listing ? { status: 200, body: renderItemPage(state, context, c, listing), mutation: { operation: "page-view", payload: {} } } : undefined;
  }
  const described = ITEM_DESCRIPTION.exec(subpath)?.[1];
  if (described !== undefined) {
    const listing = listingById(described);
    return listing ? { status: 200, body: renderItemDescription(listing) } : undefined;
  }
  if (subpath === "cart") return { status: 200, body: renderCartPage(state, context, c), mutation: { operation: "page-view", payload: {} } };
  if (subpath === "checkout") return { status: 200, body: renderCheckoutPage(state, context, c), mutation: { operation: "page-view", payload: {} } };
  if (subpath === "checkout/payment") return { status: 200, body: renderPaymentFrame(state, context, c) };
  const orderNumber = ORDER.exec(subpath)?.[1];
  if (orderNumber !== undefined) {
    const order = state.orders.find((candidate) => candidate.number === orderNumber && candidate.status === "paid");
    return order ? { status: 200, body: renderOrderPage(state, context, c, order), mutation: { operation: "page-view", payload: {} } } : undefined;
  }
  if (subpath === "flyouts") {
    return { status: 200, headers: { "content-type": "application/json; charset=utf-8" }, body: JSON.stringify({ account: accountFlyoutMarkup(state, c), miniCart: miniCartMarkup(state, c) }) };
  }
  if (subpath === "feed") return feed(state, c, Number(query.get("page") ?? "0"));
  const image = IMAGE.exec(subpath)?.[1];
  if (image !== undefined) return { status: 200, headers: { "content-type": "image/svg+xml" }, body: imageSvg(image) };
  return undefined;
}

function feed(state: MarketState, c: ReturnType<typeof marketClasses>, page: number): ScenarioRouteResponse | undefined {
  if (!Number.isInteger(page) || page < 2 || page > FEED_PAGES) return undefined;
  const mutation = { operation: "feed-request", payload: {} };
  if (state.feed.requests === 1) {
    return { status: 429, headers: { "retry-after": String(FEED_RETRY_AFTER_SECONDS), "content-type": "text/plain; charset=utf-8" }, body: "Too many requests", mutation };
  }
  return { status: 200, body: feedPage(page).map((slot) => resultCard(slot, c, state.region)).join(""), mutation };
}

const SWATCHES: Readonly<Record<string, string>> = { "space-grey": "#5b5f66", silver: "#c9ccd1", mint: "#9fe0c9", grey: "#8a8d93", black: "#1d1d1f", white: "#f4f4f4", pink: "#f3b6c8" };

/** A product photo or a colour swatch: a flat picture, the same for a name every time. */
function imageSvg(name: string): string {
  const swatch = name.startsWith("swatch-") ? SWATCHES[name.slice("swatch-".length)] : undefined;
  if (swatch) return `<svg xmlns="http://www.w3.org/2000/svg" width="52" height="52"><rect width="52" height="52" fill="${swatch}"/></svg>`;
  let hue = 0;
  for (const character of name) hue = (hue * 31 + character.charCodeAt(0)) % 360;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="hsl(${hue},25%,88%)"/><rect x="70" y="120" width="160" height="60" rx="14" fill="hsl(${hue},20%,40%)"/><circle cx="96" cy="150" r="8" fill="#fff"/><circle cx="124" cy="150" r="8" fill="#fff"/><circle cx="152" cy="150" r="8" fill="#fff"/></svg>`;
}
