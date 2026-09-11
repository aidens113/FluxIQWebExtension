import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { findPendingEvidenceGuidedCreationForFlow, locateBoundAppliedEvidenceGuidedCreation, locateBoundPendingEvidenceGuidedCreation, locateExactPendingEvidenceGuidedCreation } from "../demo-llm-exploration-apply.js";

const repositoryRoot = path.resolve(import.meta.dirname, "../../../..");

function fixture(overrides: Record<string, unknown> = {}) {
  const summary = { flowId: "flow.checkpoint", name: "Website Exploration Checkpoint abc123", sourceMode: "visual", nodeCount: 0, edgeCount: 0, updatedAt: 1 };
  const adaptation = {
    projectId: "project.one", flowId: summary.flowId, adaptationId: "adaptation.one", status: "proposed",
    adaptationKind: "flow_bootstrap", validationSucceededCount: 2, validationFailedCount: 0,
    evidenceLoop: { providerCallCount: 1, toolCallCount: 1, evidenceBytes: 900, toolIds: ["web.inspect_current_page"] },
    accounting: { provider: "deepseek", model: "deepseek-chat", inputTokens: 100, outputTokens: 50, totalTokens: 150, estimatedCostUsd: 0.01 },
    bootstrapBinding: { baseExecutionDigest: "digest.base", currentExecutionDigest: "digest.base" },
    ...overrides,
  };
  return {
    listFlowSummaries: async () => [summary],
    listFlowAdaptations: async () => [{ projectId: "project.one", flowId: summary.flowId, adaptationId: adaptation.adaptationId, status: adaptation.status }],
    getFlowAdaptation: async () => adaptation,
    getExactFlow: async () => ({ projectId: "project.one", flowId: summary.flowId, name: summary.name, updatedAt: 1, contentHash: "content.blank", document: { nodes: [], edges: [], metadata: { flowRepresentationKind: "orchestration" } } }),
    listFlowSubflows: async () => [],
    getFlowRouter: async () => null,
  };
}

test("locates one exact unchanged evidence-guided bootstrap proposal", async () => {
  const result = await locateExactPendingEvidenceGuidedCreation(fixture() as any, "project.one");
  assert.deepEqual(result, {
    projectId: "project.one", flowId: "flow.checkpoint", flowName: "Website Exploration Checkpoint abc123",
    adaptationId: "adaptation.one", blankContentHash: "content.blank", baseExecutionDigest: "digest.base",
  });
});

test("recovers one exact pending deterministic-flow proposal without a provider call", async () => {
  const control = fixture() as any;
  const summary = (await control.listFlowSummaries("project.one"))[0];
  const recovered = await findPendingEvidenceGuidedCreationForFlow(control, "project.one", summary);
  assert.equal(recovered?.adaptationId, "adaptation.one");
  assert.deepEqual(recovered?.checkpoint, {
    adaptationId: "adaptation.one", status: "proposed", provider: "deepseek", model: "deepseek-chat",
    providerCallCount: 1, toolCallCount: 1, evidenceBytes: 900, toolIds: ["web.inspect_current_page"],
    inputTokens: 100, outputTokens: 50, totalTokens: 150, estimatedCostUsd: 0.01,
  });
  control.listFlowAdaptations = async () => [];
  assert.equal(await findPendingEvidenceGuidedCreationForFlow(control, "project.one", summary), undefined);
});

test("fails closed when the evidence-guided proposal is stale or the topology changed", async () => {
  await assert.rejects(() => locateExactPendingEvidenceGuidedCreation(fixture({ bootstrapBinding: { baseExecutionDigest: "digest.base", currentExecutionDigest: "digest.changed" } }) as any, "project.one"), /stale/u);
  const changed = fixture() as any;
  changed.listFlowSubflows = async () => [{ subflowId: "unexpected" }];
  await assert.rejects(() => locateExactPendingEvidenceGuidedCreation(changed, "project.one"), /acquired a Subflow or Router/u);
});

