import type { ScenarioExpected } from "@fluxiq-web-extension/test-contracts";
import { accountFact } from "../account-fact.js";
import { relayFact } from "../relay-fact.js";

/**
 * No post the verified studio published in August 2026 passed 1,300 likes:
 * the most liked, the test tiles of 21 August, has 1,249. Read off
 * `data/studio-posts.ts` by hand. The right table is empty, and each nearby
 * wrong answer has rows: the August reel's grid count is 18.3K plays (640
 * likes), the pinned anniversary post is from August 2025 (3,412), the
 * impersonator `harbourlight.studios` posted on 11 August 2026 (5,020), and
 * Kiln Theory's cone chart of 30 August has 1,840.
 */
export const augustOver1300Expected: ScenarioExpected = {
  pageFacts: [relayFact("august-over-1300-consent-unanswered", "consent", "pending"), accountFact("august-over-1300-initial-account")],
  finalState: [
    relayFact("august-over-1300-consent-declined", "consent", "essential"),
    relayFact("august-over-1300-never-blocked", "blocked", "clear"),
    accountFact("august-over-1300-account-untouched"),
  ],
  extracted: [{ step: "extract-august-over-1300", count: 0, records: [] }],
  // The grid's third screen answers 401 with the session check until "Continue as" confirms the session: the site working, which the browser logs as a failed load.
  allowedConsoleErrors: ["the server responded with a status of 401 (Unauthorized)"],
};
