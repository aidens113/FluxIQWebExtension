import { cartTotals, orderNumber, pickupSlots } from "../cart/index.js";
import { text } from "./payload-fields.js";
import type { BigboxState } from "../types.js";

/** Refusals the checkout prints, word for word. */
export const CHECKOUT_ERRORS = {
  notGuest: "Sign in or continue as a guest to check out.",
  empty: "Your cart is empty.",
  flagged: "We couldn't place your order right now. Please try again later. (Error VR-417)",
  contact: "Enter your first name, last name, email address and phone number.",
  slot: "Choose an available pickup time.",
  card: "Enter your card details, or choose to pay at pickup.",
  noAccount: "We couldn't find an account for that email address. Check it, or continue as a guest.",
} as const;

/**
 * Places the order the checkout sent, or records why it was refused.
 *
 * `company_website` is the form's hidden field: positioned off-screen, out of
 * the tab order, and labelled only for a screen reader nobody uses to shop
 * here. A person never fills it, so an order that arrives with it filled is
 * refused with the same vague error a real store gives a bot, and nothing is
 * placed. An order that passes takes the express item when there is one and
 * the cart otherwise, and numbers itself by how many orders came before it.
 */
export function placeOrder(state: BigboxState, payload: Record<string, unknown>): BigboxState {
  const refuse = (checkoutError: string) => ({ ...state, checkoutError });
  if (state.checkout !== "guest") return refuse(CHECKOUT_ERRORS.notGuest);
  const lines = state.express ? [state.express] : state.cart;
  if (lines.length === 0) return refuse(CHECKOUT_ERRORS.empty);
  if (text(payload, "company_website") !== "") return { ...refuse(CHECKOUT_ERRORS.flagged), flaggedOrders: state.flaggedOrders + 1 };
  const [firstName, lastName, email, phone] = ["firstName", "lastName", "email", "phone"].map((key) => text(payload, key));
  if (!firstName || !lastName || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(email ?? "") || (phone ?? "").replace(/\D/gu, "").length < 10) return refuse(CHECKOUT_ERRORS.contact);
  const slotId = text(payload, "slotId");
  const slot = pickupSlots(state.storeId).find((candidate) => candidate.id === slotId && !candidate.full);
  if (lines.some((line) => line.fulfilment === "pickup") && !slot) return refuse(CHECKOUT_ERRORS.slot);
  const payment = text(payload, "payment") === "pickup" ? "pickup" : "card";
  if (payment === "card" && !/^tok_[a-z0-9]{8,}$/u.test(text(payload, "cardToken"))) return refuse(CHECKOUT_ERRORS.card);
  const totals = cartTotals(lines, state.storeId);
  const order = { number: orderNumber(state.orders.length), storeId: state.storeId, slotId: slot?.id ?? "", lines, firstName: firstName!, payment, subtotalCents: totals.subtotalCents, taxCents: totals.taxCents } as const;
  return {
    ...state,
    orders: [...state.orders, { ...order, lines: [...order.lines] }],
    cart: state.express ? state.cart : [],
    express: null,
    checkoutError: "",
  };
}
