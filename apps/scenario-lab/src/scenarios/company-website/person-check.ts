import type { ScenarioPersonChecks } from "@fluxiq-web-extension/test-contracts";

/**
 * The quote form's human check, as a person passes it: press "Confirm you are
 * human". Sending the form shows "Checking you are human…" and then the box
 * (`client/quote-script.ts`); pressing it submits the quote and leaves for the
 * received page.
 *
 * Every quote request meets it, because it is what sending does. It is not
 * declared `required` on the rows: the check is raised by a click in the page
 * rather than by a load, and which of FluxIQ's steps notices it first is
 * FluxIQ's to decide, so a run is judged by the quote it leaves behind.
 */
export const PERSON_CHECKS: ScenarioPersonChecks = Object.freeze({
  scenarioId: "company-website",
  checks: Object.freeze([
    Object.freeze({
      id: "confirm-human",
      description: "Checking you are human, then a \"Confirm you are human\" box that submits the quote when pressed.",
      shows: "Confirm you are human",
      steps: Object.freeze([Object.freeze({ action: "click" as const, text: "Confirm you are human" })]),
      clears: "navigation" as const,
      clearsWithinMs: 10_000,
    }),
  ]),
  handOffs: Object.freeze([
    Object.freeze({ person: "completes" as const, required: false, because: "Sending the quote form raises the Confirm you are human check." }),
    Object.freeze({ variantId: "redesigned-quote-submit", person: "completes" as const, required: false, because: "Sending the quote form raises the Confirm you are human check." }),
  ]),
});
