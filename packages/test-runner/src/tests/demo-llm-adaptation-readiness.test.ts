import assert from "node:assert/strict";
import test from "node:test";
import { demoLlmAdaptationReadinessFailureCode, inspectDemoLlmAdaptationReadiness } from "../demo-llm-adaptation-readiness.js";

function fixture(): any {
  const projectId = "project.web";
  const flowId = "flow.builder";
  const graphFlowId = "flow.generated";
  const parent = { flowId, projectId, name: "Builder", updatedAt: 2, contentHash: "hash.parent", document: { nodes: [], edges: [], metadata: { flowRepresentationKind: "orchestration" } } };
  const graph = { flowId: graphFlowId, projectId, name: "Generated", updatedAt: 3, contentHash: "hash.graph", document: { nodes: [
    { id: "start", definitionId: "builtin.control.start", parameterValues: { label: "Start" } },
    { id: "type", definitionId: "web.output.dom-type", parameterValues: { selector: "discarded", text: "discarded" } },
    { id: "end", definitionId: "builtin.control.end", parameterValues: { resultStatus: "succeeded" } },
  ], edges: [{ id: "one" }, { id: "two" }], metadata: { parentFlowId: flowId } } };
  const summary = { runId: "run.baseline", projectId, flowId, status: "succeeded", routeDecisionCount: 1, subflowEntryCount: 1, actionAttemptCount: 3, interventionCount: 0, adaptationCount: 0, updatedAt: 10 };
  const run = { summary, routeDecisions: [], subflows: [], actionAttempts: ["start", "type", "end"].map((nodeId, order) => ({ attemptId: `attempt.${order}`, nodeId, definitionId: order === 1 ? "web.output.dom-type" : `builtin.control.${order ? "end" : "start"}`, order, status: "succeeded", startedAt: order + 1 })), interventions: [], adaptationIds: [], changeProposalIds: [], providerCallCount: 0 };
  const control = {
    requireProject: async () => ({ id: projectId }),
    getExactFlow: async (_projectId: string, requestedFlowId: string) => requestedFlowId === flowId ? parent : graph,
    listFlowAdaptations: async () => [{ adaptationId: "adaptation.bootstrap", projectId, flowId, status: "applied" }],
    getFlowAdaptation: async () => ({ adaptationId: "adaptation.bootstrap", projectId, flowId, status: "applied", adaptationKind: "flow_bootstrap", bootstrapBinding: { baseExecutionDigest: "digest.blank", appliedExecutionDigest: "digest.generated", currentExecutionDigest: "digest.generated", baseSettingsRevision: 2, currentSettingsRevision: 3 } }),
    listFlowSubflows: async () => [{ subflowId: "subflow.generated", flowId, projectId, graphFlowId, name: "Generated", status: "active", role: "primary" }],
    getFlowRouter: async () => ({ routerId: "router.generated", flowId, projectId, rules: [{ ruleId: "rule.generated", target: { kind: "subflow", subflowId: "subflow.generated" } }] }),
    listNativeNodeDefinitions: async () => [
      { id: "builtin.control.start", version: "1", sourceKind: "builtin", executable: true, externalSideEffect: false },
      { id: "web.output.dom-type", version: "1", sourceKind: "importer", sourceDomainId: "web-automation", executable: true, externalSideEffect: false },
      { id: "builtin.control.end", version: "1", sourceKind: "builtin", executable: true, externalSideEffect: false },
    ],
    listFlowRuns: async () => [summary],
    getRunDetail: async () => run,
  };
  return { control, scope: { projectId, flowId }, graph, run };
}

test("reports only sanitized structural facts for a zero-LLM instruction-only adaptation baseline", async () => {
  const { control, scope } = fixture();
  const result = await inspectDemoLlmAdaptationReadiness(control, scope);
  assert.deepEqual(result, {
    status: "passed", providerCallCount: 0, projectId: "project.web", flowId: "flow.builder", graphFlowId: "flow.generated",
    subflowId: "subflow.generated", routerId: "router.generated", bootstrapAdaptationId: "adaptation.bootstrap",
    currentExecutionDigest: "digest.generated", baselineRunId: "run.baseline", recordingCount: 0, nodeCount: 3, edgeCount: 2,
    actionAttemptCount: 3, adaptableTargetCount: 1,
    adaptableTargets: [{ nodeId: "type", definitionId: "web.output.dom-type", parameterKeys: ["selector", "text"] }],
  });
  assert.equal(JSON.stringify(result).includes("discarded"), false);
});

