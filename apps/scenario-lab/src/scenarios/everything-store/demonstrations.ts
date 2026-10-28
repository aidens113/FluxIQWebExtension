import type { ScenarioDemonstration, ScenarioStep } from "@fluxiq-web-extension/test-contracts";
import { insertAfterStep } from "../insert-after-step.js";
import { COUPON_EARBUDS_WORKFLOW } from "./workflows/index.js";

/** The pager's page-two link, which is on every results page of this search and carries the page's own filters in its address. */
const PAGE_TWO = 'a[aria-label="Go to page 2"]';

/**
 * The delivery filter ticked and unticked. Each change is a results load, and the store refuses a sixth results page
 * within eight seconds (`STORE_THROTTLE`); the search, its browser check and these two loads make four, so a
 * second detour of two more loads would be refused and is left out. The waits read the pager's own addresses and the
 * rail's "Clear all filters" link, so a step never passes on the page it left.
 */
const DETOUR_STEPS: ScenarioStep[] = [
  { id: "demo-plus-filter", operation: "click", target: "role:link:Brightaisle Plus" },
  { id: "demo-plus-shown", operation: "waitForState", target: "role:link:Clear all filters", timeoutMs: 8000 },
  { id: "demo-plus-off", operation: "click", target: "role:link:Brightaisle Plus" },
  { id: "demo-plus-cleared", operation: "waitForState", target: `${PAGE_TWO}:not([href*="rh="])`, timeoutMs: 8000 },
];

export const EVERYTHING_STORE_DEMONSTRATIONS: readonly ScenarioDemonstration[] = [
  {
    id: "everything-store-coupon-earbuds-demo",
    scenarioId: "everything-store",
    taskId: "everything-store-coupon-earbuds-rated-four",
    description: "I search for wireless earbuds, tick the Brightaisle Plus delivery filter to see what it does and untick it again, then go through every page of results in the order the store shows them, reading the earbuds that show a coupon badge and a rating of four stars or more.",
    steps: insertAfterStep(COUPON_EARBUDS_WORKFLOW.recordingScript, "coupon-results", DETOUR_STEPS),
    detours: [
      {
        stepIds: ["demo-plus-filter", "demo-plus-shown", "demo-plus-off", "demo-plus-cleared"],
        why: "An extra delivery filter (Brightaisle Plus) the task never asks for, applied and cleared again before reading.",
        acts: [{ operation: "click", target: "Brightaisle Plus" }],
      },
    ],
  },
];
