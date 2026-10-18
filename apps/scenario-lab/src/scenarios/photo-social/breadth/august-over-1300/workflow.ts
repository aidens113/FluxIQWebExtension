import type { ScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { collapseDockSteps, openingSteps } from "../steps/index.js";
import { AUGUST_OVER_1300_CELLS } from "./cells.js";
import { augustOver1300Expected } from "./expected.js";

const cell = (nth: number) => `main a[role="link"][href*="/p/"]:nth-child(${nth})`;

/**
 * Whether the studio passed 1,300 likes on any August 2026 post. August runs
 * from the grid's sixteenth cell to its twenty-fifth, so the read loads three
 * screens: the second by scrolling, the third through the rate limit a fast
 * scroll trips and the session check behind it. The opened qualifying post supplies its exact date and likes.
 */
export const augustOver1300Workflow: ScenarioWorkflow = {
  id: "august-over-1300",
  recordingDescription: "Demonstrates loading a profile grid through its rate limit and session check and reading the posts of one month above a like count.",
  description: "Load the verified studio's grid down to August 2026 and read every photo or carousel from that month with more than1,300 exact likes.",
  recordingScript: [
    ...openingSteps("august-over-1300"),
    { id: "august-over-1300-open-profile", operation: "navigate", path: "/scenarios/photo-social/harbourlight.studio/" },
    ...collapseDockSteps("august-over-1300"),
    { id: "august-over-1300-scroll-1", operation: "scroll", value: 6000 },
    { id: "august-over-1300-screen-2", operation: "waitForState", target: cell(24), timeoutMs: 5000 },
    { id: "august-over-1300-scroll-2", operation: "scroll", value: 6000 },
    { id: "august-over-1300-rate-limited", operation: "waitForState", target: "role:button:Try again", timeoutMs: 8000 },
    { id: "august-over-1300-try-again", operation: "click", target: "role:button:Try again" },
    { id: "august-over-1300-session-check", operation: "waitForState", target: "role:button:Continue as tamsin.reyes", timeoutMs: 5000 },
    { id: "august-over-1300-continue", operation: "click", target: "role:button:Continue as tamsin.reyes" },
    { id: "august-over-1300-screen-3", operation: "waitForState", target: cell(36), timeoutMs: 5000 },
    { id: "august-over-1300-open-post", operation: "click", target: AUGUST_OVER_1300_CELLS },
    { id: "august-over-1300-post-ready", operation: "waitForState", target: "article section a[href$=\"/liked_by/\"] > span", timeoutMs: 5000 },
    { id: "extract-august-over-1300", operation: "extract", target: "article", minItems: 1, fields: { date: 'section:has(> a[href$="/liked_by/"]) + div a > time', likes: "section a[href$=\"/liked_by/\"] > span" } },
    { id: "august-over-1300-read", operation: "checkpoint" },
  ],
  expected: augustOver1300Expected,
};
