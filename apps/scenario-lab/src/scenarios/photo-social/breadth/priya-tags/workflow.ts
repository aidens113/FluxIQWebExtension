import type { ScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { collapseDockSteps, openingSteps } from "../steps/index.js";
import { priyaTagsExpected } from "./expected.js";

const GIVEAWAY = "/scenarios/photo-social/p/D96ahbWGjtY/";
const LOAD_MORE = "role:button:Load more comments";
const permalink = (id: string) => `a[href$="/c/${id}/"]`;
/** Priya's own entry, the comment whose replies hold two of the tags. */
const PRIYA_ENTRY = "18926112691673843";
/** The last comment of batches two, three and four, which are there once that batch has loaded. */
const BATCH_ENDS = ["18889382374285548", "18560312895055289", "18986570417651829"] as const;

/**
 * Who tagged Priya under the giveaway. The thread loads in four batches behind
 * a control that swallows its first press, and two of the tags are replies
 * that stay out of the page until opened. The read takes every comment whose
 * own text links to her profile, so a comment she wrote, whose author link is
 * hers, is not one of them.
 */
export const priyaTagsWorkflow: ScenarioWorkflow = {
  id: "priya-tags",
  recordingDescription: "Demonstrates loading a post's whole comment thread, opening replies, and reading the comments that tag one person.",
  description: "Open the verified studio's giveaway, load every batch of comments and the replies under Priya's entry, and read each comment or reply whose text tags @priya.nair.",
  recordingScript: [
    ...openingSteps("priya-tags"),
    { id: "priya-tags-open-giveaway", operation: "navigate", path: GIVEAWAY },
    ...collapseDockSteps("priya-tags"),
    { id: "priya-tags-comments-hydrate", operation: "click", target: LOAD_MORE },
    { id: "priya-tags-more-1", operation: "click", target: LOAD_MORE },
    { id: "priya-tags-batch-2", operation: "waitForState", target: permalink(BATCH_ENDS[0]), timeoutMs: 4000 },
    { id: "priya-tags-more-2", operation: "click", target: LOAD_MORE },
    { id: "priya-tags-batch-3", operation: "waitForState", target: permalink(BATCH_ENDS[1]), timeoutMs: 4000 },
    { id: "priya-tags-more-3", operation: "click", target: LOAD_MORE },
    { id: "priya-tags-batch-4", operation: "waitForState", target: permalink(BATCH_ENDS[2]), timeoutMs: 4000 },
    { id: "priya-tags-open-replies", operation: "click", target: `li:has(> div ${permalink(PRIYA_ENTRY)}) > [role="button"]` },
    { id: "priya-tags-replies-open", operation: "waitForState", target: `li:has(> div ${permalink(PRIYA_ENTRY)}) ul > li:first-child > div a[href*="/c/"]`, timeoutMs: 4000 },
    { id: "extract-priya-tags", operation: "extract", target: `li:has(> div span[dir="auto"] a[href$="/priya.nair/"])`, fields: { author: "h3 a", comment: `span[dir="auto"]`, date: "time@datetime" } },
    { id: "priya-tags-read", operation: "checkpoint" },
  ],
  expected: priyaTagsExpected,
};
