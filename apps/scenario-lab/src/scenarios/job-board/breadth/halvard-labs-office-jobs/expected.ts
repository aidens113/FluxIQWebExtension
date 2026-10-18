import type { ScenarioExpected } from "@fluxiq-web-extension/test-contracts";
import { accountFact } from "../account-fact.js";
import { UNCHANGED_ACCOUNT } from "../unchanged-account.js";

/** The hybrid Labs job is newly saved beside the two existing saved jobs; remote Labs and Systems roles are excluded. */
export const halvardLabsOfficeJobsExpected: ScenarioExpected = {
  pageFacts: [accountFact("halvard-labs-office-jobs-initial-account", UNCHANGED_ACCOUNT)],
  finalState: [accountFact("halvard-labs-office-jobs-account", JSON.stringify({ saved: ["13707d7b1e529572", "21184d1fa92f3741", "864532f1fa5dbc8f"], follows: [], alertSubscriptions: [], applicationCount: 0 }))],
  extracted: [{ step: "extract-halvard-labs-office-jobs", count: 1, records: [{ title: "Workplace Systems Engineer", company: "Halvard Labs", location: "Hybrid (Manchester)" }] }],
  allowedConsoleErrors: ["status of 429"],
};
