import type { ScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { firstVisitSteps } from "../first-visit.js";
import { newsletterSignupExpected } from "./expected.js";

/** Sign one address up on the footer's "Offers & reminders" page and read back the subscription with its code. */
export const newsletterSignupWorkflow: ScenarioWorkflow = {
  id: "newsletter-signup",
  recordingDescription: "Demonstrates signing an address up to a newsletter and reading back the subscription it created.",
  description: "Sign ada.synthetic@example.test up to the newsletter once, and read the subscription and its 10% code.",
  recordingScript: [
    ...firstVisitSteps("newsletter"),
    { id: "newsletter-open-page", operation: "click", target: 'footer a:text-is("Offers & reminders")' },
    { id: "newsletter-enter-email", operation: "type", target: 'main input[name="email"]', value: "ada.synthetic@example.test" },
    { id: "newsletter-sign-up", operation: "click", target: 'button:text-is("Sign me up")' },
    { id: "newsletter-subscribed", operation: "waitForState", target: 'section[aria-label="Your subscriptions"]', timeoutMs: 8000 },
    {
      id: "extract-newsletter-subscription", operation: "extract", target: 'section[aria-label="Your subscriptions"] tbody tr',
      fields: { email: "column:Email", code: "column:Your 10% code" },
    },
  ],
  expected: newsletterSignupExpected,
};
