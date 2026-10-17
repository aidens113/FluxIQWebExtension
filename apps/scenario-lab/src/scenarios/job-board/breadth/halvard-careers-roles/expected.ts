import type { ScenarioExpected } from "@fluxiq-web-extension/test-contracts";
import { accountFact } from "../account-fact.js";
import { UNCHANGED_ACCOUNT } from "../unchanged-account.js";

const ROLE = "/scenarios/job-board/careers/halvard/jobs/";

/**
 * Halvard Systems' own careers list, in its own order: the six roles it takes
 * applications for, each with the address of its page on the careers site.
 * Only that site carries those addresses -- Rolefinch links its cards to its
 * own job pages -- so a table read off Rolefinch's search fails, as it also
 * takes in Halvard Labs and the Oakridge role that mentions Halvard Systems.
 * Nothing is saved or sent on the way; the account read-out is the Rolefinch
 * tab's, which a saved job or alert would change.
 */
export const halvardCareersRolesExpected: ScenarioExpected = {
  pageFacts: [accountFact("halvard-careers-roles-initial-account", UNCHANGED_ACCOUNT)],
  finalState: [accountFact("halvard-careers-roles-account", UNCHANGED_ACCOUNT)],
  extracted: [{
    step: "extract-halvard-careers-roles",
    count: 6,
    records: [
      { title: "Backend Engineer – Rust", location: "Remote (UK)", link: `${ROLE}HS-3305` },
      { title: "Site Reliability Engineer", location: "Hybrid (Leeds)", link: `${ROLE}HS-3312` },
      { title: "Product Designer", location: "Leeds", link: `${ROLE}HS-3290` },
      { title: "Rust Engineer", location: "Leeds", link: `${ROLE}HS-3301` },
      { title: "Data Engineer", location: "Remote (UK)", link: `${ROLE}HS-3270` },
      { title: "Engineering Manager", location: "Leeds", link: `${ROLE}HS-3150` },
    ],
  }],
  allowedConsoleErrors: ["status of 429"],
};
