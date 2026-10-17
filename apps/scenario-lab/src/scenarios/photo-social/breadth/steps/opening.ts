import type { ScenarioStep } from "@fluxiq-web-extension/test-contracts";

const DECLINE = "testid:cookie-policy-manage-dialog-decline-button";

/**
 * How every breadth recording starts: decline optional cookies, then answer
 * "Not Now" to the notifications prompt. `prefix` keeps the step ids of one
 * workflow apart from another's.
 */
export function openingSteps(prefix: string): ScenarioStep[] {
  return [
    { id: `${prefix}-consent-asked`, operation: "waitForState", target: DECLINE, timeoutMs: 5000 },
    { id: `${prefix}-decline-cookies`, operation: "click", target: DECLINE },
    { id: `${prefix}-notifications-asked`, operation: "waitForState", target: "role:button:Not Now", timeoutMs: 5000 },
    { id: `${prefix}-notifications-not-now`, operation: "click", target: "role:button:Not Now" },
  ];
}
