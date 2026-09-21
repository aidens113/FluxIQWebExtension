import type { ScenarioStep } from "@fluxiq-web-extension/test-contracts";
import { VOLTBAY_OFFICIAL_ID } from "../catalog/index.js";
import { itemHref } from "../markup/index.js";
import { marketClasses } from "../styles/index.js";
import { CART_QUANTITY, MARKET_SEED, ORDER_QUANTITY } from "./answers.js";

/**
 * The honest scripts: what a careful person does, step by step, on the site
 * as it ships. Every interruption is waited for and answered in the order it
 * arrives, because a click aimed at a control under an interruption lands on
 * the interruption. Nothing here is a shortcut the page does not offer a
 * person: targets are visible text, a `title`, a link's address, or the build's
 * own class hashes for the canonical seed -- the only names the markup has --
 * and the one test id is the one the shipping buy bar carries.
 */
const c = marketClasses(MARKET_SEED, "baseline");

/** A rating bar at 4.5 stars or more: the bar's width is the only place a card states its rating as markup. */
const RATED_45_OR_MORE = [90, 92, 94, 96, 98, 100].map((width) => `[style="width:${width}%"]`).join(",");

/** Close the welcome coupons when they arrive, then answer the consent banner they were covering. */
const ARRIVE: ScenarioStep[] = [
  { id: "welcome-arrives", operation: "waitForState", target: 'text="Welcome back, Mara!"', timeoutMs: 8000 },
  { id: "dismiss-welcome", operation: "click", target: 'text="No thanks"' },
  { id: "accept-cookies", operation: "click", target: 'text="Accept all"' },
  { id: "type-search", operation: "type", target: 'input[name="q"]', value: "usb c hub" },
  { id: "submit-search", operation: "press", target: 'input[name="q"]', value: "Enter" },
];

/** Open the official listing -- it opens in a new tab -- and minimise the chat that sits over its buy bar. */
const OPEN_OFFICIAL_LISTING: ScenarioStep[] = [
  { id: "results-drawn", operation: "waitForState", target: 'text="Voltbay Official Store"', timeoutMs: 6000 },
  { id: "open-listing", operation: "click", target: `a[href="${itemHref(VOLTBAY_OFFICIAL_ID)}"] >> nth=1` },
  { id: "listing-tab", operation: "switchTab", path: itemHref(VOLTBAY_OFFICIAL_ID), timeoutMs: 8000 },
  { id: "chat-arrives", operation: "waitForState", target: '[title="Minimize chat"] >> nth=0', timeoutMs: 6000 },
  { id: "minimize-chat", operation: "click", target: '[title="Minimize chat"] >> nth=0' },
];

/**
 * Space Grey is already chosen, and pressing it again would clear it; only the
 * other two groups change. "Spain" is named inside the option groups because
 * the header's region picker also offers a Spain, in its own shadow root.
 */
const CHOOSE_OPTIONS = (quantity: number): ScenarioStep[] => [
  { id: "choose-7-in-1", operation: "click", target: 'text="7-in-1"' },
  { id: "choose-spain", operation: "click", target: `.${c.skuGroup} >> text="Spain"` },
  { id: "set-quantity", operation: "type", target: `.${c.qtyInput}`, value: String(quantity) },
];

/** The coupon's first claim always fails; the second collects it. */
const COLLECT_COUPON: ScenarioStep[] = [
  { id: "claim-coupon", operation: "click", target: 'text="Get coupons"' },
  { id: "claim-refused", operation: "waitForState", target: 'text="Network busy, please try again"', timeoutMs: 5000 },
  { id: "claim-again", operation: "click", target: 'text="Get coupons"' },
  { id: "coupon-collected", operation: "waitForState", target: 'text="Collected"', timeoutMs: 5000 },
];

export const CART_SCRIPT: ScenarioStep[] = [
  ...ARRIVE,
  ...OPEN_OFFICIAL_LISTING,
  ...CHOOSE_OPTIONS(CART_QUANTITY),
  ...COLLECT_COUPON,
  { id: "add-to-cart", operation: "click", target: "testid:add-to-cart" },
  { id: "added", operation: "waitForState", target: 'text="Added to cart!"', timeoutMs: 5000 },
  { id: "in-cart", operation: "checkpoint" },
];

