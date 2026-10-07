import type { CartLine, StoreState } from "../state/index.js";

/** Full line identities and forbidden account changes, without order/contact/user contents. */
export function restoreClothsAccountFacts(state: StoreState): string {
  const line = ({ lineId, sku, offerId, quantity, selected }: CartLine) => ({ lineId, sku, offerId, quantity, selected });
  return JSON.stringify({ cart: state.cart.map(line), saved: state.saved.map(line), nextLine: state.nextLine, checkoutOpen: state.checkout !== null, orderCount: state.orders.length, newsletter: state.newsletter });
}
