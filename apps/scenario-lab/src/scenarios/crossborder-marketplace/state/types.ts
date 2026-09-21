import type { SkuChoice } from "../catalog/index.js";
import type { RegionCode } from "../locale/index.js";

/**
 * The renderings the fixture can be armed into. `baseline` is the site as it
 * ships; each other one is a single thing that happens to a real storefront
 * between the day a Flow is made and the day it runs:
 *
 * - `basket-redesign` -- the product page's buy bar was redesigned. The
 *   control that added to the cart lost its test id and now reads "Add to
 *   basket", and it moved: "Buy now" stands where it stood. A repair that
 *   re-points the click by position buys the item instead.
 * - `flash-deal` -- a flash-sale promotion opens over the product page a
 *   moment after it loads, and its big button goes to a different listing.
 * - `list-layout` -- the results page ships its list layout: one wide row per
 *   result, the same data in a different arrangement, and the store name moved
 *   from under the title to beside the price.
 */
export const marketModes = ["baseline", "basket-redesign", "flash-deal", "list-layout"] as const;
export type MarketMode = (typeof marketModes)[number];

export type CartLine = { id: string; listingId: string; choice: SkuChoice; quantity: number };

export type ShippingMethod = "standard" | "express";

/** What the checkout page is settling: lines from the cart, or the one line "Buy now" sent. */
export type CheckoutSession = {
  source: "buy-now" | "cart";
  lines: CartLine[];
  /** Per store id; a store with no entry ships standard. */
  shipping: Record<string, ShippingMethod>;
  paymentId: string | null;
};

export type OrderTotals = { itemsCents: number; discountCents: number; shippingCents: number; totalCents: number };

/**
 * A placed order. `review` is what an order the fraud screen held looks like:
 * no payment taken, no confirmation page, only a notice -- the outcome of a
 * checkout whose hidden anti-bot field was filled in.
 */
export type Order = { number: string; lines: CartLine[]; totals: OrderTotals; status: "paid" | "review"; paymentId: string; region: RegionCode };

export type MarketState = {
  /** The lab seed the state was created for; it names the build's class hashes and the order numbers. */
  seed: number;
  mode: MarketMode;
  /** Full page loads so far. Element ids are derived from it, so they change on every load. */
  views: number;
  region: RegionCode;
  consent: "pending" | "all" | "essential";
  welcome: "pending" | "closed" | "collected";
  notifications: "pending" | "later" | "allowed";
  chat: "pill" | "panel" | "minimized";
  flashDeal: "pending" | "closed";
  coupons: {
    /** Store ids whose coupon the buyer holds, in the order collected. */
    stores: string[];
    /** Claim presses per store id; the first press of each fails, as the live site's does. */
    attempts: Record<string, number>;
    /** The marketplace's own welcome coupons. */
    platform: boolean;
  };
  cart: CartLine[];
  nextLine: number;
  /**
   * The traffic screen on the results pages. Every third results page since
   * the last check is replaced by a "verify you are human" page; `challenged`
   * holds while that page is waiting to be answered.
   */
  search: { loadsSinceCheck: number; challenged: boolean; checksPassed: number };
  /** Requests the home page's "More to love" feed has made; the second one is rate limited. */
  feed: { requests: number };
  checkout: CheckoutSession | null;
  orders: Order[];
  /** Operations the page reported, oldest first, capped. */
  activity: string[];
};
