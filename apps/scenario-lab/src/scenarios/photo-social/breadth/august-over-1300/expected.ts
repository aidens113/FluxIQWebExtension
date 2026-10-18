import type { ScenarioExpected } from "@fluxiq-web-extension/test-contracts";
import { accountFact } from "../account-fact.js";
import { relayFact } from "../relay-fact.js";

/** The August21 test tiles have1,349 likes; reel plays, pinned2025 posts and other accounts do not qualify. */
export const augustOver1300Expected: ScenarioExpected = {
  pageFacts: [relayFact("august-over-1300-consent-unanswered", "consent", "pending"), accountFact("august-over-1300-initial-account")],
  finalState: [
    relayFact("august-over-1300-consent-declined", "consent", "essential"),
    relayFact("august-over-1300-never-blocked", "blocked", "clear"),
    accountFact("august-over-1300-account-untouched"),
  ],
  extracted: [{ step: "extract-august-over-1300", count: 1, records: [{ date: "August 21", likes: "1,349" }] }],
  // The grid's third screen answers 401 with the session check until "Continue as" confirms the session: the site working, which the browser logs as a failed load.
  allowedConsoleErrors: ["the server responded with a status of 401 (Unauthorized)"],
};
