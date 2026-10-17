import type { ScenarioStep, ScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { feedToCaughtUpSteps, overlaySteps } from "../steps/index.js";
import { recentGroupPostsExpected } from "./expected.js";

/** Where the three recent group posts sit in the baseline feed, and which two are cut short behind See more. */
const POSITIONS = [3, 12, 18];
const CUT_SHORT = [3, 18];
const unit = (position: number) => `[role="feed"] > [aria-posinset="${position}"]`;

/**
 * Reads the whole home feed, opens the two long group posts, and extracts the
 * three written in Maya's groups since Saturday. The fields are structure, not
 * classes: in a group post the heading links the group and the first profile
 * link that is not an avatar is the author.
 */
export const recentGroupPostsWorkflow: ScenarioWorkflow = {
  id: "recent-group-posts",
  recordingDescription: "Demonstrates reading a loaded feed and keeping only the group posts in a date range.",
  description: "Read the home feed down to You're all caught up and keep the posts written in Maya's own groups on or after Saturday 19 September, once each and whole.",
  recordingScript: [
    ...overlaySteps("recent"),
    ...feedToCaughtUpSteps("recent"),
    ...CUT_SHORT.map((position): ScenarioStep => ({ id: `recent-see-more-${position}`, operation: "click", target: `${unit(position)} [data-ad-comet-preview="message"] [role="button"]` })),
    {
      id: "extract-recent-group-posts",
      operation: "extract",
      target: POSITIONS.map(unit).join(", "),
      fields: {
        group: "h3 a[href*=\"/groups/\"]",
        author: "a[href*=\"/people/\"]:not([aria-hidden])",
        posted: "a[href*=\"/posts/\"][aria-label]@aria-label",
        text: "[data-ad-comet-preview=\"message\"]",
        comments: "[role=\"button\"][aria-expanded] > span",
      },
    },
    { id: "recent-group-posts-extracted", operation: "checkpoint" },
  ],
  expected: recentGroupPostsExpected,
};