test("fails closed on ambiguity and wrong adaptation type", async () => {
  const ambiguous = fixture() as any;
  ambiguous.listFlowSummaries = async () => [
    ...(await fixture().listFlowSummaries()),
    { flowId: "flow.other", name: "Website Exploration Checkpoint other", sourceMode: "visual", nodeCount: 0, edgeCount: 0, updatedAt: 2 },
  ];
  ambiguous.listFlowAdaptations = async (_projectId: string, flowId: string) => [{ projectId: "project.one", flowId, adaptationId: `adaptation.${flowId}`, status: "proposed" }];
  ambiguous.getFlowAdaptation = async (_projectId: string, flowId: string, adaptationId: string) => ({ ...(await fixture().getFlowAdaptation()), flowId, adaptationId });
  await assert.rejects(() => locateExactPendingEvidenceGuidedCreation(ambiguous, "project.one"), /exactly one/u);

  const wrong = fixture({ adaptationKind: "edit_action_target", evidenceLoop: undefined });
  await assert.rejects(() => locateExactPendingEvidenceGuidedCreation(wrong as any, "project.one"), /exactly one/u);
});

test("bound continuations select only the persisted Flow and Adaptation identities", async () => {
  const control = fixture() as any;
  control.listFlowSummaries = async () => [
    ...(await fixture().listFlowSummaries()),
    { flowId: "flow.other", name: "Website Exploration other", sourceMode: "visual", nodeCount: 0, edgeCount: 0, updatedAt: 2 },
  ];
  const binding = { projectId: "project.one", flowId: "flow.checkpoint", adaptationId: "adaptation.one" };
  const pending = await locateBoundPendingEvidenceGuidedCreation(control, binding);
  assert.equal(pending.adaptationId, "adaptation.one");
  assert.equal(pending.flowId, "flow.checkpoint");

  const appliedControl = fixture({ status: "applied", bootstrapBinding: { baseExecutionDigest: "digest.base", currentExecutionDigest: "digest.applied", appliedExecutionDigest: "digest.applied" } }) as any;
  const applied = await locateBoundAppliedEvidenceGuidedCreation(appliedControl, binding);
  assert.equal(applied.adaptationId, "adaptation.one");
  assert.equal(applied.appliedExecutionDigest, "digest.applied");

  const launchSettingsDrift = fixture({ status: "applied", bootstrapBinding: { baseExecutionDigest: "digest.base", currentExecutionDigest: "digest.launch-settings", appliedExecutionDigest: "digest.applied" } }) as any;
  await assert.rejects(() => locateBoundAppliedEvidenceGuidedCreation(launchSettingsDrift, binding), /not the current applied/u);
  assert.equal((await locateBoundAppliedEvidenceGuidedCreation(launchSettingsDrift, binding, { allowCurrentExecutionDrift: true })).appliedExecutionDigest, "digest.applied");

  await assert.rejects(() => locateBoundPendingEvidenceGuidedCreation(control, { ...binding, adaptationId: "adaptation.other" }), /not pending/u);
  await assert.rejects(() => locateBoundAppliedEvidenceGuidedCreation(control, binding), /not the current applied/u);
});

test("package command is provider-free and delegates only to the apply checkpoint", async () => {
  const manifest = JSON.parse(await readFile(path.join(repositoryRoot, "package.json"), "utf8")) as { scripts?: Record<string, string> };
  assert.equal(manifest.scripts?.["demo:llm:explore:apply"], "node scripts/apply-demo-llm-exploration-proposal.mjs");
  const launcher = await readFile(path.join(repositoryRoot, "scripts/apply-demo-llm-exploration-proposal.mjs"), "utf8");
  assert.match(launcher, /runDemoLlmExplorationApplyCheckpoint/u);
  assert.doesNotMatch(launcher, /runDemoLlmExplorationCheckpoint|generate-flow-bootstrap-adaptation|runDemoFlow|replay|DEEPSEEK_API_KEY/u);
});
