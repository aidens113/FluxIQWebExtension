import type { ScenarioStep } from "@fluxiq-web-extension/test-contracts";

/**
 * What the home page throws at a visit, answered in the order it arrives, as
 * the manifest's own workflows answer it: the app promotion 2.5 s in, the
 * assistant's greeting 3.5 s in, then the cookie banner. Each answer lasts for
 * the session. `prefix` keeps every workflow's step ids its own.
 */
export function arrivalSteps(prefix: string): ScenarioStep[] {
  return [
    { id: `${prefix}-promotion-shown`, operation: "waitForState", target: "role:dialog:Bid on the go", timeoutMs: 15_000 },
    { id: `${prefix}-decline-promotion`, operation: "click", target: `div[role="dialog"] span:text-is("Not now")` },
    { id: `${prefix}-greeting-shown`, operation: "waitForState", target: "#hal-greeting", timeoutMs: 15_000 },
    { id: `${prefix}-close-greeting`, operation: "click", target: "#hal-greeting .hal-close" },
    { id: `${prefix}-accept-cookies`, operation: "click", target: "role:button:Accept all" },
  ];
}
