import type { ScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { overlaySteps, pressPostTwiceSteps } from "../steps/index.js";
import { claimFoundKeyExpected } from "./expected.js";

/** What the claim-found-key task asks Maya to post in Harbourside Runners, word for word. */
export const CLAIM_KEY_TEXT = "The car key with the red fob is mine. I'll collect it at Tuesday's session, thank you!";

/** Dev Patel's found-items post, second in the Harbourside Runners discussion. */
const FOUND_POST = "[role=\"feed\"] > [aria-posinset=\"2\"]";

/**
 * Opens Harbourside Runners from the shortcuts, reads the found-items post,
 * then posts the claim in the group's composer -- pressing Post twice past the
 * swallowed first press -- and waits for the pending box the server fills.
 */
export const claimFoundKeyWorkflow: ScenarioWorkflow = {
  id: "claim-found-key",
  recordingDescription: "Demonstrates finding a post in a group, reading it, and posting a reply-style notice in the same group.",
  description: "Find the found-items post in Harbourside Runners, read who posted it and when, and post the key claim in that group, word for word, so it waits for the admins.",
  recordingScript: [
    ...overlaySteps("claim"),
    { id: "claim-open-group", operation: "click", target: "nav[aria-label=\"Shortcuts\"] a[href$=\"/groups/harbourside-runners/\"]" },
    { id: "claim-group-open", operation: "waitForState", target: "testid:group-composer-prompt", timeoutMs: 5000 },
    {
      id: "extract-found-items-post",
      operation: "extract",
      target: FOUND_POST,
      fields: { author: "a[href*=\"/people/\"]:not([aria-hidden])", posted: "a[href*=\"/posts/\"][aria-label]@aria-label", text: "[data-ad-comet-preview=\"message\"]" },
    },
    { id: "claim-open-composer", operation: "click", target: "testid:group-composer-prompt" },
    { id: "claim-composer-open", operation: "waitForState", target: "role:dialog:Create post", timeoutMs: 3000 },
    { id: "claim-write-post", operation: "type", target: "role:textbox:Write something...", value: CLAIM_KEY_TEXT },
    ...pressPostTwiceSteps("claim"),
    { id: "claim-post-pending", operation: "waitForState", target: "testid:pending-posts", timeoutMs: 5000 },
    { id: "claim-posted", operation: "checkpoint" },
  ],
  expected: claimFoundKeyExpected,
};
