import type { ScenarioStep } from "@fluxiq-web-extension/test-contracts";

/** Enough wheel turns for the home feed to load every batch down to "You're all caught up", as the digest's recording scrolls. */
const SCROLLS_TO_CAUGHT_UP = 14;

/** Scrolls the home feed until it says "You're all caught up", then waits for that heading. */
export function feedToCaughtUpSteps(prefix: string): ScenarioStep[] {
  return [
    ...Array.from({ length: SCROLLS_TO_CAUGHT_UP }, (_unused, index): ScenarioStep => ({ id: `${prefix}-scroll-${index + 1}`, operation: "scroll", value: 6000 })),
    { id: `${prefix}-caught-up`, operation: "waitForState", target: "role:heading:You're all caught up", timeoutMs: 10000 },
  ];
}
