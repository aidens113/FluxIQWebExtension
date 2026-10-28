import { resolveScenarioWorkflow, type ScenarioDemonstration, type ScenarioStep } from "@fluxiq-web-extension/test-contracts";
import { insertAfterStep } from "../insert-after-step.js";
import { crossborderMarketplaceManifest, MARKET_SEED } from "./manifest/index.js";
import { marketClasses } from "./styles/index.js";

const c = marketClasses(MARKET_SEED, "baseline");
const ROBOT = 'text="I\'m not a robot"';
const SORT_TAB = (label: string) => `.${c.sortTab} >> text="${label}"`;
const SORT_TAB_ON = (label: string) => `.${c.sortTab}.${c.sortTabOn} >> text="${label}"`;

/**
 * Spain ticked in the sidebar, then its chip cleared. Each filter change is a results load, and the third since the
 * last traffic check is replaced by that check, so the clear meets it and the demonstration answers it. Placed before
 * the price ceiling: a filter change drops the typed ceiling, so clearing after it would not restore the page.
 */
const SPAIN_DETOUR: ScenarioStep[] = [
  { id: "demo-spain-filter", operation: "click", target: `.${c.sidebar} >> text="Spain"` },
  { id: "demo-spain-chip", operation: "waitForState", target: `.${c.chips} >> text="Spain ×"`, timeoutMs: 6000 },
  { id: "demo-clear-spain", operation: "click", target: `.${c.chips} >> text="Spain ×"` },
  { id: "demo-spain-check", operation: "waitForState", target: ROBOT, timeoutMs: 6000 },
  { id: "demo-spain-pass", operation: "click", target: ROBOT },
  { id: "demo-spain-cleared", operation: "waitForState", target: `.${c.sidebar} >> text="Free shipping"`, timeoutMs: 8000 },
];

/** The Orders sort tried, then Best Match put back; the second load meets the traffic check again. */
const SORT_DETOUR: ScenarioStep[] = [
  { id: "demo-sort-orders", operation: "click", target: SORT_TAB("Orders") },
  { id: "demo-orders-on", operation: "waitForState", target: SORT_TAB_ON("Orders"), timeoutMs: 6000 },
  { id: "demo-sort-default", operation: "click", target: SORT_TAB("Best Match") },
  { id: "demo-default-check", operation: "waitForState", target: ROBOT, timeoutMs: 6000 },
  { id: "demo-default-pass", operation: "click", target: ROBOT },
  { id: "demo-default-back", operation: "waitForState", target: SORT_TAB_ON("Best Match"), timeoutMs: 8000 },
];

const DETOURS: ScenarioDemonstration["detours"] = [
  {
    stepIds: ["demo-spain-filter", "demo-spain-chip", "demo-clear-spain", "demo-spain-check", "demo-spain-pass", "demo-spain-cleared"],
    why: "An extra Ships from filter the task never asks for, applied to see what changes and cleared again before the real filters.",
    acts: [{ operation: "click", target: "Spain" }],
  },
  {
    stepIds: ["demo-sort-orders", "demo-orders-on", "demo-sort-default", "demo-default-check", "demo-default-pass", "demo-default-back"],
    why: "A wrong sort (Orders) tried and put back to Best Match before the price sort.",
    acts: [{ operation: "click", target: "Orders" }],
  },
];

/** The site's honest free-hubs workflow with both detours spliced in; a ceiling other than 10 is the conflicting variant. */
function steps(ceiling: string): ScenarioStep[] {
  const honest = resolveScenarioWorkflow(crossborderMarketplaceManifest, { workflowId: "free-hubs-under-ten" }).recordingScript;
  const withCeiling = honest.map((step) => (step.id === "cheap-type-ceiling" ? { ...step, value: ceiling } : step));
  return insertAfterStep(insertAfterStep(withCeiling, "cheap-decline-notifications", SPAIN_DETOUR), "cheap-results-back", SORT_DETOUR);
}

export const CROSSBORDER_MARKETPLACE_DEMONSTRATIONS: readonly ScenarioDemonstration[] = [
  {
    id: "crossborder-marketplace-free-hubs-under-ten-demo",
    scenarioId: "crossborder-marketplace",
    taskId: "crossborder-marketplace-free-hubs-under-ten",
    description: "I search for the hubs, tick Ships from Spain just to see what it changes and clear it again, then narrow to free shipping and a maximum price of 10, try sorting by Orders and switch back to Best Match, sort by price from low to high, and read the cards that are not ads.",
    steps: steps("10"),
    detours: DETOURS,
  },
  {
    id: "crossborder-marketplace-free-hubs-higher-limit-demo",
    scenarioId: "crossborder-marketplace",
    taskId: "crossborder-marketplace-free-hubs-under-ten",
    description: "I search for the hubs, tick Ships from Spain just to see what it changes and clear it again, then narrow to free shipping and a maximum price of 20 because I would pay a little more, try sorting by Orders and switch back to Best Match, sort by price from low to high, and read the cards that are not ads.",
    steps: steps("20"),
    detours: DETOURS,
    conflictsWithInstruction: true,
  },
];
