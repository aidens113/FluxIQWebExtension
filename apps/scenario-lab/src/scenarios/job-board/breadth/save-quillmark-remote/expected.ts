import type { ScenarioExpected } from "@fluxiq-web-extension/test-contracts";
import { accountFact } from "../account-fact.js";
import { UNCHANGED_ACCOUNT } from "../unchanged-account.js";

/**
 * Quillmark's three fully remote UK jobs saved beside the two already there:
 * the Senior Rust Engineer, its contract namesake and the Customer Success
 * Manager -- not Quillmark Labs' Senior Rust Engineer, not the hybrid London
 * one. The account read-out sorts saved keys, so the order of the saves does
 * not matter; the saved list is the board's own, newest posting first.
 */
export const saveQuillmarkRemoteExpected: ScenarioExpected = {
  pageFacts: [accountFact("save-quillmark-remote-initial-account", UNCHANGED_ACCOUNT)],
  finalState: [accountFact("save-quillmark-remote-account", "{\"saved\":[\"12989de62c149c5b\",\"13707d7b1e529572\",\"21184d1fa92f3741\",\"9acf8f84c9c767ef\",\"a31866ada1ad54e1\"],\"follows\":[],\"alertSubscriptions\":[],\"applicationCount\":0}")],
  extracted: [{
    step: "extract-saved-after-quillmark",
    count: 5,
    records: [
      { title: "Senior Rust Engineer", company: "Quillmark", location: "Remote (UK)" },
      { title: "Product Designer", company: "Halvard Systems", location: "Leeds" },
      { title: "Customer Success Manager", company: "Quillmark", location: "Remote (UK)" },
      { title: "Senior Rust Engineer (Contract)", company: "Quillmark", location: "Remote (UK)" },
      { title: "Frontend Engineer", company: "Pinecrest Retail", location: "Remote (UK)" },
    ],
  }],
  allowedConsoleErrors: ["status of 429"],
};
