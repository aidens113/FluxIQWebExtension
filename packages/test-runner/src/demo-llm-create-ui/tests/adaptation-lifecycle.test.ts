// What the Testing Lab does to an adaptation on either side of the paid call,
// through a stubbed control client and no provider at all: reject the one
// stale proposal left by an earlier run, then read back what applying a
// proposal actually built. Both halves are a pair of rows -- the one that
// accepts, and the negative control beside it that proves the acceptance is
// not a rubber stamp. Cleanup fails closed on an ambiguous list or on an
// adaptation that is not a Flow bootstrap; the topology inspector refuses
// generated nodes whose positions overlap, which is the shape a real
// mis-generated graph takes.

import assert from "node:assert/strict";
import test from "node:test";
import { inspectAppliedCreation, parseAppliedExecutionDigest, rejectStalePendingCreationAdaptation } from "../index.js";

test("stale creation cleanup rejects only one exact pending Flow bootstrap proposal", async () => {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const control = {
    listFlowAdaptations: async (...args: unknown[]) => { calls.push({ method: "list", args }); return [{ adaptationId: "adaptation.pending", projectId: "project.one", flowId: "flow.one", status: "proposed" }]; },
    getFlowAdaptation: async (...args: unknown[]) => { calls.push({ method: "get", args }); return { adaptationId: "adaptation.pending", projectId: "project.one", flowId: "flow.one", status: "proposed", adaptationKind: "flow_bootstrap" }; },
    rejectFlowAdaptation: async (...args: unknown[]) => { calls.push({ method: "reject", args }); return { adaptationId: "adaptation.pending", projectId: "project.one", flowId: "flow.one", status: "rejected", adaptationKind: "flow_bootstrap" }; },
  };
  assert.equal(await rejectStalePendingCreationAdaptation(control as never, "project.one", "flow.one", "test-pin"), 1);
  assert.deepEqual(calls, [
    { method: "list", args: ["project.one", "flow.one", "proposed"] },
    { method: "get", args: ["project.one", "flow.one", "adaptation.pending"] },
    { method: "reject", args: [{ projectId: "project.one", flowId: "flow.one", adaptationId: "adaptation.pending", authorizationPin: "test-pin", reason: "Testing Lab stale pending creation cleanup" }] },
  ]);
});

test("stale creation cleanup is a no-op when clear and fails closed on ambiguity or another adaptation kind", async () => {
  const clear = { listFlowAdaptations: async () => [], getFlowAdaptation: async () => { throw new Error("unreachable"); }, rejectFlowAdaptation: async () => { throw new Error("unreachable"); } };
  assert.equal(await rejectStalePendingCreationAdaptation(clear as never, "project.one", "flow.one", "test-pin"), 0);
  const ambiguous = { ...clear, listFlowAdaptations: async () => [{}, {}] };
  await assert.rejects(() => rejectStalePendingCreationAdaptation(ambiguous as never, "project.one", "flow.one", "test-pin"), /at most one/);
  const wrongKind = {
    ...clear,
    listFlowAdaptations: async () => [{ adaptationId: "adaptation.pending" }],
    getFlowAdaptation: async () => ({ adaptationId: "adaptation.pending", status: "proposed", adaptationKind: "runtime_patch" }),
  };
  await assert.rejects(() => rejectStalePendingCreationAdaptation(wrongKind as never, "project.one", "flow.one", "test-pin"), /not a Flow bootstrap/);
});

