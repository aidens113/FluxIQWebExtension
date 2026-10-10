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
  assert.deepEqual(handled!.lifecycle, { event: "before", handlerId: `${NODE}.h1-s1`, handlerRef: `${NODE}.h1-s1`, disposition: "resume", completionCheck: "true" });
  assert.deepEqual(routed!.stateRouting, { outcome: "no_match", toNodeId: null, refused: [{ guard: "unbound_value", toNodeId: `${NODE}.s5` }] });
  assert.equal(odd!.status, "unknown");
  assert.equal(odd!.lifecycle, null);
  assert.equal(odd!.entry, null);
});

test("a handler id as Core writes it, graph then node, is read as its node id, and the whole reference is kept", () => {
  // The two graphs a hand-authored Flow stores handlers in: a block's own graph, and the recovery graph of an automation-wide handler (matrix rows 5 and 6, t404).
  const block = "flow.recovery-matrix.7.bootstrap.0123456789abcdef.store.graph";
  const recovery = "flow.recovery-matrix.7.bootstrap.0123456789abcdef.recovery.graph";
  const [inBlock, automationWide, unreadable] = matrixAttemptRecords({
    actionAttempts: [
      { order: 1, nodeId: `${NODE}.s1`, status: "succeeded", lifecycle: { event: "before", handlerId: `${block}/node.bootstrap.0123456789abcdef.store.h1-s1`, disposition: { kind: "resume" }, completionCheck: "true" } },
      { order: 2, nodeId: `${NODE}.s2`, status: "succeeded", lifecycle: { event: "before", handlerId: `${recovery}/node.bootstrap.0123456789abcdef.recovery.h1-s1`, disposition: { kind: "unhandled" }, completionCheck: "false" } },
      { order: 3, nodeId: `${NODE}.s3`, status: "succeeded", lifecycle: { event: "before", handlerId: `${block}/not a node`, disposition: { kind: "resume" } } },
    ],
  });
  assert.equal(inBlock!.lifecycle!.handlerId, "node.bootstrap.0123456789abcdef.store.h1-s1");
  assert.equal(inBlock!.lifecycle!.handlerRef, `${block}/node.bootstrap.0123456789abcdef.store.h1-s1`);
  assert.equal(automationWide!.lifecycle!.handlerId, "node.bootstrap.0123456789abcdef.recovery.h1-s1");
  assert.notEqual(automationWide!.lifecycle!.handlerRef, inBlock!.lifecycle!.handlerRef);
  assert.equal(unreadable!.lifecycle!.handlerId, null);
  assert.equal(unreadable!.lifecycle!.handlerRef, null);
});
