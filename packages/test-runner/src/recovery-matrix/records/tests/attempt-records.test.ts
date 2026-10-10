import assert from "node:assert/strict";
import test from "node:test";
import { matrixAttemptRecords } from "../attempt-records.js";

const NODE = "node.bootstrap.0123456789abcdef.main";

test("attempts are read in Core's order, with only closed words and ids kept", () => {
  const records = matrixAttemptRecords({
    actionAttempts: [
      { order: 2, nodeId: `${NODE}.s2`, status: "failed", failure: { category: "target_not_found", code: "web.target.not_found", expected: "page text that must not leave" }, metadata: { retry: { attempt: 2 } } },
      { order: 1, nodeId: `${NODE}.s1`, definitionId: "web.output.dom-click", status: "succeeded", entry: { kind: "default", evidence: "page words" } },
    ],
  });
  assert.deepEqual(records.map(record => record.nodeId), [`${NODE}.s1`, `${NODE}.s2`]);
  assert.deepEqual(records[0]!.entry, { kind: "default", id: null });
  assert.deepEqual(records[1]!.failure, { category: "target_not_found", code: "web.target.not_found" });
  assert.equal(records[1]!.retry, true);
  assert.ok(!JSON.stringify(records).includes("page"));
});

test("lifecycle and routing records are read from the attempt or its metadata, and unknown words are dropped", () => {
  const [handled, routed, odd] = matrixAttemptRecords({
    actionAttempts: [
      { order: 1, nodeId: `${NODE}.s1`, status: "succeeded", metadata: { lifecycle: { event: "before", handlerId: `${NODE}.h1-s1`, disposition: { kind: "resume" }, completionCheck: { result: true }, conditionEvidence: "words" } } },
      { order: 2, nodeId: `${NODE}.s3`, status: "failed", stateRouting: { outcome: "no_match", refused: [{ guard: "unbound_value", toNodeId: `${NODE}.s5` }, { guard: "made-up", toNodeId: `${NODE}.s6` }] } },
      { order: 3, nodeId: `${NODE}.s4`, status: "strange", lifecycle: { event: "whenever" }, entry: { kind: "teleport" } },
    ],
  });
  assert.deepEqual(handled!.lifecycle, { event: "before", handlerId: `${NODE}.h1-s1`, disposition: "resume", completionCheck: "true" });
  assert.deepEqual(routed!.stateRouting, { outcome: "no_match", toNodeId: null, refused: [{ guard: "unbound_value", toNodeId: `${NODE}.s5` }] });
  assert.equal(odd!.status, "unknown");
  assert.equal(odd!.lifecycle, null);
  assert.equal(odd!.entry, null);
});
