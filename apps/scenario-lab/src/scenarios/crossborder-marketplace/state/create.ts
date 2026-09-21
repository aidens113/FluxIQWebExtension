import type { MarketMode, MarketState } from "./types.js";

/**
 * A first visit: signed in (the buyer is automating their own account), no
 * consent answered, every promotion still waiting to be shown, an empty cart,
 * and the traffic screen at rest. The seed reaches only what a build or an
 * order sequence would: class hashes, element ids and order numbers.
 */
export function createMarketState(seed: number, mode: MarketMode = "baseline"): MarketState {
  return {
    seed,
    mode,
    views: 0,
    region: "DE",
    consent: "pending",
    welcome: "pending",
    notifications: "pending",
    chat: "pill",
    flashDeal: "pending",
    coupons: { stores: [], attempts: {}, platform: false },
    cart: [],
    nextLine: 1,
    search: { loadsSinceCheck: 0, challenged: false, checksPassed: 0 },
    feed: { requests: 0 },
    checkout: null,
    orders: [],
    activity: [],
  };
}