test("accepts a current execution digest changed only by bounded post-bootstrap Flow settings", async () => {
  const value = fixture();
  value.control.getFlowAdaptation = async () => ({
    adaptationId: "adaptation.bootstrap", projectId: value.scope.projectId, flowId: value.scope.flowId,
    status: "applied", adaptationKind: "flow_bootstrap",
    bootstrapBinding: { baseExecutionDigest: "digest.blank", appliedExecutionDigest: "digest.generated", currentExecutionDigest: "digest.settings", baseSettingsRevision: 2, currentSettingsRevision: 4 },
  });
  const result = await inspectDemoLlmAdaptationReadiness(value.control, value.scope);
  assert.equal(result.currentExecutionDigest, "digest.settings");
});

test("reuses the newest qualifying deterministic baseline after a failed adaptation attempt", async () => {
  const value = fixture();
  value.control.listFlowRuns = async () => [
    { ...value.run.summary, runId: "run.failed-adaptation", status: "failed", updatedAt: 20 },
    value.run.summary,
  ];
  const result = await inspectDemoLlmAdaptationReadiness(value.control, value.scope);
  assert.equal(result.baselineRunId, "run.baseline");
});

test("allows only the exact pending runtime proposal when resuming review", async () => {
  const value = fixture();
  value.control.listFlowAdaptations = async () => [
    { adaptationId: "adaptation.bootstrap", projectId: value.scope.projectId, flowId: value.scope.flowId, status: "applied" },
    { adaptationId: "adaptation.resume", projectId: value.scope.projectId, flowId: value.scope.flowId, status: "proposed" },
  ];
  await assert.doesNotReject(() => inspectDemoLlmAdaptationReadiness(value.control, value.scope, { allowPendingAdaptationId: "adaptation.resume" }));
  await assert.rejects(() => inspectDemoLlmAdaptationReadiness(value.control, value.scope, { allowPendingAdaptationId: "adaptation.other" }), /unrelated pending/i);
});

test("fails closed for recordings, pending adaptations, assisted runs, and targetless generated actions", async () => {
  for (const mutate of [
    (value: any) => { value.graph.document.metadata.lastRecordingId = "discarded"; },
    (value: any) => { value.control.listFlowAdaptations = async () => [{ adaptationId: "adaptation.pending", projectId: value.scope.projectId, flowId: value.scope.flowId, status: "proposed" }]; },
    (value: any) => { value.run.providerCallCount = 1; },
    (value: any) => { value.graph.document.nodes[1].parameterValues = { text: "discarded" }; },
  ]) {
    const value = fixture();
    mutate(value);
    await assert.rejects(() => inspectDemoLlmAdaptationReadiness(value.control, value.scope), /recording|pending|zero-LLM|selector-bound/i);
  }
});

test("fails closed when public endpoints return a different topology or registry", async () => {
  for (const mutate of [
    (value: any) => { value.control.listFlowSubflows = async () => []; },
    (value: any) => { value.control.getFlowRouter = async () => null; },
    (value: any) => { value.control.listNativeNodeDefinitions = async () => []; },
  ]) {
    const value = fixture();
    mutate(value);
    await assert.rejects(() => inspectDemoLlmAdaptationReadiness(value.control, value.scope), /Subflow|Router|absent from the current runtime registry/i);
  }
});

test("projects only closed categorical readiness failures", async () => {
  const value = fixture();
  value.graph.document.metadata.lastRecordingId = "discarded";
  await assert.rejects(async () => {
    try { await inspectDemoLlmAdaptationReadiness(value.control, value.scope); }
    catch (error) {
      assert.equal(demoLlmAdaptationReadinessFailureCode(error), "adaptation_readiness.recordings_present");
      throw error;
    }
  });
  assert.equal(demoLlmAdaptationReadinessFailureCode(new Error("arbitrary secret-like detail")), "adaptation_readiness.unknown");
});

test("accepts the two Core control sentinels outside the domain registry but rejects other absent definitions", async () => {
  const value = fixture();
  value.control.listNativeNodeDefinitions = async () => [(await fixture().control.listNativeNodeDefinitions())[1]];
  await assert.doesNotReject(() => inspectDemoLlmAdaptationReadiness(value.control, value.scope));
  value.graph.document.nodes[0].definitionId = "builtin.control.unknown";
  await assert.rejects(() => inspectDemoLlmAdaptationReadiness(value.control, value.scope), /absent from the current runtime registry/);
});
