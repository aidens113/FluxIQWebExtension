import type { ScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { firstVisitSteps } from "../first-visit.js";
import { heatPumpQuoteExpected } from "./expected.js";

/** The job details the request carries: the branch the Branches page names as the heat pump centre. */
const DETAILS = "Please could the survey be done by your Sallowmere branch, your renewables and heat pump centre.";

/**
 * Find the heat pump centre on the Branches page, then send a heat pump
 * quote request naming it, contact by text message, marketing refused, and
 * read back what the office received. The human check is the person's.
 */
export const heatPumpQuoteWorkflow: ScenarioWorkflow = {
  id: "heat-pump-quote",
  recordingDescription: "Demonstrates reading a fact on one page, carrying it into a multi-step form, and reading the confirmation.",
  description: "Find the renewables branch, request a heat pump installation quote naming it, contact by text, no marketing, and read the confirmation.",
  recordingScript: [
    ...firstVisitSteps("heat-pump"),
    { id: "heat-pump-open-branches", operation: "click", target: 'nav a:text-is("Branches")' },
    { id: "heat-pump-find-centre", operation: "waitForState", target: 'article:has(h2:text-is("Sallowmere")) p:text-is("Renewables and heat pump centre.")', timeoutMs: 8000 },
    { id: "heat-pump-open-quote", operation: "click", target: 'header button:text-is("Get a free quote")' },
    { id: "heat-pump-name", operation: "type", target: 'input[name="fullName"]', value: "Ada Synthetic" },
    { id: "heat-pump-email", operation: "type", target: 'input[name="email"]', value: "ada.synthetic@example.test" },
    { id: "heat-pump-phone", operation: "type", target: 'input[name="phone"]', value: "07700 900123" },
    { id: "heat-pump-postcode", operation: "type", target: 'input[name="postcode"]', value: "KL6 2RN" },
    { id: "heat-pump-continue-to-job", operation: "click", target: 'button:text-is("Continue")' },
    { id: "heat-pump-service-list", operation: "click", target: 'div:text-is("Choose a service")' },
    { id: "heat-pump-service", operation: "click", target: 'div:text-is("Heat pump installation")' },
    { id: "heat-pump-details", operation: "type", target: 'textarea[name="details"]', value: DETAILS },
    { id: "heat-pump-contact-by-text", operation: "check", target: 'input[name="contactBy"][value="Text message"]', value: true },
    { id: "heat-pump-continue-to-consent", operation: "click", target: 'button:text-is("Continue")' },
    { id: "heat-pump-refuse-marketing", operation: "check", target: 'input[name="marketing"]', value: false },
    { id: "heat-pump-agree-to-contact", operation: "check", target: 'input[name="privacy"]', value: true },
    { id: "heat-pump-send", operation: "click", target: "testid:quote-submit" },
    { id: "heat-pump-await-human-check", operation: "waitForState", target: 'div:text-is("Confirm you are human")', timeoutMs: 6000 },
    { id: "heat-pump-confirm-human", operation: "click", target: 'div:text-is("Confirm you are human")' },
    { id: "heat-pump-await-reference", operation: "waitForState", target: "testid:quote-reference", timeoutMs: 8000 },
    {
      id: "extract-heat-pump-quote", operation: "extract", target: "main",
      fields: { reference: '[data-testid="quote-reference"]', service: '[data-testid="quote-service"]', contactBy: '[data-testid="quote-contact"]', offers: '[data-testid="quote-marketing"]' },
    },
  ],
  expected: heatPumpQuoteExpected,
};
