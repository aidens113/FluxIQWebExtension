import type { ScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { CLASSIFIEDS_ROOT } from "../root.js";
import { soldSavesExpected } from "./expected.js";

export const soldSavesWorkflow: ScenarioWorkflow = {
  id: "remove-sold-saves",
  description: "Unsave the sold listing while keeping the available listing and leaving hidden/contact state unchanged.",
  recordingScript: [
    { id: "sold-saves-consent", operation: "click", target: "role:button:Allow all cookies" },
    { id: "sold-saves-notifications", operation: "waitForState", target: "role:button:Not now", timeoutMs: 6000 },
    { id: "sold-saves-decline-notifications", operation: "click", target: "role:button:Not now" },
    { id: "sold-saves-open", operation: "navigate", path: `${CLASSIFIEDS_ROOT}saved/` },
    { id: "sold-saves-options", operation: "click", target: "role:button:More options for Rattan armchair" },
    { id: "sold-saves-remove", operation: "click", target: "role:menuitem:Remove from saved items" },
    { id: "sold-saves-settled", operation: "waitForState", target: 'main ul:not(:has(li:has-text("Sold")))', timeoutMs: 5000 },
    { id: "extract-available-saves", operation: "extract", target: "main li", fields: { title: "a", price: "a + div > span:first-child", status: "a + div + div > span:first-child" } },
    { id: "sold-saves-cleaned", operation: "checkpoint" },
  ],
  expected: soldSavesExpected,
};
