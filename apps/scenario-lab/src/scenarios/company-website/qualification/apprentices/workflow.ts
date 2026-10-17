import type { ScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { firstVisitSteps } from "../first-visit.js";
import { apprenticesExpected } from "./expected.js";

/** Where each apprentice's card stands in the grid once it lists everyone; the last is in the final batch. */
const APPRENTICE_GRID_PLACES = [6, 12, 20, 28] as const;

/**
 * Read the whole "Our people" grid, past the "Show more people" button that
 * needs a second press, and keep the four apprentices. Plain CSS cannot read
 * a card's role, so the read names the kept cards by their place in the grid.
 */
export const apprenticesWorkflow: ScenarioWorkflow = {
  id: "apprentices",
  recordingDescription: "Demonstrates reading a lazily loaded team grid to its end and keeping the people whose role matches.",
  description: "List every apprentice across all branches, reading the team grid to its last batch.",
  recordingScript: [
    ...firstVisitSteps("apprentices"),
    { id: "apprentices-open-team", operation: "click", target: 'nav a:text-is("Our team")' },
    { id: "apprentices-first-batch", operation: "waitForState", target: 'article:has(h3:text-is("Dafydd Rees"))', timeoutMs: 8000 },
    { id: "apprentices-scroll-second", operation: "scroll", value: 4000 },
    { id: "apprentices-second-batch", operation: "waitForState", target: 'article:has(h3:text-is("Ewan Halloran"))', timeoutMs: 10000 },
    { id: "apprentices-scroll-third", operation: "scroll", value: 4000 },
    { id: "apprentices-third-batch", operation: "waitForState", target: 'article:has(h3:text-is("Owen Castellane"))', timeoutMs: 10000 },
    { id: "apprentices-show-more", operation: "click", target: 'button:text-is("Show more people")' },
    { id: "apprentices-show-more-again", operation: "click", target: 'button:text-is("Show more people")' },
    { id: "apprentices-last-batch", operation: "waitForState", target: 'article:has(h3:text-is("Megan Ashdown"))', timeoutMs: 10000 },
    {
      id: "extract-apprentices", operation: "extract",
      target: APPRENTICE_GRID_PLACES.map((place) => `section[aria-label="Our people"] article:nth-of-type(${place})`).join(", "),
      fields: { name: "h3", role: "h3 + p", branch: "dl > div:first-child > dd" },
    },
  ],
  expected: apprenticesExpected,
};
