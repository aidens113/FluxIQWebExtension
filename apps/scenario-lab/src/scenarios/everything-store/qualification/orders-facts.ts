import type { StoreState } from "../state/index.js";

/**
 * Every order the store has placed, as it holds it: what each ordered, where to,
 * how it was paid and delivered, whether the Plus trial rode along, and the
 * total. Every store page carries it as a readonly fact (`everything-placed-orders`)
 * beside the account and the open checkout, because the confirmation page is
 * the only visible place an order's lines, address, payment and total are
 * written and a run is free to leave it once the order is placed. `[]` with none.
 *
 * Self-contained, because the page's script embeds its source to keep the fact
 * current after each change.
 */
export function placedOrdersFacts(state: StoreState): string {
  return JSON.stringify(state.orders.map((order) => ({
    lines: order.lines.map(({ sku, offerId, quantity, unitCents }) => ({ sku, offerId, quantity, unitCents })),
    addressId: order.addressId, paymentId: order.paymentId, giftCard: order.giftCard, delivery: order.delivery, plusTrial: order.plusTrial, totalCents: order.totalCents,
  })));
}
