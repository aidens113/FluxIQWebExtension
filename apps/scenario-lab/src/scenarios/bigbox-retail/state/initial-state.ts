import { HOME_STORE_ID } from "../catalog/index.js";
import type { BigboxMode, BigboxState } from "../types.js";

/**
 * A returning shopper: nothing answered yet, the home store chosen, and one
 * thing left in the cart from the last visit -- a bottle of dish soap the
 * cart workflow must keep and the order workflow must not buy.
 */
export function createBigboxState(mode: BigboxMode = "baseline"): BigboxState {
  return {
    mode,
    consent: "pending",
    promo: "pending",
    flaggedSignups: 0,
    chatCard: "pending",
    storeId: HOME_STORE_ID,
    cart: [{ lineId: "L1", productId: "418832007", sku: "5530601", qty: 1, fulfilment: "pickup" }],
    saved: [],
    nextLine: 2,
    robot: { searchLoads: 0, status: "idle", clearedBy: "" },
    slotFetches: 0,
    checkout: "account-wall",
    checkoutError: "",
    express: null,
    orders: [],
    flaggedOrders: 0,
    activity: [],
  };
}
