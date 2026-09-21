import { isKnownChoice, listingById, skuStock, STORES, type ShipOrigin, type SkuChoice } from "../catalog/index.js";
import { isRegionCode } from "../locale/index.js";
import { createMarketState } from "./create.js";
import { orderNumber, sessionTotals } from "./totals.js";
import { marketModes, type CartLine, type MarketMode, type MarketState, type ShippingMethod } from "./types.js";

const ACTIVITY_LIMIT = 60;
const ORIGINS: readonly ShipOrigin[] = ["China", "Spain", "Poland", "Czech Republic"];

/** Payment methods on file. Only the Visa can pay: the Mastercard has expired and the balance is empty. */
export const PAYMENT_METHODS = {
  "visa-4417": { label: "Visa •••• 4417", usable: true },
  "mc-9021": { label: "Mastercard •••• 9021", usable: false },
  balance: { label: "Farbazaar balance", usable: false },
} as const;

type Payload = Record<string, unknown>;
type Operation = (state: MarketState, payload: Payload) => MarketState;

/**
 * One operation per thing the pages can do, plus the route-level ones the
 * server applies when it serves a page (`page-view`, `search-load`,
 * `search-challenge`, `feed-request`) and `set-mode`, which arms a rendering.
 *
 * `set-mode`, like every arm in the lab, starts the visit over: an armed run's
 * oracle is its own and never a stale success left by the recording. Anything
 * unknown, or a payload the page could not have sent, leaves the state alone,
 * so a page driven out of order cannot invent an outcome.
 */
export function mutateMarketState(state: MarketState, operation: string, payload: unknown): MarketState {
  if (!isRecord(payload)) return state;
  const apply = OPERATIONS[operation];
  if (!apply) return state;
  const next = apply(state, payload);
  return next === state ? state : { ...next, activity: [...next.activity, operation].slice(-ACTIVITY_LIMIT) };
}

const OPERATIONS: Readonly<Record<string, Operation>> = {
  "set-mode": (state, { mode }) => (isMode(mode) ? createMarketState(state.seed, mode) : state),
  "page-view": (state) => ({ ...state, views: state.views + 1 }),
  beacon: (state) => ({ ...state, views: state.views + 1 }),
  consent: (state, { choice }) => (choice === "all" || choice === "essential" ? { ...state, consent: choice } : state),
  welcome: (state, { action }) => {
    if (state.welcome !== "pending") return state;
    if (action === "close") return { ...state, welcome: "closed" };
    if (action === "collect") return { ...state, welcome: "collected", coupons: { ...state.coupons, platform: true } };
    return state;
  },
  notifications: (state, { answer }) => (state.notifications === "pending" && (answer === "later" || answer === "allowed") ? { ...state, notifications: answer } : state),
  chat: (state, { view }) => (view === "pill" || view === "panel" || view === "minimized" ? { ...state, chat: view } : state),
  "flash-deal": (state, { action }) => (action === "close" && state.flashDeal === "pending" ? { ...state, flashDeal: "closed" } : state),
  region: (state, { region }) => (isRegionCode(region) && region !== state.region ? { ...state, region } : state),
  "claim-coupon": claimCoupon,
  "add-to-cart": addToCart,
  "cart-quantity": (state, { lineId, quantity }) => {
    const line = state.cart.find((candidate) => candidate.id === lineId);
    const listing = line ? listingById(line.listingId) : undefined;
    if (!line || !listing || !isQuantity(quantity) || quantity > skuStock(listing, line.choice)) return state;
    return { ...state, cart: state.cart.map((candidate) => (candidate.id === line.id ? { ...candidate, quantity } : candidate)) };
  },
  "cart-remove": (state, { lineId }) => (state.cart.some((line) => line.id === lineId) ? { ...state, cart: state.cart.filter((line) => line.id !== lineId) } : state),
  "buy-now": (state, payload) => {
    const line = readLine(payload, "now");
    return line ? { ...state, checkout: { source: "buy-now", lines: [line], shipping: {}, paymentId: null } } : state;
  },
  "checkout-cart": (state, { lineIds }) => {
    const wanted = Array.isArray(lineIds) ? lineIds.filter((value): value is string => typeof value === "string") : [];
    const lines = state.cart.filter((line) => wanted.includes(line.id));
    return lines.length === 0 ? state : { ...state, checkout: { source: "cart", lines, shipping: {}, paymentId: null } };
  },
  "checkout-shipping": (state, { storeId, method }) => {
    if (!state.checkout || typeof storeId !== "string" || !isShippingMethod(method)) return state;
    if (!state.checkout.lines.some((line) => listingById(line.listingId)?.storeId === storeId)) return state;
    return { ...state, checkout: { ...state.checkout, shipping: { ...state.checkout.shipping, [storeId]: method } } };
  },
  "choose-payment": (state, { methodId }) => {
    if (!state.checkout || typeof methodId !== "string" || !(methodId in PAYMENT_METHODS)) return state;
    if (!PAYMENT_METHODS[methodId as keyof typeof PAYMENT_METHODS].usable) return state;
    return { ...state, checkout: { ...state.checkout, paymentId: methodId } };
  },
  "place-order": placeOrder,
  "search-load": (state) => ({ ...state, views: state.views + 1, search: { ...state.search, loadsSinceCheck: state.search.loadsSinceCheck + 1 } }),
  "search-challenge": (state) => ({ ...state, views: state.views + 1, search: { ...state.search, challenged: true } }),
  "verify-human": (state) => (state.search.challenged ? { ...state, search: { loadsSinceCheck: 0, challenged: false, checksPassed: state.search.checksPassed + 1 } } : state),
  "feed-request": (state) => ({ ...state, feed: { requests: state.feed.requests + 1 } }),
};

