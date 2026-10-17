import type { ScenarioExpected } from "@fluxiq-web-extension/test-contracts";
import { accountFact } from "../account-fact.js";
import { relayFact } from "../relay-fact.js";

/**
 * Every comment and reply under the studio's giveaway that tags @priya.nair,
 * in the order the thread shows them once all four batches are loaded and
 * replies are open: the two replies under Priya's own entry (batch two), then
 * Lena's entry (batch two) and two comments from batch three. Written out from
 * `data/giveaway.ts` by hand. Priya's own comment does not tag her, so a read
 * of every comment that merely mentions her name gets six rows; a read without
 * the replies gets three; a read of the first screen gets none.
 */
export const priyaTagsExpected: ScenarioExpected = {
  pageFacts: [relayFact("priya-tags-consent-unanswered", "consent", "pending"), accountFact("priya-tags-initial-account")],
  finalState: [relayFact("priya-tags-consent-declined", "consent", "essential"), relayFact("priya-tags-never-blocked", "blocked", "clear"), accountFact("priya-tags-account-untouched")],
  extracted: [{
    step: "extract-priya-tags",
    count: 5,
    records: [
      { author: "jonah.west", comment: "@priya.nair thanks for the tag!", date: "2026-09-23" },
      { author: "maya.hollis", comment: "@priya.nair \u{1F64F}", date: "2026-09-24" },
      { author: "lena.moss", comment: "So pretty @kofi.ade @priya.nair", date: "2026-09-21" },
      { author: "maya.hollis", comment: "@priya.nair @ines.vidal", date: "2026-09-20" },
      { author: "jonah.west", comment: "@priya.nair", date: "2026-09-20" },
    ],
  }],
  allowedConsoleErrors: [],
};
