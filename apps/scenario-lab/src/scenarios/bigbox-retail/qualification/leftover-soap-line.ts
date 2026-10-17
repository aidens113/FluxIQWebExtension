import type { CartLine } from "../types.js";

/** The bottle of dish soap a returning shopper left in the cart (`state/initial-state.ts`), which every task keeps unless it says otherwise. */
export const LEFTOVER_SOAP_LINE: CartLine = Object.freeze({ lineId: "L1", productId: "418832007", sku: "5530601", qty: 1, fulfilment: "pickup" });
