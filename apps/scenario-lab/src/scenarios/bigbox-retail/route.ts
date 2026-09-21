import type { RenderContext, ScenarioRouteRequest, ScenarioRouteResponse } from "../../types.js";
import { findProduct, PRODUCTS } from "./catalog/index.js";
import { productImageSvg } from "./listing/index.js";
import {
  PAYMENT_FRAME_CSP, pickupSlotsFragment, renderCartPage, renderCheckoutPage, renderOrderPage, renderPaymentFrame, renderProductPage,
  renderRobotCheckPage, renderSearchPage, renderSellerPage, renderWeeklyAdPage,
} from "./pages/index.js";
import { miniCartMarkup } from "./shell/index.js";
import { bigboxClasses, elementId } from "./theme/index.js";
import { readSearchState } from "./search/index.js";
import { challengesNextLoad } from "./state/index.js";
import type { BigboxState } from "./types.js";

const PRODUCT_PAGE = /^ip\/[a-z0-9-]+\/(\d{9})$/u;
const ORDER_PAGE = /^order\/(\d{7}-\d{5})$/u;
const SELLER_PAGE = /^seller\/([a-z0-9-]+)$/u;
const PRODUCT_IMAGE = /^img\/(\d{9})\.svg$/u;
/** How long the rate limiter asks the checkout to wait before asking again, in seconds. */
const RETRY_AFTER_SECONDS = 2;

const html = (body: string, mutation?: ScenarioRouteResponse["mutation"]): ScenarioRouteResponse => ({ status: 200, body, ...(mutation ? { mutation } : {}) });
const sellerSlug = (seller: string) => seller.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/-$/u, "");

/**
 * Every document the site serves besides its home page. A results page counts
 * itself (`search-view`) and is replaced by the bot check on the load that
 * trips it and on every load after until the check is passed. The pickup-time
 * list counts itself (`slots-fetch`) and refuses its first request with a 429
 * and a Retry-After. The cart forgets a pending Buy now item. Anything else
 * is a 404.
 */
export function routeBigbox(state: BigboxState, request: ScenarioRouteRequest, context: RenderContext): ScenarioRouteResponse | undefined {
  const { subpath, query } = request;
  if (subpath === "search") {
    const reference = elementId(context.seed, `robot-${state.robot.searchLoads}`);
    if (state.robot.status === "challenged") return html(renderRobotCheckPage(state, context, reference));
    if (challengesNextLoad(state)) return html(renderRobotCheckPage(state, context, reference), { operation: "search-view" });
    return html(renderSearchPage(state, context, readSearchState(query)), { operation: "search-view" });
  }
  const productId = PRODUCT_PAGE.exec(subpath)?.[1];
  if (productId !== undefined) {
    const found = findProduct(productId, query.get("variant") ?? undefined) ?? findProduct(productId);
    return found ? html(renderProductPage(state, context, found.product, found.variant)) : undefined;
  }
  if (subpath === "cart") return html(renderCartPage(state, context), { operation: "clear-express" });
  if (subpath === "checkout") return html(renderCheckoutPage(state, context));
  if (subpath === "checkout/slots") {
    if (state.slotFetches === 0) return { status: 429, headers: { "content-type": "text/plain; charset=utf-8", "retry-after": String(RETRY_AFTER_SECONDS) }, body: "Too many requests", mutation: { operation: "slots-fetch" } };
    return html(pickupSlotsFragment(state.storeId, bigboxClasses(state.mode, context.seed)), { operation: "slots-fetch" });
  }
  if (subpath === "checkout/payment-frame") return { status: 200, headers: { "content-security-policy": PAYMENT_FRAME_CSP }, body: renderPaymentFrame() };
  if (subpath === "mini-cart") return html(miniCartMarkup(state, bigboxClasses(state.mode, context.seed)));
  if (subpath === "weekly-ad") return html(renderWeeklyAdPage(state, context));
  const orderNumber = ORDER_PAGE.exec(subpath)?.[1];
  const order = orderNumber === undefined ? undefined : state.orders.find((candidate) => candidate.number === orderNumber);
  if (order) return html(renderOrderPage(state, context, order));
  const slug = SELLER_PAGE.exec(subpath)?.[1];
  const seller = slug === undefined ? undefined : PRODUCTS.map((product) => product.seller).find((name) => sellerSlug(name) === slug);
  if (seller) return html(renderSellerPage(state, context, seller));
  const imageId = PRODUCT_IMAGE.exec(subpath)?.[1];
  const imaged = imageId === undefined ? undefined : findProduct(imageId);
  if (imaged) return { status: 200, headers: { "content-type": "image/svg+xml" }, body: productImageSvg(imaged.product) };
  return undefined;
}
