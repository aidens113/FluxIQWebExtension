import type { ScenarioStep, ScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { feedToCaughtUpSteps, overlaySteps } from "../steps/index.js";
import { hideSuggestedPostsExpected } from "./expected.js";

/** Where the two suggested posts sit in the baseline feed above "You're all caught up". */
const SUGGESTED = [9, 22];
const unit = (position: number) => `[role="feed"] > [aria-posinset="${position}"]`;

/**
 * Reads the whole home feed, notes the two suggested posts, then hides each
 * with its own Hide post button and waits until the feed shows it hidden.
 */
export const hideSuggestedPostsWorkflow: ScenarioWorkflow = {
  id: "hide-suggested-posts",
  recordingDescription: "Demonstrates reading marked feed items and hiding exactly those items.",
  description: "Hide the two posts the home feed suggests above You're all caught up, after noting each, and hide nothing else.",
  recordingScript: [
    ...overlaySteps("hide"),
    ...feedToCaughtUpSteps("hide"),
    { id: "extract-hidden-suggestions", operation: "extract", target: SUGGESTED.map(unit).join(", "), fields: { community: "h3 a", text: "[data-ad-comet-preview=\"message\"]" } },
    ...SUGGESTED.flatMap((position): ScenarioStep[] => [
      { id: `hide-suggested-${position}`, operation: "click", target: `${unit(position)} [aria-label="Hide post"]` },
      { id: `hidden-suggested-${position}`, operation: "waitForState", target: `${unit(position)}:not(:has([aria-label="Hide post"]))`, timeoutMs: 3000 },
    ]),
    { id: "suggestions-hidden", operation: "checkpoint" },
  ],
  expected: hideSuggestedPostsExpected,
};
