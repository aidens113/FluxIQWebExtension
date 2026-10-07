import type { ScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { STORE_PATHS } from "../catalog/index.js";
import { restoreClothsExpected } from "./expected.js";

export const restoreClothsWorkflow: ScenarioWorkflow = {
  id: "restore-saved-cloths",
  description: "Transfer the existing saved cloth line into the active cart, preserving every other line.",
  recordingScript: [
    { id: "cloths-notifications", operation: "waitForState", target: "role:dialog:Never miss a deal", timeoutMs: 15_000 },
    { id: "cloths-decline-notifications", operation: "click", target: "role:button:Not now" },
    { id: "cloths-consent", operation: "click", target: "role:button:Accept" },
    { id: "cloths-cart", operation: "navigate", path: STORE_PATHS.cart },
    { id: "cloths-restore-existing", operation: "click", target: '[data-name="Saved Cart Items"] [data-line="S1"] [data-action="move-to-cart"]' },
    { id: "cloths-transfer-settled", operation: "waitForState", target: '[data-name="Active Items"] [data-line="S1"]', timeoutMs: 5000 },
    { id: "extract-restored-cloths", operation: "extract", target: '[data-name="Active Items"] [data-line]', fields: { item: 'a[href*="/dp/"] > span', quantity: '[aria-live="polite"]', price: ":scope > p > span" } },
    { id: "cloths-restored", operation: "checkpoint" },
  ],
  expected: restoreClothsExpected,
};
