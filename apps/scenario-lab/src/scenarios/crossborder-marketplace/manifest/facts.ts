import type { ExpectedFact } from "@fluxiq-web-extension/test-contracts";
import { buildMarkerText } from "../markup/index.js";
import { MARKET_BUILDS } from "../styles/index.js";
import { cartLineText, officialCouponText } from "./answers.js";

const NO_COUPONS = "Store coupons: none collected";

/**
 * The facts the oracle reads. Every subject is a read-only element in the
 * header flyouts or the footer, present on every storefront page, so a run is
 * judged by what it left behind wherever it stopped: the cart flyout's count
 * and first line, the account flyout's store coupons and orders, and the
 * footer's build line. No control the tasks press carries one of these ids.
 */
export const cartCount = (pieces: number): ExpectedFact => ({ id: "cart-count", subject: "mini-cart-count", predicate: "text", value: `Cart (${pieces})` });
export const couponsHeld = (text = NO_COUPONS): ExpectedFact => ({ id: "store-coupons", subject: "store-coupons", predicate: "text", value: text });
export const ordersShipped = (count: number): ExpectedFact => ({ id: "orders-shipped", subject: "orders-summary", predicate: "text", value: `Orders to be shipped (${count})` });
export const buildIs = (build: string): ExpectedFact => ({ id: "build-marker", subject: "build-marker", predicate: "text", value: buildMarkerText(build) });

/** The page a first visit loads: nothing in the cart, no coupons, no orders, the build that ships. */
export const FIRST_VISIT: ExpectedFact[] = [cartCount(0), couponsHeld(), ordersShipped(0), buildIs(MARKET_BUILDS.baseline)];

/** The cart task done: one line, the right listing and options, three of them, the store's coupon held, nothing bought. */
export const HUB_IN_CART: ExpectedFact[] = [
  { id: "cart-line", subject: "mini-cart-line", predicate: "text", value: cartLineText() },
  couponsHeld(officialCouponText()),
];
export const NOTHING_BOUGHT: ExpectedFact[] = [cartCount(3), ordersShipped(0)];

/** The redesigned buy bar has no control with the test id the shipping one carries. */
export const RECORDED_ADD_TO_CART_GONE: ExpectedFact = { id: "recorded-add-to-cart-gone", subject: "add-to-cart", predicate: "exists", value: false };
