import type { ScenarioStep } from "@fluxiq-web-extension/test-contracts";

const CLOSE_CONVERSATION = "role:button:Close your conversation with Priya Nair";

/**
 * What every recording meets on the feed it starts on, in the one order that
 * holds however late the first step comes: the app prompt, then the
 * conversation, then the cookie banner (the primary workflow's `ARRIVE`
 * explains the order). Each answer lasts for the session. `prefix` keeps the
 * step ids unique to the workflow that uses them.
 */
export function arrivalSteps(prefix: string): ScenarioStep[] {
  return [
    { id: `${prefix}-app-prompt-shown`, operation: "waitForState", target: `div:text-is("Not now")`, timeoutMs: 15_000 },
    { id: `${prefix}-put-off-app`, operation: "click", target: `div:text-is("Not now")` },
    { id: `${prefix}-conversation-opened`, operation: "waitForState", target: CLOSE_CONVERSATION, timeoutMs: 15_000 },
    { id: `${prefix}-close-conversation`, operation: "click", target: CLOSE_CONVERSATION },
    { id: `${prefix}-accept-cookies`, operation: "click", target: "role:button:Accept" },
  ];
}
