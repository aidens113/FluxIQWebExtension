import type { ScenarioExpected } from "@fluxiq-web-extension/test-contracts";
import { accountFact } from "../account-fact.js";
import { UNCHANGED_ACCOUNT } from "../unchanged-account.js";

/**
 * Every open job that is fully remote in the UK, takes Rolefinch's own
 * Easily apply and shows a salary, newest first: seven across the three
 * pages of remote results. Brightwater's Rust Engineer (no salary), the two
 * hybrid quick-apply roles and the closed Pinecrest job fall out; the read
 * changes nothing on the account. Literal records, checked against the
 * catalog in `breadth/tests/expected.test.ts`.
 */
export const remoteEasyApplyExpected: ScenarioExpected = {
  pageFacts: [accountFact("remote-easy-apply-initial-account", UNCHANGED_ACCOUNT)],
  finalState: [accountFact("remote-easy-apply-account", UNCHANGED_ACCOUNT)],
  extracted: [{
    step: "extract-remote-easy-apply",
    count: 7,
    records: [
      { title: "Trust & Safety Engineer", company: "Pinecrest Retail", salary: "£75,000 – £85,000 a year" },
      { title: "Platform Engineer", company: "Halvard Labs", salary: "£70,000 – £82,000 a year" },
      { title: "Senior Rust Engineer", company: "Marlowe Freight", salary: "Up to £95,000 a year" },
      { title: "QA Engineer", company: "Saltmarsh Games", salary: "£42,000 – £50,000 a year" },
      { title: "Rust Engineer, Graduate Programme", company: "Oakridge Freight", salary: "£38,000 a year" },
      { title: "Senior Rust Engineer", company: "Quillmark Labs", salary: "£60,000 – £75,000 a year" },
      { title: "Technical Writer", company: "Parsec Grid", salary: "£50,000 – £58,000 a year" },
    ],
  }],
  allowedConsoleErrors: ["status of 429"],
};
