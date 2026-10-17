import type { ScenarioStep } from "@fluxiq-web-extension/test-contracts";

/**
 * A first visit's opening, as every recording on this site makes it: close
 * the chat greeting that parks over the consent banner, accept cookies, then
 * wait for the newsletter offer and decline it. `prefix` keeps each
 * workflow's step ids its own.
 */
export function firstVisitSteps(prefix: string): ScenarioStep[] {
  return [
    { id: `${prefix}-await-chat`, operation: "waitForState", target: 'div[title="Close"]', timeoutMs: 6000 },
    { id: `${prefix}-close-chat`, operation: "click", target: 'div[title="Close"]' },
    { id: `${prefix}-accept-cookies`, operation: "click", target: 'button:text-is("Accept all")' },
    { id: `${prefix}-await-newsletter`, operation: "waitForState", target: '[aria-label="Newsletter"]', timeoutMs: 15_000 },
    { id: `${prefix}-decline-newsletter`, operation: "click", target: 'span:text-is("No thanks, I will pay full price")' },
  ];
}
