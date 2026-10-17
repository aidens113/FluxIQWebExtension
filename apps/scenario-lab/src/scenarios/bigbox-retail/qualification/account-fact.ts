import type { ExpectedFact } from "@fluxiq-web-extension/test-contracts";
import type { CartLine } from "../types.js";

/**
 * The shopper's whole account as the readonly oracle every page carries
 * (`facts.ts`, under the `bigbox-soap-account` test id), written out by hand:
 * the store, both lists line by line, the next line number, the checkout's
 * state, and how many orders were placed or refused. A run that changed
 * anything the task did not ask for changes this text.
 */
export function accountFact(id: string, account: {
  storeId: string;
  cart: readonly CartLine[];
  saved: readonly CartLine[];
  nextLine: number;
  checkout: "account-wall" | "guest";
  expressOpen: boolean;
  orderCount: number;
  flaggedOrders: number;
}): ExpectedFact {
  const line = ({ lineId, productId, sku, qty, fulfilment }: CartLine) => ({ lineId, productId, sku, qty, fulfilment });
  const value = JSON.stringify({ ...account, cart: account.cart.map(line), saved: account.saved.map(line) });
  return { id, subject: "bigbox-soap-account", predicate: "text", value };
}
