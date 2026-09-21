import type { RenderContext, ScenarioRouteRequest, ScenarioRouteResponse } from "../../types.js";
import { CATALOG, SEARCH_PARAMS, STORE_PATHS } from "./catalog/index.js";
import {
  cartMainMarkup, cartSummaryMarkup, pageKit, productImageSvg, renderCartPage, renderCheckoutPage, renderConfirmationPage,
  renderMoreResults, renderPaymentFrame, renderProductPage, renderRobotCheck, renderSearchPage, renderSoftCheck, renderThrottled,
} from "./pages/index.js";
import { robotCheckActive, STORE_THROTTLE, type StoreState } from "./state/index.js";

const PRODUCT = /^(?:[A-Za-z0-9-]{1,120}\/)?dp\/(B0[A-Z0-9]{8})$/u;
const IMAGE = /^img\/(B0[A-Z0-9]{8})\.svg$/u;

function html(body: string, status = 200): ScenarioRouteResponse {
  return { status, body };
}

/** The state the store will be in once this request's own mutation lands, for rendering the response to it. */
function flaggedByHoneypot(state: StoreState): StoreState {
  return { ...state, guard: { ...state.guard, flagged: "honeypot", robot: { ...state.guard.robot, solved: false } } };
}

/**
 * A results-page request, and the defences in front of it, in the order the
 * store applies them.
 *
 * 1. The search form's honeypot came back filled: the session is flagged and
 *    this very response is the robot check.
 * 2. More results pages than the limiter allows: a 429 with `Retry-After`.
 *    The refusal is counted; the request is not.
 * 3. The session's first search: the soft check, served at the same address.
 * 4. The results.
 *
 * Every request that gets past the limiter is stamped with `now`, which is
 * what the limiter counts on the next one.
 */
function searchRoute(state: StoreState, request: ScenarioRouteRequest, context: RenderContext, now: number): ScenarioRouteResponse {
  const honeypot = (request.query.get("field-keywords") ?? "").trim() !== "";
  if (honeypot) return { ...html(renderRobotCheck(pageKit(flaggedByHoneypot(state), context))), mutation: { operation: "search-request", payload: { at: now, honeypot: true } } };
  const query = SEARCH_PARAMS.parse(request.query);
  const decision = STORE_THROTTLE.decide(state.guard.searchLoads, now);
  if (!decision.allowed) {
    return {
      status: 429,
      headers: { "retry-after": String(decision.retryAfterSeconds) },
      body: renderThrottled(pageKit(state, context), decision.retryAfterSeconds, SEARCH_PARAMS.href(query)),
      mutation: { operation: "throttled", payload: { at: now } },
    };
  }
  const mutation = { operation: "search-request", payload: { at: now, honeypot: false } };
  if (state.guard.softCheck === "pending") return { ...html(renderSoftCheck(pageKit(state, context))), mutation };
  return { ...html(renderSearchPage(pageKit(state, context), query)), mutation };
}

/**
 * Every address under the store other than its home page. `now` is the time
 * the request arrived, which only the results pages' rate limiter reads; the
 * scenario passes the wall clock, and tests pass whatever they need.
 *
 * Product photos are served whatever else is going on. Everything else is
 * answered with the robot check while it stands, and fragments the page's
 * own scripts fetch are refused outright.
 */
export function routeStore(state: StoreState, request: ScenarioRouteRequest, context: RenderContext, now: number): ScenarioRouteResponse | undefined {
  const { subpath, query } = request;
  const image = IMAGE.exec(subpath)?.[1];
  if (image !== undefined) {
    const product = CATALOG.bySku(image);
    return product ? { status: 200, headers: { "content-type": "image/svg+xml", "cache-control": "max-age=3600" }, body: productImageSvg(product) } : undefined;
  }
  const kit = pageKit(state, context);
  const fragment = subpath === "s/more" || subpath === "cart/summary" || (subpath === "cart" && query.get("part") === "main");
  const productSku = PRODUCT.exec(subpath)?.[1];
  const product = productSku === undefined ? undefined : CATALOG.bySku(productSku);
  const known = fragment || product !== undefined || ["s", "cart", "checkout", "checkout/payment-frame", "thankyou", "sspa/click"].includes(subpath);
  if (!known) return undefined;
  if (robotCheckActive(state)) return fragment ? { status: 403, body: "" } : html(renderRobotCheck(kit));
  if (subpath === "s") return searchRoute(state, request, context, now);
  if (subpath === "s/more") return html(renderMoreResults(kit, SEARCH_PARAMS.parse(query)));
  if (product) return html(renderProductPage(kit, product));
  if (subpath === "cart/summary") return html(cartSummaryMarkup(kit));
  if (subpath === "cart") return html(query.get("part") === "main" ? cartMainMarkup(kit) : renderCartPage(kit));
  if (subpath === "checkout") return html(renderCheckoutPage(kit));
  if (subpath === "checkout/payment-frame") return html(renderPaymentFrame(kit));
  if (subpath === "thankyou") return html(renderConfirmationPage(kit, query.get("orderId")));
  const target = query.get("url") ?? "";
  const promoted = PRODUCT.exec(target.startsWith(`${STORE_PATHS.base}/`) ? target.slice(STORE_PATHS.base.length + 1) : "")?.[1];
  return promoted !== undefined && CATALOG.bySku(promoted) ? { status: 302, headers: { location: target } } : undefined;
}
