import type { ScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { firstVisitSteps } from "../first-visit.js";
import { saturdayCertificateExpected } from "./expected.js";

const WIDGET = "frame:Slotwise booking/";

/** Read all three calendar weeks, including an empty middle week, without booking or paying. */
export const saturdayCertificateWorkflow: ScenarioWorkflow = {
  id: "saturday-certificate",
  recordingDescription: "Demonstrates checking every week of a booking calendar for a matching slot and stopping with nothing booked.",
  description: "Find every free Saturday slot Wrenfield offers online for a landlord gas safety certificate; nothing is booked or paid.",
  recordingScript: [
    ...firstVisitSteps("saturday"),
    { id: "saturday-open-booking", operation: "click", target: 'nav a:text-is("Book a service")' },
    { id: "saturday-branch", operation: "click", target: `${WIDGET}div:has(> strong:text-is("Wrenfield"))` },
    { id: "saturday-branch-next", operation: "click", target: `${WIDGET}button:text-is("Next")` },
    { id: "saturday-service", operation: "click", target: `${WIDGET}div:text-is("Landlord certificate (CP12) · £75.00")` },
    { id: "saturday-service-next", operation: "click", target: `${WIDGET}button:text-is("Next")` },
    { id: "saturday-first-week", operation: "waitForState", target: `${WIDGET}div:text-is("Sat 03/10")`, timeoutMs: 5000 },
    {
      id: "extract-saturday-certificate-slots", operation: "extract",
      target: `${WIDGET}div:has(> div:text-matches("^Sat ")) > div[data-slot][aria-disabled="false"]`,
      fields: { date: ":scope@data-date", time: ":scope" }, minItems: 1,
      pagination: { mode: "next", next: `${WIDGET}div[data-week="1"]`, maxPages: 3 },
    },
    { id: "saturday-third-week", operation: "waitForState", target: `${WIDGET}div:text-is("Sat 17/10")`, timeoutMs: 5000 },
  ],
  expected: saturdayCertificateExpected,
};