test("applied topology inspector accepts registered structural nodes around executable actions", async () => {
  const flow = (flowId: string, nodes: unknown[] = [], edges: unknown[] = []) => ({ flowId, projectId: "project.one", name: flowId, updatedAt: 1, contentHash: "hash." + flowId, document: { nodes, edges, metadata: { flowRepresentationKind: flowId === "flow.one" ? "orchestration" : "subflow" } } });
  const control = {
    listFlowSubflows: async () => [
      { projectId: "project.one", flowId: "flow.one", subflowId: "subflow.one", graphFlowId: "graph.one", name: "Generated", status: "active", role: "primary" },
      { projectId: "project.one", flowId: "flow.one", subflowId: "subflow.utility", graphFlowId: "graph.utility", name: "Utility", status: "active", role: "utility" },
    ],
    getFlowRouter: async () => ({ routerId: "router.one", projectId: "project.one", flowId: "flow.one", fallback: { kind: "subflow", subflowId: "subflow.one" }, rules: [{ target: { kind: "subflow", subflowId: "subflow.utility" } }] }),
    getExactFlow: async (_projectId: string, flowId: string) => flowId === "graph.one" ? flow(flowId, [{ nodeId: "node.start", definitionId: "builtin.control.start" }, { nodeId: "node.one", definitionId: "web.fill" }, { nodeId: "node.end", definitionId: "builtin.control.end" }], [{ edgeId: "edge.one" }, { edgeId: "edge.two" }]) : flow(flowId),
    getFlowGraphViewport: async () => ({ graphRevision: 1, nodes: [{ nodeId: "node.start", x: 0, y: 0 }, { nodeId: "node.one", x: 300, y: 0 }, { nodeId: "node.end", x: 600, y: 0 }], edgeIds: ["edge.one", "edge.two"], nodeCount: 3, edgeCount: 2 }),
    listNativeNodeDefinitions: async () => [{ id: "web.fill", version: "1", sourceKind: "importer", executable: true, externalSideEffect: false }],
  };
  const result = await inspectAppliedCreation(control as never, "project.one", "flow.one", "base.digest", "result.digest");
  assert.equal(result.ownedSubflowId, "subflow.one");
  assert.equal(result.executableNodeCount, 1);
  assert.equal(result.overlappingPositionCount, 0);
});

test("applied topology inspector rejects overlapping generated nodes", async () => {
  const control = {
    listFlowSubflows: async () => [{ projectId: "project.one", flowId: "flow.one", subflowId: "subflow.one", graphFlowId: "graph.one", name: "Generated", status: "active", role: "primary" }],
    getFlowRouter: async () => ({ routerId: "router.one", projectId: "project.one", flowId: "flow.one", fallback: { kind: "subflow", subflowId: "subflow.one" }, rules: [] }),
    getExactFlow: async (_projectId: string, flowId: string) => ({ flowId, projectId: "project.one", name: flowId, updatedAt: 1, contentHash: "hash." + flowId, document: { nodes: flowId === "graph.one" ? [{ nodeId: "one", definitionId: "web.click" }, { nodeId: "two", definitionId: "web.click" }] : [], edges: flowId === "graph.one" ? [{ edgeId: "edge" }] : [], metadata: {} } }),
    getFlowGraphViewport: async () => ({ graphRevision: 1, nodes: [{ nodeId: "one", x: 0, y: 0 }, { nodeId: "two", x: 10, y: 10 }], edgeIds: ["edge"], nodeCount: 2, edgeCount: 1 }),
    listNativeNodeDefinitions: async () => [{ id: "web.click", version: "1", sourceKind: "importer", executable: true, externalSideEffect: false }],
  };
  await assert.rejects(() => inspectAppliedCreation(control as never, "project.one", "flow.one", "base.digest", "result.digest"), /positions overlap/u);
});
test("canonical apply digest requires exact sanitized Core bootstrap binding", () => {
  const body = { ok: true, payload: { adaptation: { metadata: { adaptationKind: "flow_bootstrap", bootstrap: { baseExecutionDigest: "base.digest", currentExecutionDigest: "result.digest", baseSettingsRevision: 1, currentSettingsRevision: 2, application: { appliedExecutionDigest: "result.digest" } } } } } };
  assert.equal(parseAppliedExecutionDigest(body, true, "base.digest"), "result.digest");
  assert.throws(() => parseAppliedExecutionDigest({ ...body, payload: { adaptation: { metadata: { adaptationKind: "flow_bootstrap", bootstrap: { ...body.payload.adaptation.metadata.bootstrap, currentSettingsRevision: 1 } } } } }, true, "base.digest"), /advance the Core settings revision/u);
  assert.throws(() => parseAppliedExecutionDigest({ ...body, payload: { adaptation: { metadata: { adaptationKind: "flow_bootstrap", bootstrap: { ...body.payload.adaptation.metadata.bootstrap, currentExecutionDigest: "other.digest" } } } } }, true, "base.digest"), /exact changed canonical Core execution binding/u);
  assert.throws(() => parseAppliedExecutionDigest({ ok: true, payload: { adaptation: { metadata: { adaptationKind: "flow_bootstrap", bootstrap: { baseExecutionDigest: "base.digest", currentExecutionDigest: "result.digest" } } } } }, true, "base.digest"), /malformed/u);
});
