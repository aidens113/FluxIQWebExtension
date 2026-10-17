import type { StoreState } from "../state/index.js";

/**
 * The open checkout as the store holds it, or `null` with none open: what it
 * would order, where to, how it is paid and delivered, and whether the Plus
 * trial is ticked. Every store page carries it as a readonly fact
 * (`everything-checkout-session`), so a run that stops on any page short of
 * placing the order is judged on the checkout it left behind.
 *
 * Self-contained, because the page's script embeds its source to keep the
 * fact current after each change.
 */
export function checkoutSessionFacts(state: StoreState): string {
  const session = state.checkout;
  if (session === null) return "null";
  const lines = session.lines.map(({ sku, offerId, quantity, unitCents }) => ({ sku, offerId, quantity, unitCents }));
  return JSON.stringify({ pipeline: session.pipeline, lines, addressId: session.addressId, paymentId: session.paymentId, giftCard: session.giftCard, delivery: session.delivery, plusTrial: session.plusTrial });
}