/** The first press of a store's claim button always fails ("Network busy"); the second collects the coupon. */
function claimCoupon(state: MarketState, { storeId }: Payload): MarketState {
  if (typeof storeId !== "string" || !isStoreWithCoupon(storeId) || state.coupons.stores.includes(storeId)) return state;
  const attempts = (state.coupons.attempts[storeId] ?? 0) + 1;
  const collected = attempts >= 2;
  return {
    ...state,
    coupons: { ...state.coupons, attempts: { ...state.coupons.attempts, [storeId]: attempts }, stores: collected ? [...state.coupons.stores, storeId] : state.coupons.stores },
  };
}

/** Adds a line, or tops up the identical one already in the cart; refuses anything past the option set's stock. */
function addToCart(state: MarketState, payload: Payload): MarketState {
  const line = readLine(payload, `line-${state.nextLine}`);
  if (!line) return state;
  const listing = listingById(line.listingId)!;
  const same = state.cart.find((candidate) => candidate.listingId === line.listingId && sameChoice(candidate.choice, line.choice));
  const quantity = (same?.quantity ?? 0) + line.quantity;
  if (quantity > skuStock(listing, line.choice)) return state;
  if (same) return { ...state, cart: state.cart.map((candidate) => (candidate === same ? { ...candidate, quantity } : candidate)) };
  return { ...state, cart: [...state.cart, line], nextLine: state.nextLine + 1 };
}

/**
 * Places the checkout's order with the Visa it names. A filled-in hidden field
 * -- the fax box no person can see -- marks the submission as automated: the
 * order is held for review, no payment is taken, and nothing leaves the cart.
 */
function placeOrder(state: MarketState, { fax }: Payload): MarketState {
  const session = state.checkout;
  if (!session || session.paymentId === null) return state;
  const number = orderNumber(state.seed, state.orders.length);
  const totals = sessionTotals(session.lines, session.shipping, state.coupons.stores);
  const flagged = typeof fax === "string" && fax.trim() !== "";
  const order = { number, lines: session.lines, totals, status: flagged ? "review" as const : "paid" as const, paymentId: session.paymentId, region: state.region };
  if (flagged) return { ...state, checkout: null, orders: [...state.orders, order] };
  const usedCoupons = new Set(session.lines.map((line) => listingById(line.listingId)?.storeId));
  const bought = new Set(session.source === "cart" ? session.lines.map((line) => line.id) : []);
  return {
    ...state,
    checkout: null,
    orders: [...state.orders, order],
    cart: state.cart.filter((line) => !bought.has(line.id)),
    coupons: { ...state.coupons, stores: totals.discountCents > 0 ? state.coupons.stores.filter((storeId) => !usedCoupons.has(storeId)) : state.coupons.stores },
  };
}

/** A cart line from a page payload, or `undefined` for a listing, option set or quantity the page could not have sent. */
function readLine(payload: Payload, lineId: string): CartLine | undefined {
  const listing = typeof payload.listingId === "string" ? listingById(payload.listingId) : undefined;
  if (!listing || !isQuantity(payload.quantity)) return undefined;
  const origin = ORIGINS.find((candidate) => candidate === payload.origin);
  if (typeof payload.color !== "string" || typeof payload.spec !== "string" || origin === undefined) return undefined;
  const choice: SkuChoice = { color: payload.color, spec: payload.spec, origin };
  if (!isKnownChoice(listing, choice) || payload.quantity > skuStock(listing, choice)) return undefined;
  return { id: lineId, listingId: listing.id, choice, quantity: payload.quantity };
}

function sameChoice(left: SkuChoice, right: SkuChoice): boolean {
  return left.color === right.color && left.spec === right.spec && left.origin === right.origin;
}

function isStoreWithCoupon(storeId: string): boolean {
  return STORES.get(storeId)?.coupon !== undefined;
}

function isQuantity(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 99;
}

function isShippingMethod(value: unknown): value is ShippingMethod {
  return value === "standard" || value === "express";
}

function isMode(value: unknown): value is MarketMode {
  return typeof value === "string" && (marketModes as readonly string[]).includes(value);
}

function isRecord(value: unknown): value is Payload {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