/**
 * Narrow the search with the site's own filters -- Spain, free shipping, four
 * stars and up -- answering the notification prompt that covers them and the
 * traffic check the third results page brings, then read the non-sponsored
 * cards rated 4.5 or more. Narrowed, the results fit on one page and repeat
 * nothing, which is why the filters are the way a person takes.
 */
export const SPAIN_HUBS_SCRIPT: ScenarioStep[] = [
  ...ARRIVE,
  { id: "prompt-arrives", operation: "waitForState", target: 'text="Never miss a price drop"', timeoutMs: 8000 },
  { id: "decline-notifications", operation: "click", target: 'text="Not now"' },
  { id: "only-spain", operation: "click", target: `.${c.sidebar} >> text="Spain"` },
  { id: "spain-listed", operation: "waitForState", target: `.${c.chips} >> text="Spain ×"`, timeoutMs: 6000 },
  { id: "only-free-shipping", operation: "click", target: `.${c.sidebar} >> text="Free shipping"` },
  { id: "traffic-check", operation: "waitForState", target: `text="I'm not a robot"`, timeoutMs: 6000 },
  { id: "pass-check", operation: "click", target: `text="I'm not a robot"` },
  { id: "free-listed", operation: "waitForState", target: `.${c.chips} >> text="Free shipping ×"`, timeoutMs: 8000 },
  { id: "only-four-stars", operation: "click", target: `.${c.sidebar} >> text="4★ & up"` },
  { id: "stars-listed", operation: "waitForState", target: `.${c.chips} >> text="4★ & up ×"`, timeoutMs: 6000 },
  { id: "first-cards", operation: "waitForState", target: `.${c.grid} > .${c.card} >> nth=0`, timeoutMs: 4000 },
  { id: "scroll-results", operation: "scroll", value: 2400 },
  { id: "last-cards", operation: "waitForState", target: `.${c.grid} > .${c.card} >> nth=18`, timeoutMs: 6000 },
  {
    id: "extract-spain-hubs",
    operation: "extract",
    target: `.${c.grid} > .${c.card}:not(:has(.${c.adTag})):has(.${c.starsFill}:is(${RATED_45_OR_MORE}))`,
    fields: { title: `.${c.cardTitle}`, store: `.${c.storeName}`, price: `.${c.price}`, rating: `.${c.ratingValue}` },
  },
  { id: "spain-hubs-read", operation: "checkpoint" },
];

/** Buy two through "Buy now", pay with the saved Visa in the payment frame, and read the confirmation. */
export const ORDER_SCRIPT: ScenarioStep[] = [
  ...ARRIVE,
  ...OPEN_OFFICIAL_LISTING,
  ...CHOOSE_OPTIONS(ORDER_QUANTITY),
  ...COLLECT_COUPON,
  { id: "buy-now", operation: "click", target: 'text="Buy now"' },
  { id: "checkout-open", operation: "waitForState", target: 'iframe[title="Payment methods"]', timeoutMs: 8000 },
  { id: "choose-visa", operation: "click", target: 'frame:Payment methods/text="Visa •••• 4417"' },
  { id: "visa-chosen", operation: "waitForState", target: `.${c.cartSummary} >> text="Visa •••• 4417"`, timeoutMs: 5000 },
  { id: "place-order", operation: "click", target: 'text="Place order"' },
  { id: "order-confirmed", operation: "waitForState", target: 'text="Payment successful! Thank you for your order."', timeoutMs: 10000 },
  {
    id: "extract-order",
    operation: "extract",
    target: `.${c.orderCard}`,
    fields: {
      order: `.${c.orderMeta} span`,
      item: `.${c.orderLine} > div:first-child > div:first-child`,
      options: `.${c.orderLine} .${c.stockNote}`,
      quantity: `.${c.orderLine} b`,
      total: `.${c.summaryTotal} > span:last-child`,
    },
  },
  { id: "order-read", operation: "checkpoint" },
];
