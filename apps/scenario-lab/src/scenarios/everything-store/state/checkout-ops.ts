import { CATALOG, HOUSEHOLD } from "../catalog/index.js";
import { ACCOUNT } from "./account.js";
import { withActivity } from "./activity.js";
import { linePrice } from "./line-price.js";
import { orderId } from "./order-id.js";
import { orderTotals } from "./order-totals.js";
import type { AddressId, CheckoutSession, DeliveryOptionId, OrderLine, PaymentId, StoreState } from "./types.js";

function opened(pipeline: CheckoutSession["pipeline"], lines: OrderLine[]): CheckoutSession {
  return { pipeline, lines, addressId: "home", paymentId: "visa-4417", giftCard: false, delivery: "brightaisle-day", plusTrial: true };
}

function priced(sku: string, offerId: string | null, quantity: number): OrderLine | undefined {
  const unitCents = linePrice(sku, offerId);
  return unitCents === undefined ? undefined : { sku, offerId, quantity, unitCents };
}

function startCheckout(state: StoreState, payload: Record<string, unknown>): StoreState {
  if (payload.pipeline === "cart") {
    const lines = state.cart.filter((line) => line.selected).map((line) => priced(line.sku, line.offerId, line.quantity));
    if (lines.length === 0 || lines.some((line) => line === undefined)) return state;
    return withActivity({ ...state, checkout: opened("cart", lines as OrderLine[]) }, "checkout from cart");
  }
  if (payload.pipeline !== "buy-now" || typeof payload.sku !== "string") return state;
  const quantity = typeof payload.quantity === "number" && Number.isInteger(payload.quantity) && payload.quantity >= 1 && payload.quantity <= 10 ? payload.quantity : undefined;
  const offerId = typeof payload.offerId === "string" ? payload.offerId : null;
  const line = quantity === undefined ? undefined : priced(payload.sku, offerId, quantity);
  if (!line || quantity === undefined) return state;
  const plan = payload.protection === true && CATALOG.bySku(payload.sku)?.kind === "kettle" ? priced(HOUSEHOLD.protectionPlan.sku, null, quantity) : undefined;
  return withActivity({ ...state, checkout: opened("buy-now", plan ? [line, plan] : [line]) }, "checkout by buy now");
}

/** Places the open checkout's order. From the cart, the ordered lines leave the cart; Buy Now leaves the cart as it was. */
function placeOrder(state: StoreState): StoreState {
  const session = state.checkout;
  if (!session || session.lines.length === 0) return state;
  const order = { ...session, orderId: orderId(state.challengeSeed, state.orders.length), totalCents: orderTotals(session).totalCents };
  const cart = session.pipeline === "cart" ? state.cart.filter((line) => !line.selected) : state.cart;
  return withActivity({ ...state, cart, checkout: null, orders: [...state.orders, order] }, "placed order " + order.orderId);
}

function isAddress(value: unknown): value is AddressId {
  return typeof value === "string" && Object.hasOwn(ACCOUNT.addresses, value);
}

function isPayment(value: unknown): value is PaymentId {
  return typeof value === "string" && Object.hasOwn(ACCOUNT.payments, value);
}

function isDelivery(value: unknown): value is DeliveryOptionId {
  return typeof value === "string" && Object.hasOwn(ACCOUNT.delivery, value);
}

/**
 * Checkout's operations: opening it from the cart or by Buy Now, each choice
 * on the page, and placing the order. A choice with no checkout open, or a
 * value the page could not have sent, changes nothing. Returns `undefined`
 * for an operation that is not checkout's.
 */
export function applyCheckoutOperation(state: StoreState, operation: string, payload: Record<string, unknown>): StoreState | undefined {
  const session = state.checkout;
  switch (operation) {
    case "start-checkout":
      return startCheckout(state, payload);
    case "set-address":
      return session && isAddress(payload.addressId) ? { ...state, checkout: { ...session, addressId: payload.addressId } } : state;
    case "set-payment":
      return session && isPayment(payload.paymentId) ? { ...state, checkout: { ...session, paymentId: payload.paymentId } } : state;
    case "set-gift-card":
      return session && typeof payload.apply === "boolean" ? { ...state, checkout: { ...session, giftCard: payload.apply } } : state;
    case "set-delivery":
      return session && isDelivery(payload.option) ? { ...state, checkout: { ...session, delivery: payload.option } } : state;
    case "set-plus-trial":
      return session && typeof payload.enabled === "boolean" ? { ...state, checkout: { ...session, plusTrial: payload.enabled } } : state;
    case "place-order":
      return placeOrder(state);
    default:
      return undefined;
  }
}
