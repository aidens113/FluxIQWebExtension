import type { ScenarioStep } from "@fluxiq-web-extension/test-contracts";

/**
 * The steps every recording on the marketplace opens with: the cookie
 * question that owns the page, the notification prompt a results page asks on
 * a timer, and a search typed into the Marketplace box rather than the top
 * bar's people search.
 */
export const answerCookies: ScenarioStep = { id: "allow-cookies", operation: "click", target: "role:button:Allow all cookies" };

export const notificationsNotNow = (prefix: string): ScenarioStep[] => [
  { id: `${prefix}-notifications-asked`, operation: "waitForState", target: "role:button:Not now", timeoutMs: 6000 },
  { id: `${prefix}-notifications-not-now`, operation: "click", target: "role:button:Not now" },
];

export const searchFor = (text: string, prefix: string): ScenarioStep[] => [
  { id: `${prefix}-type-search`, operation: "type", target: "role:searchbox:Search Marketplace", value: text },
  { id: `${prefix}-run-search`, operation: "press", target: "role:searchbox:Search Marketplace", value: "Enter" },
];
