import type { ScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { firstVisitSteps } from "../first-visit.js";
import { saturdayCertificateExpected } from "./expected.js";

const WIDGET = "frame:Slotwise booking/";
const noSaturdaySlots = (day: string) => `${WIDGET}div:has(> div:text-is("${day}")) > div:text-is("No online slots")`;

/**
 * Look for a Saturday landlord certificate at Corve Bridge in every week the
 * widget's calendar shows, and book nothing. Corve Bridge is closed on
 * Saturdays, so each Saturday reads "No online slots" and the answer is an
 * empty table. The read is of the last week's Saturday column, which holds
 * slots only at a branch that opens on Saturdays.
 */
export const saturdayCertificateWorkflow: ScenarioWorkflow = {
  id: "saturday-certificate",
  recordingDescription: "Demonstrates checking every week of a booking calendar for a matching slot and stopping with nothing booked.",
  description: "Find every free Saturday slot Corve Bridge offers online for a landlord gas safety certificate; there are none, and nothing is booked or paid.",
  recordingScript: [
    ...firstVisitSteps("saturday"),
    { id: "saturday-open-booking", operation: "click", target: 'nav a:text-is("Book a service")' },
    { id: "saturday-branch", operation: "click", target: `${WIDGET}div:has(> strong:text-is("Corve Bridge"))` },
    { id: "saturday-branch-next", operation: "click", target: `${WIDGET}button:text-is("Next")` },
    { id: "saturday-service", operation: "click", target: `${WIDGET}div:text-is("Landlord certificate (CP12) · £75.00")` },
    { id: "saturday-service-next", operation: "click", target: `${WIDGET}button:text-is("Next")` },
    { id: "saturday-first-week", operation: "waitForState", target: noSaturdaySlots("Sat 03/10"), timeoutMs: 5000 },
    { id: "saturday-later", operation: "click", target: `${WIDGET}div:text-is("Later ›")` },
    { id: "saturday-second-week", operation: "waitForState", target: noSaturdaySlots("Sat 10/10"), timeoutMs: 5000 },
    { id: "saturday-later-again", operation: "click", target: `${WIDGET}div:text-is("Later ›")` },
    { id: "saturday-third-week", operation: "waitForState", target: noSaturdaySlots("Sat 17/10"), timeoutMs: 5000 },
    // The right answer is an empty table, which an extract step refuses unless it declares minItems: 0 (D4).
    {
      id: "extract-saturday-certificate-slots", operation: "extract", target: `${WIDGET}div:has(> div:text-is("Sat 17/10")):has(> div[data-slot])`,
      fields: { date: "div:first-child", time: "div[data-slot]" }, minItems: 0,
    },
  ],
  expected: saturdayCertificateExpected,
};
