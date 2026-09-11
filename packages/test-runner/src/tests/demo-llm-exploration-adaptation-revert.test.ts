import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { rejectExactPendingExplorationTargetAdaptation, revertExactAppliedExplorationTargetAdaptation } from "../demo-llm-exploration-adaptation-revert.js";

const repositoryRoot = path.resolve(import.meta.dirname, "../../../..");

function fixture() {
  const flow = {
    flowId: "flow.checkpoint", name: "Website Exploration Checkpoint newest",
    sourceMode: "visual", nodeCount: 0, edgeCount: 0, updatedAt: 10,
  };
  const bootstrap = {
    projectId: "project.one", flowId: flow.flowId, adaptationId: "adaptation.bootstrap",
    status: "applied", adaptationKind: "flow_bootstrap",
    evidenceLoop: { providerCallCount: 1, iterationCount: 2, toolCallCount: 1, evidenceBytes: 700, toolIds: ["web.inspect_current_page"] },
    accounting: { provider: "deepseek", model: "deepseek-chat", inputTokens: 100, outputTokens: 40, totalTokens: 140 },
    bootstrapBinding: { baseExecutionDigest: "digest.blank", appliedExecutionDigest: "digest.created", currentExecutionDigest: "digest.adapted" },
  };
  const target = {
    projectId: "project.one", flowId: flow.flowId, subflowId: "subflow.one",
    adaptationId: "adaptation.target", sourceRunId: "run.failed", status: "applied",
    adaptationKind: "runtime_patch", patchKinds: ["edit_action_target"],
    validationSucceededCount: 1, validationFailedCount: 0, appliedMutationCount: 1,
  };
  const calls: Array<Record<string, unknown>> = [];
  const control = {
    listFlowSummaries: async () => [flow],
    listFlowAdaptations: async (_projectId: string, _flowId: string, status?: string) => {
      const values = [bootstrap, target];
      return values.filter(value => status === undefined || value.status === status)
        .map(value => ({ projectId: value.projectId, flowId: value.flowId, adaptationId: value.adaptationId, status: value.status }));
    },
    getFlowAdaptation: async (_projectId: string, _flowId: string, adaptationId: string) =>
      adaptationId === bootstrap.adaptationId ? bootstrap : target,
    listFlowSubflows: async () => [{ projectId: "project.one", flowId: flow.flowId, subflowId: "subflow.one", graphFlowId: "flow.graph", name: "Generated", status: "active", role: "primary" }],
    getFlowRouter: async () => ({ projectId: "project.one", flowId: flow.flowId, routerId: "router.one", fallback: { kind: "subflow", subflowId: "subflow.one" }, rules: [] }),
    getRunDetail: async () => ({
      summary: { runId: "run.failed", projectId: "project.one", flowId: flow.flowId, status: "failed", routeDecisionCount: 1, subflowEntryCount: 1, actionAttemptCount: 1, updatedAt: 1 },
      routeDecisions: [], subflows: [], actionAttempts: [{ attemptId: "attempt.one", nodeId: "node.one", definitionId: "web.output.dom-type", order: 1, status: "failed", startedAt: 1 }],
      interventions: [{ interventionId: "i1", kind: "diagnosis" }, { interventionId: "i2", kind: "runtime_patch" }],
      adaptationIds: [target.adaptationId], changeProposalIds: [target.adaptationId], providerCallCount: 2,
    }),
    rejectFlowAdaptation: async (input: Record<string, unknown>) => {
      calls.push(input);
      return { ...target, status: "rejected", appliedMutationCount: 0 };
    },
    revertFlowAdaptation: async (input: Record<string, unknown>) => {
      calls.push(input);
      return { ...target, status: "reverted" };
    },
  };
  return { control, bootstrap, target, calls };
}

