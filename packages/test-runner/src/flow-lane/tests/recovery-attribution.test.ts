import assert from "node:assert/strict";
import test from "node:test";
import { assertRecoveryAsDeclared, recoveryAttribution, recoveryAttributionSnapshot } from "../recovery-attribution.js";
import type { PersistedFlowAction } from "../persisted-flow-run.js";

/** One attempt as the lane reads it, with only what the attribution looks at stated. */
function attempt(input: Partial<PersistedFlowAction> & { nodeId: string | null; attemptIndex: number }): PersistedFlowAction {
  return {
    actionType: "web.dom.click",
    status: "succeeded",
    startedAt: new Date(input.attemptIndex * 1_000).toISOString(),
    failure: null,
    ...input,
  };
}

test("a node the ladder retried is joined back into one node, and the rung that asked for the winning attempt is what absorbed it", () => {
  const attribution = recoveryAttribution([
    attempt({ nodeId: "node-wait", attemptIndex: 0, actionType: "web.dom.wait_for_selector", status: "failed" }),
    attempt({ nodeId: "node-wait", attemptIndex: 1, actionType: "web.dom.wait_for_selector", status: "succeeded", retry: { attemptNumber: 2, maxAttempts: 3, backoffMs: 250, rung: "retry_node" } }),
  ]);

  assert.deepEqual(attribution.nodes.map(({ nodeId, attempts }) => ({ nodeId, attempts })), [{ nodeId: "node-wait", attempts: 2 }]);
  assert.deepEqual(attribution.resolvedBy, ["retry_node"]);
  assert.deepEqual(attribution.rungsRun, ["retry_node"]);
  assert.equal(attribution.maxAttemptsPerNode, 2);
});

test("a rung that ran and did not settle it is reported as run, and the one that did is what absorbed it", () => {
  const attribution = recoveryAttribution([
    attempt({ nodeId: "node-click", attemptIndex: 0, status: "failed" }),
    attempt({ nodeId: "node-click", attemptIndex: 1, status: "failed", retry: { attemptNumber: 2, maxAttempts: 3, backoffMs: 250, rung: "await_recorded_state" } }),
    attempt({ nodeId: "node-click", attemptIndex: 2, status: "succeeded", retry: { attemptNumber: 3, maxAttempts: 3, backoffMs: 1_000, rung: "retry_node" } }),
  ]);

  assert.deepEqual(attribution.rungsRun, ["await_recorded_state", "retry_node"]);
  assert.deepEqual(attribution.resolvedBy, ["retry_node"]);
});

test("a node the browser found another way is absorbed by the resolution that has no rung, on its first attempt", () => {
  const attribution = recoveryAttribution([
    attempt({ nodeId: "node-submit", attemptIndex: 0, hostTargetResolution: { strategy: "scored-candidate", candidateCount: 3, confidence: 0.37 } }),
  ]);

  assert.deepEqual(attribution.resolvedBy, ["host_target_resolution"]);
  assert.deepEqual(attribution.rungsRun, []);
  assert.equal(attribution.maxAttemptsPerNode, 1);
});

test("a node the recorded selector matched outright recovered nothing, which is what a control condition must show", () => {
  const attribution = recoveryAttribution([attempt({ nodeId: "node-submit", attemptIndex: 0, hostTargetResolution: { strategy: "selector", candidateCount: 1 } })]);

  assert.deepEqual(attribution.resolvedBy, []);
  assert.equal(attribution.nodes[0]?.resolvedBy, "none");
});

test("a node nothing rescued is not reported as absorbed, however many rungs were tried on it", () => {
  const attribution = recoveryAttribution([
    attempt({ nodeId: "node-click", attemptIndex: 0, status: "failed" }),
    attempt({ nodeId: "node-click", attemptIndex: 1, status: "failed", retry: { attemptNumber: 2, maxAttempts: 3, backoffMs: 250, rung: "retry_node" } }),
    attempt({ nodeId: "node-click", attemptIndex: 2, status: "failed", retry: { attemptNumber: 3, maxAttempts: 3, backoffMs: 1_000, rung: "retry_node" } }),
  ]);

  assert.deepEqual(attribution.rungsRun, ["retry_node"]);
  assert.deepEqual(attribution.resolvedBy, []);
  assert.equal(attribution.maxAttemptsPerNode, 3);
});

