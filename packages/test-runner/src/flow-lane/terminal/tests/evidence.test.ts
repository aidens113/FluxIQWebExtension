import assert from "node:assert/strict";
import test from "node:test";
import * as flowLane from "../index.js";

// Namespace access makes the pre-implementation missing function an observed test failure.
const read = (detail: unknown): unknown => (flowLane as unknown as { terminalRunEvidenceOf(detail: unknown): unknown }).terminalRunEvidenceOf(detail);

test("known Core terminal reasons are categories, with opaque node identity and message presence only", () => {
  const message = "Node node.cart completed without an outgoing edge before the Flow visited every node. Add an edge to continue or an End node to finish explicitly.";
  const evidence = read({ metadata: { currentNodeId: "node.cart", terminalFailureReason: message, message } });
  assert.deepEqual(evidence, { terminalFailureReason: "graph.unvisited_nodes", currentNodeId: "node.cart", messagePresent: true });
  assert.equal(JSON.stringify(evidence).includes(message), false);
  assert.deepEqual(read({ metadata: { terminalFailureReason: "Recovery ladder exhausted all known recovery candidates." } }),
    { terminalFailureReason: "recovery.exhausted", currentNodeId: null, messagePresent: false });
});

test("unknown terminal free text and malformed IDs are withheld, never echoed or treated as codes", () => {
  const secret = "Bearer private-token; page account secret@example.test";
  const evidence = read({ metadata: { terminalFailureReason: secret, message: secret, currentNodeId: secret } });
  assert.deepEqual(evidence, { terminalFailureReason: "withheld_unrecognized", currentNodeId: null, messagePresent: true });
  assert.equal(JSON.stringify(evidence).includes(secret), false);
  assert.equal(JSON.stringify(evidence).includes("private-token"), false);
  assert.deepEqual(read({ metadata: { terminalFailureReason: "flow_draft.fake_terminal_code", message: 42, currentNodeId: "n".repeat(129) } }),
    { terminalFailureReason: "withheld_unrecognized", currentNodeId: null, messagePresent: false });
});

test("missing terminal metadata stays absent; message presence does not invent a reason", () => {
  for (const detail of [undefined, null, [], {}, { metadata: null }, { metadata: [] }, { metadata: { resultVerification: {} } }]) assert.equal(read(detail), undefined);
  assert.deepEqual(read({ metadata: { message: "private trace" } }), { terminalFailureReason: null, currentNodeId: null, messagePresent: true });
  assert.deepEqual(read({ metadata: { currentNodeId: "node.one", message: "" } }), { terminalFailureReason: null, currentNodeId: "node.one", messagePresent: false });
});

test("graph maximum-step and missing-target templates screen interpolated text into categories", () => {
  assert.deepEqual(read({ metadata: { terminalFailureReason: "Maximum step count exceeded: 500." } }), { terminalFailureReason: "graph.maximum_steps_exceeded", currentNodeId: null, messagePresent: false });
  assert.deepEqual(read({ metadata: { terminalFailureReason: "Edge edge.one points to missing node node.two." } }), { terminalFailureReason: "graph.missing_target_node", currentNodeId: null, messagePresent: false });
  assert.deepEqual(read({ metadata: { terminalFailureReason: "Maximum step count exceeded: private-page-text." } }), { terminalFailureReason: "withheld_unrecognized", currentNodeId: null, messagePresent: false });
});
