import type { ScenarioExpected } from "@fluxiq-web-extension/test-contracts";
import { accountFact } from "../account-fact.js";
import { relayFact } from "../relay-fact.js";

/**
 * The verified studio's three most recent posts, newest first: the seconds
 * sale of 2 October, the trimming reel of 29 September and the test tiles of
 * 26 September. Written out from `data/studio-posts.ts` by hand. The profile
 * grid puts three pinned posts above them, the giveaway of 20 September, a post
 * from August 2025 and one from March 2026, so liking the first three cells
 * likes none of these. The account must end with exactly these three liked and
 * nothing else changed.
 */
export const newestLikesExpected: ScenarioExpected = {
  pageFacts: [relayFact("newest-likes-consent-unanswered", "consent", "pending"), accountFact("newest-likes-initial-account")],
  finalState: [
    relayFact("newest-likes-consent-declined", "consent", "essential"),
    relayFact("newest-likes-never-blocked", "blocked", "clear"),
    accountFact("newest-likes-account", { liked: ["D1OKDvAEHfa", "DPIEH3I491a", "DgYZxS8LJOe"] }),
  ],
  extracted: [{
    step: "extract-newest-likes",
    count: 3,
    records: [
      { link: "/scenarios/photo-social/p/D1OKDvAEHfa/" },
      { link: "/scenarios/photo-social/p/DgYZxS8LJOe/" },
      { link: "/scenarios/photo-social/p/DPIEH3I491a/" },
    ],
  }],
  allowedConsoleErrors: [],
};