test("attempts that name no node are each their own node, so unnamed attempts never fold into one busy node", () => {
  const attribution = recoveryAttribution([
    attempt({ nodeId: null, attemptIndex: 0 }),
    attempt({ nodeId: null, attemptIndex: 1 }),
  ]);

  assert.equal(attribution.nodes.length, 2);
  assert.equal(attribution.maxAttemptsPerNode, 1);
});

test("a declaration of the rung that absorbed it passes, and one naming a different rung fails with both in the message", () => {
  const attribution = recoveryAttribution([
    attempt({ nodeId: "node-wait", attemptIndex: 0, status: "failed" }),
    attempt({ nodeId: "node-wait", attemptIndex: 1, retry: { attemptNumber: 2, maxAttempts: 3, backoffMs: 250, rung: "retry_node" } }),
  ]);

  assertRecoveryAsDeclared({ absorbedBy: "retry_node", because: "the wait is attempted again" }, attribution);
  assert.throws(
    () => assertRecoveryAsDeclared({ absorbedBy: "clear_interference", because: "an overlay is cleared" }, attribution),
    /clear_interference absorbs this run .*and retry_node did/u,
  );
});

test("a run nothing had to recover fails a declaration that named a rung, and passes one that declared none", () => {
  const attribution = recoveryAttribution([attempt({ nodeId: "node-submit", attemptIndex: 0 })]);

  assert.throws(() => assertRecoveryAsDeclared({ absorbedBy: "retry_node", because: "the node is attempted again" }, attribution), /nothing did/u);
  assertRecoveryAsDeclared({ absorbedBy: "none", because: "nothing absorbs it" }, attribution);
});

test("a run that recovered something fails a declaration that nothing would, so a fixture cannot quietly stop being adversarial", () => {
  const attribution = recoveryAttribution([attempt({ nodeId: "node-submit", attemptIndex: 0, hostTargetResolution: { strategy: "fingerprint", candidateCount: 2 } })]);

  assert.throws(() => assertRecoveryAsDeclared({ absorbedBy: "none", because: "nothing absorbs it" }, attribution), /nothing recovers this run .*and host_target_resolution did/u);
});

test("the declared attempt ceiling fails a run that took more, though the declared rung answered", () => {
  const attribution = recoveryAttribution([
    attempt({ nodeId: "node-wait", attemptIndex: 0, status: "failed" }),
    attempt({ nodeId: "node-wait", attemptIndex: 1, status: "failed", retry: { attemptNumber: 2, maxAttempts: 3, backoffMs: 250, rung: "retry_node" } }),
    attempt({ nodeId: "node-wait", attemptIndex: 2, retry: { attemptNumber: 3, maxAttempts: 3, backoffMs: 1_000, rung: "retry_node" } }),
  ]);

  assertRecoveryAsDeclared({ absorbedBy: "retry_node", because: "the wait is attempted again" }, attribution);
  assert.throws(() => assertRecoveryAsDeclared({ absorbedBy: "retry_node", because: "once is enough", maxAttemptsPerNode: 2 }, attribution), /at most 2 attempt\(s\).*took 3/u);
});

test("no declaration judges nothing, so every scenario that declares none runs as it did", () => {
  assertRecoveryAsDeclared(undefined, recoveryAttribution([attempt({ nodeId: "node-submit", attemptIndex: 0, status: "failed" })]));
});

test("the snapshot carries node ids, closed rung names and counts, and nothing else", () => {
  const snapshot = recoveryAttributionSnapshot(recoveryAttribution([
    attempt({ nodeId: "node-wait", attemptIndex: 0, status: "failed" }),
    attempt({ nodeId: "node-wait", attemptIndex: 1, retry: { attemptNumber: 2, maxAttempts: 3, backoffMs: 250, rung: "retry_node" }, hostTargetResolution: { strategy: "selector", candidateCount: 1 } }),
  ]));

  assert.deepEqual(snapshot, {
    resolvedBy: ["retry_node"],
    rungsRun: ["retry_node"],
    maxAttemptsPerNode: 2,
    nodes: [{ nodeId: "node-wait", actionType: "web.dom.click", attempts: 2, succeeded: true, resolvedBy: "retry_node", rungsRun: ["retry_node"], hostStrategy: "selector" }],
  });
});