test("reverts exactly one target edit on the latest evidence-guided exploration Flow", async () => {
  const { control, calls } = fixture();
  const result = await revertExactAppliedExplorationTargetAdaptation(control as any, "project.one", "test-pin");
  assert.deepEqual(result, {
    status: "reverted", projectId: "project.one", flowId: "flow.checkpoint",
    subflowId: "subflow.one", adaptationId: "adaptation.target", providerCallCount: 0,
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.authorizationPin, "test-pin");
  assert.equal(calls[0]?.adaptationId, "adaptation.target");
});

test("fails closed on ambiguous, cross-Subflow, and wrong-patch applied state", async () => {
  const ambiguous = fixture();
  const originalList = ambiguous.control.listFlowAdaptations;
  ambiguous.control.listFlowAdaptations = async (projectId, flowId, status) => [
    ...(await originalList(projectId, flowId, status)),
    ...(status === undefined || status === "applied" ? [{ projectId, flowId, adaptationId: "adaptation.second", status: "applied" }] : []),
  ];
  const originalGet = ambiguous.control.getFlowAdaptation;
  ambiguous.control.getFlowAdaptation = async (projectId, flowId, adaptationId) => adaptationId === "adaptation.second"
    ? { ...ambiguous.target, adaptationId }
    : originalGet(projectId, flowId, adaptationId);
  await assert.rejects(() => revertExactAppliedExplorationTargetAdaptation(ambiguous.control as any, "project.one", "pin"), /one applied ordinary/u);
  assert.equal(ambiguous.calls.length, 0);

  for (const change of [
    { subflowId: "subflow.other" },
    { patchKinds: ["edit_instruction"] },
  ]) {
    const scoped = fixture();
    scoped.control.getFlowAdaptation = async (_projectId, _flowId, adaptationId) =>
      adaptationId === scoped.bootstrap.adaptationId ? scoped.bootstrap : { ...scoped.target, ...change };
    await assert.rejects(() => revertExactAppliedExplorationTargetAdaptation(scoped.control as any, "project.one", "pin"), /unexpected scope/u);
    assert.equal(scoped.calls.length, 0);
  }
});

test("rejects exactly one inert proposed target edit with a bounded two-call source run", async () => {
  const pending = fixture();
  pending.target.status = "proposed";
  pending.target.appliedMutationCount = 0;
  pending.bootstrap.bootstrapBinding.currentExecutionDigest = "digest.created";
  pending.control.rejectFlowAdaptation = async input => {
    pending.calls.push(input);
    return { ...pending.target, status: "rejected" };
  };
  const result = await rejectExactPendingExplorationTargetAdaptation(pending.control as any, "project.one", "test-pin");
  assert.deepEqual(result, {
    status: "rejected", projectId: "project.one", flowId: "flow.checkpoint",
    subflowId: "subflow.one", adaptationId: "adaptation.target", providerCallCount: 0,
  });
  assert.equal(pending.calls.length, 1);
  assert.equal(pending.calls[0]?.authorizationPin, "test-pin");
});

test("reject fails closed before mutation on bad source-run or nonzero mutation state", async () => {
  const badRun = fixture();
  badRun.target.status = "proposed";
  badRun.target.appliedMutationCount = 0;
  badRun.control.getRunDetail = async () => ({ ...(await fixture().control.getRunDetail()), providerCallCount: 1 });
  await assert.rejects(() => rejectExactPendingExplorationTargetAdaptation(badRun.control as any, "project.one", "pin"), /source run/u);
  assert.equal(badRun.calls.length, 0);

  const mutated = fixture();
  mutated.target.status = "proposed";
  await assert.rejects(() => rejectExactPendingExplorationTargetAdaptation(mutated.control as any, "project.one", "pin"), /unexpected scope/u);
  assert.equal(mutated.calls.length, 0);
});

test("command is provider-free and does not use prepared or saved Flow state", async () => {
  const manifest = JSON.parse(await readFile(path.join(repositoryRoot, "package.json"), "utf8")) as { scripts: Record<string, string> };
  assert.equal(manifest.scripts["demo:llm:explore:adapt:revert"], "node scripts/revert-demo-llm-exploration-adaptation.mjs");
  const launcher = await readFile(path.join(repositoryRoot, "scripts/revert-demo-llm-exploration-adaptation.mjs"), "utf8");
  assert.match(launcher, /withoutProviderSecrets/u);
  assert.doesNotMatch(launcher, /DEEPSEEK_API_KEY|error\.message|String\(error\)/u);
  const workspace = await readFile(path.join(repositoryRoot, "packages/test-runner/src/demo-workspace/exploration-adaptation.ts"), "utf8");
  const start = workspace.indexOf("export async function runDemoLlmExplorationAdaptationRevert");
  assert.notEqual(start, -1);
  const end = workspace.indexOf("export async function", start + 40);
  const body = workspace.slice(start, end);
  assert.match(body, /listProjects\("web-automation"\)/u);
  assert.match(body, /revertExactAppliedExplorationTargetAdaptation/u);
  assert.doesNotMatch(body, /loadBlankLlmPreparationState|loadDemoWorkspaceState|runAdaptationFromPanel|DeepSeek/u);
});

test("reject launcher is provider-free and does not use prepared or saved Flow state", async () => {
  const manifest = JSON.parse(await readFile(path.join(repositoryRoot, "package.json"), "utf8")) as { scripts: Record<string, string> };
  assert.equal(manifest.scripts["demo:llm:explore:adapt:reject"], "node scripts/reject-demo-llm-exploration-adaptation.mjs");
  const launcher = await readFile(path.join(repositoryRoot, "scripts/reject-demo-llm-exploration-adaptation.mjs"), "utf8");
  assert.match(launcher, /withoutProviderSecrets/u);
  assert.doesNotMatch(launcher, /DEEPSEEK_API_KEY|error\.message|String\(error\)/u);
  const workspace = await readFile(path.join(repositoryRoot, "packages/test-runner/src/demo-workspace/exploration-adaptation.ts"), "utf8");
  const start = workspace.indexOf("export async function runDemoLlmExplorationAdaptationReject");
  assert.notEqual(start, -1);
  const end = workspace.indexOf("export async function", start + 40);
  const body = workspace.slice(start, end);
  assert.match(body, /listProjects\("web-automation"\)/u);
  assert.match(body, /rejectExactPendingExplorationTargetAdaptation/u);
  assert.doesNotMatch(body, /loadBlankLlmPreparationState|loadDemoWorkspaceState|runAdaptationFromPanel|DeepSeek/u);
});
