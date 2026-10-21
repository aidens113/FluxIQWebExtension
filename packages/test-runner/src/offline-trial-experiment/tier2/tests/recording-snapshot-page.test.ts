// The snapshot page as the experiment watches it: every evaluation passes
// through unchanged, and what is kept of it is counts, codes and the snapshot's
// digest prefix, never a value read off the page.

import assert from "node:assert/strict";
import test from "node:test";
import type { WebAutomationActionCommand, WebAutomationActionResult, WebPageSnapshot, WebSnapshotPage, WebSnapshotPageEvaluation } from "@fluxiq-web-extension/domain/node";
import { recordingSnapshotPage } from "../recording-snapshot-page.js";

const SNAPSHOT: WebPageSnapshot = {
  url: "http://127.0.0.1:4100/scenarios/site/list",
  primary: { sha256: "abcdef0123456789", mediaType: "text/html", role: "primary", source: "http://127.0.0.1:4100/scenarios/site/list", bytes: new Uint8Array() },
  resources: [],
  unavailable: 0,
};
const READ: WebAutomationActionCommand = { commandId: "read-7", actionType: "web.dom.extract_list", extractList: { item: "li", fields: {}, minItems: 0 } };
const OBSERVED = { scriptsRan: 0, requestsLeaked: 0, navigationsHeld: 1, requestsRefused: 2, scrollsPastEnd: 1 };

function pageAnswering(evaluation: WebSnapshotPageEvaluation): WebSnapshotPage {
  return { evaluate: async () => evaluation };
}

test("an evaluated read passes through and is kept as its status, failure code, row count and the sandbox's counts", async () => {
  const result = { commandId: "read-7", actionType: "web.dom.extract_list", status: "failed", startedAt: 1, finishedAt: 2, extracted: [{ name: "secret row" }, { name: "another" }], failure: { code: "web.validation.output_not_observed" } } as unknown as WebAutomationActionResult;
  const evaluation: WebSnapshotPageEvaluation = { status: "evaluated", result, observations: OBSERVED };
  const recording = recordingSnapshotPage(pageAnswering(evaluation));
  assert.equal(await recording.page.evaluate(SNAPSHOT, READ), evaluation);
  const [kept] = recording.take();
  assert.deepEqual({ ...kept, ms: 0 }, {
    commandId: "read-7", actionType: "web.dom.extract_list", snapshot: "abcdef012345", status: "evaluated", reason: null,
    resultStatus: "failed", failureCode: "web.validation.output_not_observed", rows: 2, observations: OBSERVED, ms: 0,
  });
  assert.doesNotMatch(JSON.stringify(kept), /secret row/u);
  assert.deepEqual(recording.take(), [], "take() hands each evaluation over once");
});

test("an unavailable evaluation is kept as its reason only", async () => {
  const recording = recordingSnapshotPage(pageAnswering({ status: "unavailable", reason: "snapshot_unavailable", detail: "the content code failed on web.dom.extract_list: TypeError: page text here" }));
  await recording.page.evaluate(SNAPSHOT, READ);
  const [kept] = recording.take();
  assert.deepEqual([kept?.status, kept?.reason, kept?.resultStatus, kept?.rows, kept?.observations], ["unavailable", "snapshot_unavailable", null, null, null]);
  assert.doesNotMatch(JSON.stringify(kept), /page text/u);
});
