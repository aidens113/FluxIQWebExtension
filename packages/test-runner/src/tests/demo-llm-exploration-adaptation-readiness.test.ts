import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { locateExactAppliedEvidenceGuidedCreation, requireExplorationBaselineDriftExplanation } from "../demo-llm-exploration-adaptation-readiness.js";

const repositoryRoot = path.resolve(import.meta.dirname, "../../../..");

function fixture() {
  const flow = { flowId: "flow.checkpoint", name: "Website Exploration Checkpoint abc123", sourceMode: "visual", nodeCount: 0, edgeCount: 0, updatedAt: 1 };
  const adaptation = {
    projectId: "project.one", flowId: flow.flowId, adaptationId: "adaptation.bootstrap", status: "applied", adaptationKind: "flow_bootstrap",
    evidenceLoop: { providerCallCount: 1, iterationCount: 2, toolCallCount: 1, evidenceBytes: 900, toolIds: ["web.inspect_current_page"] },
    accounting: { provider: "deepseek", model: "deepseek-chat", inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    bootstrapBinding: { baseExecutionDigest: "digest.blank", appliedExecutionDigest: "digest.applied", currentExecutionDigest: "digest.applied" },
  };
  return {
    listFlowSummaries: async () => [flow, { ...flow, flowId: "flow.unrelated", name: "Prepared blank Flow" }],
    listFlowAdaptations: async (_projectId: string, flowId: string) => flowId === flow.flowId ? [{ projectId: "project.one", flowId, adaptationId: adaptation.adaptationId, status: "applied" }] : [],
    getFlowAdaptation: async () => adaptation,
  };
}

test("locates the exact applied evidence-guided checkpoint without selecting the prepared demo Flow", async () => {
  assert.deepEqual(await locateExactAppliedEvidenceGuidedCreation(fixture() as any, "project.one"), {
    projectId: "project.one",
    flowId: "flow.checkpoint",
    flowName: "Website Exploration Checkpoint abc123",
    bootstrapAdaptationId: "adaptation.bootstrap",
    appliedExecutionDigest: "digest.applied",
    currentExecutionDigest: "digest.applied",
    providerCallCount: 1,
    toolCallCount: 1,
    evidenceBytes: 900,
  });
});

test("retains unknown provider calls for a legacy applied checkpoint without inferring from trace length", async () => {
  const control = fixture() as any;
  control.getFlowAdaptation = async () => {
    const adaptation = await fixture().getFlowAdaptation();
    const { providerCallCount: _providerCallCount, ...evidenceLoop } = adaptation.evidenceLoop;
    return { ...adaptation, evidenceLoop };
  };
  const result = await locateExactAppliedEvidenceGuidedCreation(control, "project.one");
  assert.equal(result.providerCallCount, null);
});

test("fails closed on ambiguous applied checkpoints", async () => {
  const control = fixture() as any;
  control.listFlowSummaries = async () => [
    ...(await fixture().listFlowSummaries()),
    { flowId: "flow.second", name: "Website Exploration Checkpoint second", sourceMode: "visual", nodeCount: 0, edgeCount: 0, updatedAt: 1 },
  ];
  control.listFlowAdaptations = async (_projectId: string, flowId: string) => flowId.startsWith("flow.") && flowId !== "flow.unrelated"
    ? [{ projectId: "project.one", flowId, adaptationId: `adaptation.${flowId}`, status: "applied" }]
    : [];
  control.getFlowAdaptation = async (_projectId: string, flowId: string, adaptationId: string) => ({ ...(await fixture().getFlowAdaptation()), flowId, adaptationId });
  await assert.rejects(() => locateExactAppliedEvidenceGuidedCreation(control, "project.one"), /ambiguous/u);
});

test("selects the newest valid applied checkpoint and stops before older checkpoint state", async () => {
  const control = fixture() as any;
  control.listFlowSummaries = async () => [
    { flowId: "flow.old", name: "Website Exploration Checkpoint old", sourceMode: "visual", nodeCount: 0, edgeCount: 0, updatedAt: 1 },
    { flowId: "flow.checkpoint", name: "Website Exploration Checkpoint newest", sourceMode: "visual", nodeCount: 0, edgeCount: 0, updatedAt: 3 },
  ];
  const scanned: string[] = [];
  control.listFlowAdaptations = async (_projectId: string, flowId: string) => {
    scanned.push(flowId);
    return flowId === "flow.checkpoint" ? [{ projectId: "project.one", flowId, adaptationId: "adaptation.bootstrap", status: "applied" }] : [];
  };
  const result = await locateExactAppliedEvidenceGuidedCreation(control, "project.one");
  assert.equal(result.flowId, "flow.checkpoint");
  assert.deepEqual(scanned, ["flow.checkpoint"]);
});

test("fails closed on stale binding and missing evidence accounting", async () => {
  const stale = fixture() as any;
  stale.getFlowAdaptation = async () => ({ ...(await fixture().getFlowAdaptation()), bootstrapBinding: { baseExecutionDigest: "digest.blank", appliedExecutionDigest: "digest.applied", currentExecutionDigest: "digest.other" } });
  await assert.rejects(() => locateExactAppliedEvidenceGuidedCreation(stale, "project.one"), /invalid execution binding/u);

  assert.equal((await locateExactAppliedEvidenceGuidedCreation(stale, "project.one", { allowCurrentExecutionDrift: true })).currentExecutionDigest, "digest.other");

  const missing = fixture() as any;
  missing.getFlowAdaptation = async () => ({ ...(await fixture().getFlowAdaptation()), evidenceLoop: { providerCallCount: 0, iterationCount: 1, toolCallCount: 0, evidenceBytes: 0, toolIds: [] } });
  await assert.rejects(() => locateExactAppliedEvidenceGuidedCreation(missing, "project.one"), /generation audit/u);
});

test("baseline accepts drift only for one authoritative reverted validated target edit", async () => {
  const target = {
    projectId: "project.one", flowId: "flow.checkpoint", flowName: "Website Exploration Checkpoint abc123",
    bootstrapAdaptationId: "adaptation.bootstrap", appliedExecutionDigest: "digest.applied", currentExecutionDigest: "digest.reverted",
    providerCallCount: 1, toolCallCount: 1, evidenceBytes: 900,
  } as const;
  const summaries = [
    { projectId: "project.one", flowId: target.flowId, adaptationId: "adaptation.bootstrap", status: "applied" },
    { projectId: "project.one", flowId: target.flowId, adaptationId: "adaptation.target", status: "reverted" },
  ];
  const control = {
    listFlowAdaptations: async () => summaries,
    getFlowAdaptation: async (_projectId: string, _flowId: string, adaptationId: string) => adaptationId === "adaptation.bootstrap"
      ? { ...(await fixture().getFlowAdaptation()), adaptationId }
      : {
          projectId: "project.one", flowId: target.flowId, adaptationId, status: "applied", adaptationKind: "runtime_patch",
          subflowId: "subflow.one", sourceRunId: "run.failed", patchKinds: ["edit_action_target"],
          validationSucceededCount: 1, validationFailedCount: 0, appliedMutationCount: 1,
        },
  };

  await assert.doesNotReject(() => requireExplorationBaselineDriftExplanation(control as any, target, "subflow.one"));

  const active = { ...control, listFlowAdaptations: async () => summaries.map(item => item.adaptationId === "adaptation.target" ? { ...item, status: "validated" } : item) };
  await assert.rejects(
    () => requireExplorationBaselineDriftExplanation(active as any, target, "subflow.one"),
    (error: any) => error?.details?.reasonCode === "exploration_baseline.binding_drift_unexplained"
  );

  await assert.rejects(
    () => requireExplorationBaselineDriftExplanation(control as any, target, "subflow.other"),
    (error: any) => error?.details?.reasonCode === "exploration_baseline.binding_drift_unexplained"
  );
});

test("exposes separate provider-free baseline and exact readiness commands", async () => {
  const manifest = JSON.parse(await readFile(path.join(repositoryRoot, "package.json"), "utf8")) as { scripts?: Record<string, string> };
  assert.equal(manifest.scripts?.["demo:llm:explore:baseline"], "node scripts/run-demo-llm-exploration-baseline.mjs");
  assert.equal(manifest.scripts?.["demo:llm:explore:adapt:readiness"], "node scripts/inspect-demo-llm-exploration-adaptation-readiness.mjs");
  const baseline = await readFile(path.join(repositoryRoot, "scripts/run-demo-llm-exploration-baseline.mjs"), "utf8");
  const readiness = await readFile(path.join(repositoryRoot, "scripts/inspect-demo-llm-exploration-adaptation-readiness.mjs"), "utf8");
  assert.match(baseline, /withoutProviderSecrets[\s\S]*runDemoLlmExplorationBaselineProbe/u);
  assert.match(baseline, /exploration_baseline\\\.\[a-z_\][\s\S]*reasonCode/u);
  assert.match(readiness, /withoutProviderSecrets[\s\S]*runDemoLlmExplorationAdaptationReadinessProbe/u);
  assert.doesNotMatch(`${baseline}\n${readiness}`, /DEEPSEEK_API_KEY|generate-flow-bootstrap-adaptation/u);
});

test("single-run baseline is exact-scoped and rejects assisted or mutating execution", async () => {
  const source = await readFile(path.join(repositoryRoot, "packages/test-runner/src/demo-workspace/exploration-checkpoints.ts"), "utf8");
  const start = source.indexOf("export async function runDemoLlmExplorationBaselineProbe");
  assert.notEqual(start, -1);
  const end = source.indexOf("export async function", start + 30);
  const body = source.slice(start, end);
  assert.match(body, /locateExactAppliedEvidenceGuidedCreation/u);
  assert.match(body, /allowCurrentExecutionDrift[\s\S]*requireExplorationBaselineDriftExplanation/u);
  assert.match(body, /runDemoFlowFromPanel/u);
  assert.match(body, /providerCallCount[\s\S]*interventions[\s\S]*adaptationIds[\s\S]*changeProposalIds/u);
  assert.match(body, /assertRecordingSetUnchanged/u);
  assert.doesNotMatch(body, /for \(|while \(|generate-flow-bootstrap-adaptation/u);
});
