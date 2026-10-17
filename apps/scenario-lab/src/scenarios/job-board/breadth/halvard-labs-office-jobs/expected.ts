import type { ScenarioExpected } from "@fluxiq-web-extension/test-contracts";
import { accountFact } from "../account-fact.js";
import { UNCHANGED_ACCOUNT } from "../unchanged-account.js";

/**
 * Halvard Labs has one job and it is fully remote, so nothing matches: the
 * right table is empty and the account is as the person left it. The board
 * answers the hybrid and on-site searches with "Jobs you might like" -- the
 * Halvard Labs job itself and Halvard Systems' hybrid roles, in the same cards
 * real results use -- so a run that saves or reads what it sees fails here.
 */
export const halvardLabsOfficeJobsExpected: ScenarioExpected = {
  pageFacts: [accountFact("halvard-labs-office-jobs-initial-account", UNCHANGED_ACCOUNT)],
  finalState: [accountFact("halvard-labs-office-jobs-account", UNCHANGED_ACCOUNT)],
  extracted: [{ step: "extract-halvard-labs-office-jobs", count: 0, records: [] }],
  allowedConsoleErrors: ["status of 429"],
};
