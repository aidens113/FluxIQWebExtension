import type { ScenarioStep } from "@fluxiq-web-extension/test-contracts";

const COLLAPSE = `fl-dock [part="collapse-button"]`;

/** Collapse the messages dock once it has expanded over the bottom right of the page; it stays collapsed for the rest of the visit. */
export function collapseDockSteps(prefix: string): ScenarioStep[] {
  return [
    { id: `${prefix}-dock-expanded`, operation: "waitForState", target: COLLAPSE, timeoutMs: 6000 },
    { id: `${prefix}-collapse-dock`, operation: "click", target: COLLAPSE },
  ];
}
