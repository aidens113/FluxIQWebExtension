import type { BigboxState, CartLine } from "../types.js";

/** Readonly synthetic account oracle, also serialized into the document's mutation observer. */
export function soapQuantityAccountFacts(state: BigboxState): string {
  const line = ({ lineId, productId, sku, qty, fulfilment }: CartLine) => ({ lineId, productId, sku, qty, fulfilment });
  return JSON.stringify({ storeId: state.storeId, cart: state.cart.map(line), saved: state.saved.map(line), nextLine: state.nextLine, checkout: state.checkout, expressOpen: state.express !== null, orderCount: state.orders.length, flaggedOrders: state.flaggedOrders });
}
