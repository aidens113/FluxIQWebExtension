import type { ScenarioStep } from "@fluxiq-web-extension/test-contracts";

/**
 * How every visit starts: answer the consent dialog, wait for the email offer
 * that opens a couple of seconds later, and decline it. Declining is
 * remembered, so the offer does not come back on later pages.
 */
export const OPENING_STEPS: readonly ScenarioStep[] = [
  { id: "accept-consent", operation: "click", target: "role:button:Accept all" },
  { id: "offer-opens", operation: "waitForState", target: "h2:has-text(\"Get $10 off your first pickup order\")", timeoutMs: 8000 },
  { id: "decline-offer", operation: "click", target: "a:text-is(\"No thanks\")" },
];

/** Searches from the header's box and waits for the results heading. */
export function searchSteps(prefix: string, query: string): ScenarioStep[] {
  return [
    { id: `${prefix}-type`, operation: "type", target: "input[type=search]", value: query },
    { id: `${prefix}-submit`, operation: "press", target: "input[type=search]", value: "Enter" },
    { id: `${prefix}-listed`, operation: "waitForState", target: "h1:has-text(\"Results for\")", timeoutMs: 8000 },
  ];
}

/** Opens a product from its own listing, never from an ad for it. */
export function openListingStep(id: string, itemId: string): ScenarioStep {
  return { id, operation: "click", target: `div[data-item-id="${itemId}"]:not(:has-text("Sponsored")) a >> nth=0` };
}
