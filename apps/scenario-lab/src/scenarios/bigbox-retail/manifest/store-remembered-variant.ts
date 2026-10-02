import type { ScenarioVariant } from "@fluxiq-web-extension/test-contracts";
import { PICKUP_CART_FACTS, REMEMBERED_STORE_FACTS } from "./expected-values.js";

/**
 * The step is already done. The site remembers Millbrook Crossing Supercenter
 * from an earlier visit, so its card in the store picker says "Your store" and
 * offers no Set as my store button for the recorded press. The page is the one
 * the base site shows right after that press reloads it -- same path, same
 * controls -- so a run that sees the step has nothing to do continues with the
 * search, and the cart it must end with is the same.
 */
export const STORE_REMEMBERED: ScenarioVariant = {
  id: "store-remembered",
  description: "The step is already done. The site remembers Millbrook Crossing Supercenter from an earlier visit, so its card in the store picker reads Your store and offers no Set as my store button for the recorded choose-millbrook press to land on. The start page is the page the base site shows right after that press, so a run that notices the store is already chosen continues with the search and builds the same cart.",
  arm: { operation: "remember-pickup-store" },
  expected: {
    pageFacts: [...REMEMBERED_STORE_FACTS],
    finalState: [...PICKUP_CART_FACTS],
  },
};
