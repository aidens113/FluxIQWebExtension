import type { ScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { MARKET_ROOT, WATCHLIST_SUBPATH } from "../paths.js";
import { accessoryCleanupExpected } from "./expected.js";

export const accessoryCleanupWorkflow: ScenarioWorkflow = {
  id: "remove-watched-accessories",
  description: "Remove watched accessories while preserving watched cameras and read the resulting watchlist.",
  recordingScript: [
    { id: "cleanup-promotion", operation: "waitForState", target: "role:dialog:Bid on the go", timeoutMs: 15_000 },
    { id: "cleanup-dismiss-promotion", operation: "click", target: 'div[role="dialog"] span:text-is("Not now")' },
    { id: "cleanup-greeting", operation: "waitForState", target: "#hal-greeting", timeoutMs: 15_000 },
    { id: "cleanup-close-greeting", operation: "click", target: "#hal-greeting .hal-close" },
    { id: "cleanup-consent", operation: "click", target: "role:button:Accept all" },
    { id: "cleanup-open-watchlist", operation: "navigate", path: `${MARKET_ROOT}${WATCHLIST_SUBPATH}` },
    { id: "cleanup-remove-lens", operation: "click", target: 'li[data-itemid="176619903325"] div:text-is("Remove")' },
    { id: "cleanup-removal-settled", operation: "waitForState", target: 'ol[aria-label="Watchlist items"]:not(:has(li[data-itemid="176619903325"]))', timeoutMs: 5000 },
    { id: "cleanup-read-account", operation: "navigate", path: `${MARKET_ROOT}${WATCHLIST_SUBPATH}` },
    { id: "extract-accessory-cleanup", operation: "extract", target: 'ol[aria-label="Watchlist items"] > li', fields: { title: ":scope > div > a", price: ":scope > div > div:nth-child(2) > span:first-child" } },
    { id: "cleanup-complete", operation: "checkpoint" },
  ],
  expected: accessoryCleanupExpected,
};
