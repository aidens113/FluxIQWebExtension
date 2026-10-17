import type { ScenarioStep } from "@fluxiq-web-extension/test-contracts";

/**
 * The three overlays every visit to a fresh account opens with, answered the
 * way a person answers them: the cookie dialog, the notification prompt three
 * seconds later, then the chat window. Each step id carries `prefix`, because
 * step ids are unique within a workflow and read better named for their task.
 */
export function overlaySteps(prefix: string): ScenarioStep[] {
  return [
    { id: `${prefix}-allow-cookies`, operation: "click", target: "role:button:Allow all cookies" },
    { id: `${prefix}-notifications-asked`, operation: "waitForState", target: "role:dialog:Turn on notifications?", timeoutMs: 8000 },
    { id: `${prefix}-not-now`, operation: "click", target: "role:button:Not now" },
    { id: `${prefix}-chat-popped`, operation: "waitForState", target: "role:dialog:Chat with Elena Sokolova", timeoutMs: 8000 },
    { id: `${prefix}-close-chat`, operation: "click", target: "role:button:Close chat" },
  ];
}
