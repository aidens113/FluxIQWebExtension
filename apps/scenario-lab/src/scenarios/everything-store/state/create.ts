import { HOUSEHOLD } from "../catalog/index.js";
import type { StoreMode, StoreState } from "./types.js";

/**
 * The account as a run finds it. A returning shopper's cart is never empty:
 * a phone case and a pack of batteries sit in it, newest first, and two things
 * are saved for later, one of them the brand's other kettle. Nothing here
 * depends on the lab seed except the robot check's characters.
 */
export function createStoreState(seed: number, mode: StoreMode = "baseline"): StoreState {
  return {
    challengeSeed: seed,
    mode,
    consent: "pending",
    nudges: { appBanner: "pending", notifications: "pending", dealWheel: "pending", chat: "idle" },
    guard: { softCheck: "pending", searchLoads: [], throttled: 0, flagged: null, robot: { image: 0, wrong: 0, solved: false }, saveGlitch: "armed" },
    cart: [
      { lineId: "L2", sku: HOUSEHOLD.phoneCase.sku, offerId: null, quantity: 1, selected: true },
      { lineId: "L1", sku: HOUSEHOLD.batteries.sku, offerId: null, quantity: 1, selected: true },
    ],
    saved: [
      { lineId: "S2", sku: "B0TWGOOSE9", offerId: null, quantity: 1, selected: true },
      { lineId: "S1", sku: HOUSEHOLD.cloths.sku, offerId: null, quantity: 1, selected: true },
    ],
    nextLine: 3,
    checkout: null,
    orders: [],
    newsletter: "none",
    activity: [],
  };
}
