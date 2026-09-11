import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { evaluateExplorationAdaptationApply, evaluateExplorationAdaptationProposal, evaluateExplorationAdaptationValidation } from "../demo-llm-exploration-adaptation.js";

const repositoryRoot = path.resolve(import.meta.dirname, "../../../..");

function fixture() {
  const readiness = {
    status: "passed", providerCallCount: 0, projectId: "project.one", flowId: "flow.checkpoint", graphFlowId: "flow.graph",
    subflowId: "subflow.one", routerId: "router.one", bootstrapAdaptationId: "adaptation.bootstrap", currentExecutionDigest: "digest.one",
    baselineRunId: "run.baseline", recordingCount: 0, nodeCount: 6, edgeCount: 5, actionAttemptCount: 6, adaptableTargetCount: 3, adaptableTargets: [],
  } as const;
  const intervention = (kind: "diagnosis" | "runtime_patch", index: number) => ({
    interventionId: `intervention.${index}`, kind, requestId: `request.${index}`,
    promptVersion: kind === "diagnosis" ? "automation-studio.runtime-diagnosis.v1" : "automation-studio.runtime-patch.v1",
    provider: "deepseek", model: "deepseek-chat", validationOk: true, inputTokens: 100, outputTokens: 50,
    totalTokens: 150, estimatedCostUsd: 0.01, createdAt: index,
  });
  const summary = { runId: "run.failed", projectId: "project.one", flowId: "flow.checkpoint", status: "failed", updatedAt: 1, actionAttemptCount: 1, routeDecisionCount: 1, subflowEntryCount: 1, interventionCount: 2, adaptationCount: 1 };
  const run = { summary, routeDecisions: [], subflows: [], actionAttempts: [{ attemptId: "attempt.one", nodeId: "node.click", definitionId: "web.output.dom-click", sequence: 1, status: "failed" }], interventions: [intervention("diagnosis", 1), intervention("runtime_patch", 2)], adaptationIds: ["adaptation.target"], changeProposalIds: ["adaptation.target"], providerCallCount: 2 };
  const proposal = { adaptationId: "adaptation.target", projectId: "project.one", flowId: "flow.checkpoint", subflowId: "subflow.one", sourceRunId: "run.failed", status: "proposed", adaptationKind: "runtime_patch", patchKinds: ["edit_action_target"], validationSucceededCount: 1, validationFailedCount: 0, appliedMutationCount: 0 };
  return { readiness, existingAdaptationIds: new Set(["adaptation.bootstrap"]), run, proposal };
}

test("accepts exactly one bounded diagnosis+patch attempt and leaves it pending", () => {
  const result = evaluateExplorationAdaptationProposal(fixture() as any);
  assert.equal(result.status, "proposed");
  assert.equal(result.providerCallCount, 2);
  assert.equal(result.reviewOutcome, "pending");
  assert.equal(result.applyOutcome, "not_attempted");
  assert.deepEqual(result.patchKinds, ["edit_action_target"]);
});

test("rejects reused, applied, cross-scope, and over-budget proposals", () => {
  const reused = fixture(); reused.existingAdaptationIds.add("adaptation.target");
  assert.throws(() => evaluateExplorationAdaptationProposal(reused as any), /strict contract/u);
  const applied = fixture(); applied.proposal.status = "applied";
  assert.throws(() => evaluateExplorationAdaptationProposal(applied as any), /strict contract/u);
  const escaped = fixture(); escaped.proposal.flowId = "flow.other";
  assert.throws(() => evaluateExplorationAdaptationProposal(escaped as any), /strict contract/u);
  const over = fixture(); over.run.interventions[0]!.inputTokens = 9_000; over.run.interventions[0]!.totalTokens = 9_050;
  assert.throws(() => evaluateExplorationAdaptationProposal(over as any), /strict contract/u);
});

test("command targets exact exploration readiness and excludes creation, apply, and replay", async () => {
  const manifest = JSON.parse(await readFile(path.join(repositoryRoot, "package.json"), "utf8")) as { scripts: Record<string, string> };
  assert.equal(manifest.scripts["demo:llm:explore:adapt"], "node scripts/run-demo-llm-exploration-adaptation.mjs");
  const source = await readFile(path.join(repositoryRoot, "packages/test-runner/src/demo-workspace/exploration-adaptation.ts"), "utf8");
  const start = source.indexOf("export async function runDemoLlmExplorationAdaptationProposal");
  assert.notEqual(start, -1);
  const end = source.indexOf("export async function", start + 40);
  const body = source.slice(start, end);
  assert.match(body, /inspectExactExplorationAdaptationReadiness/u);
  assert.match(body, /runAdaptationFromPanel/u);
  assert.match(body, /Review \$\{proposal\.adaptationId\}/u);
  assert.doesNotMatch(body, /buildApproveApplyCreationViaUi|reviewAndApplyAdaptationViaUi|runZeroLlmAdaptationValidation/u);
});

test("launcher imports provider-free environment and emits only a safe result or reason code", async () => {
  const source = await readFile(path.join(repositoryRoot, "scripts/run-demo-llm-exploration-adaptation.mjs"), "utf8");
  assert.match(source, /withoutProviderSecrets/u);
  assert.match(source, /exploration_adaptation_readiness/u);
  assert.match(source, /adaptation_readiness/u);
  assert.match(source, /runner\.\$\{error\.category\}/u);
  assert.doesNotMatch(source, /DEEPSEEK_API_KEY|error\.message|String\(error\)/u);
});

test("accepts one applied mutation and exactly one clean deterministic validation", () => {
  const proposalFixture = fixture();
  const source = evaluateExplorationAdaptationProposal(proposalFixture as any);
  const applied = { ...proposalFixture.proposal, status: "applied", appliedMutationCount: 1 };
  const validation = {
    ...proposalFixture.run,
    summary: { ...proposalFixture.run.summary, runId: "run.validation", status: "succeeded", interventionCount: 0, adaptationCount: 0 },
    actionAttempts: Array.from({ length: 6 }, (_, index) => ({ attemptId: `attempt.${index}`, nodeId: `node.${index}`, definitionId: "web.output.dom-click", sequence: index, status: "succeeded" })),
    interventions: [], adaptationIds: [], changeProposalIds: [], providerCallCount: 0,
  };
  const result = evaluateExplorationAdaptationApply({
    readiness: proposalFixture.readiness as any, source, applied: applied as any,
    resultingExecutionDigest: "digest.changed", validation: validation as any,
    expectedAdaptationIds: new Set(["adaptation.bootstrap", "adaptation.target"]),
    adaptationIdsAfter: new Set(["adaptation.bootstrap", "adaptation.target"]),
  });
  assert.equal(result.providerCallCount, 0);
  assert.equal(result.sourceProviderCallCount, 2);
  assert.equal(result.appliedMutationCount, 1);
  assert.equal(result.validationRunId, "run.validation");
});

test("apply evaluation rejects extra adaptations, assisted validation, and unchanged digest", () => {
  const base = fixture();
  const source = evaluateExplorationAdaptationProposal(base as any);
  const applied = { ...base.proposal, status: "applied", appliedMutationCount: 1 };
  const validation = { ...base.run, summary: { ...base.run.summary, runId: "run.validation", status: "succeeded", interventionCount: 0, adaptationCount: 0 }, actionAttempts: Array.from({ length: 6 }, (_, index) => ({ attemptId: `a.${index}`, nodeId: `n.${index}`, definitionId: "web.output.dom-click", sequence: index, status: "succeeded" })), interventions: [], adaptationIds: [], changeProposalIds: [], providerCallCount: 0 };
  const common = { readiness: base.readiness, source, applied, resultingExecutionDigest: "digest.changed", validation, expectedAdaptationIds: new Set(["adaptation.bootstrap", "adaptation.target"]), adaptationIdsAfter: new Set(["adaptation.bootstrap", "adaptation.target"]) };
  assert.throws(() => evaluateExplorationAdaptationApply({ ...common, resultingExecutionDigest: "digest.one" } as any), /strict contract/u);
  assert.throws(() => evaluateExplorationAdaptationApply({ ...common, adaptationIdsAfter: new Set([...common.adaptationIdsAfter, "adaptation.extra"]) } as any), /strict contract/u);
  assert.throws(() => evaluateExplorationAdaptationApply({ ...common, validation: { ...validation, providerCallCount: 1 } } as any), /strict contract/u);
});

test("apply launcher is secret-stripped and workspace command performs only one validation", async () => {
  const manifest = JSON.parse(await readFile(path.join(repositoryRoot, "package.json"), "utf8")) as { scripts: Record<string, string> };
  assert.equal(manifest.scripts["demo:llm:explore:adapt:apply"], "node scripts/apply-demo-llm-exploration-adaptation.mjs");
  const launcher = await readFile(path.join(repositoryRoot, "scripts/apply-demo-llm-exploration-adaptation.mjs"), "utf8");
  assert.match(launcher, /withoutProviderSecrets/u);
  assert.doesNotMatch(launcher, /DEEPSEEK_API_KEY|error\.message|String\(error\)/u);
  const workspace = await readFile(path.join(repositoryRoot, "packages/test-runner/src/demo-workspace/exploration-adaptation.ts"), "utf8");
  const start = workspace.indexOf("export async function runDemoLlmExplorationAdaptationApply");
  assert.notEqual(start, -1);
  const end = workspace.indexOf("export async function", start + 50);
  const body = workspace.slice(start, end);
  assert.match(body, /allowPendingAdaptationId/u);
  assert.match(body, /reviewAndApplyAdaptationViaUi/u);
  assert.equal((body.match(/runZeroLlmAdaptationValidation/g) ?? []).length, 1);
  assert.match(body, /generate-flow-bootstrap-adaptation[\s\S]*preflight-llm-execution[\s\S]*issue-llm-execution-grant/u);
  assert.doesNotMatch(body, /runAdaptationFromPanel|configureFirstLiveDiagnosisViaUi|buildApproveApplyCreationViaUi/u);
});

test("accepts exactly six clean actions for an already-applied two-call target adaptation", () => {
  const base = fixture();
  const applied = { ...base.proposal, status: "applied", appliedMutationCount: 1 };
  base.run.changeProposalIds = ["proposal.separate-public-identity"];
  const validation = {
    ...base.run,
    summary: { ...base.run.summary, runId: "run.validation.later", status: "succeeded", interventionCount: 0, adaptationCount: 0 },
    actionAttempts: Array.from({ length: 6 }, (_, index) => ({ attemptId: `validation.${index}`, nodeId: `node.${index}`, definitionId: "web.output.dom-click", sequence: index, status: "succeeded" })),
    interventions: [], adaptationIds: [], changeProposalIds: [], providerCallCount: 0,
  };
  const result = evaluateExplorationAdaptationValidation({
    readiness: base.readiness as any, applied: applied as any, sourceRun: base.run as any, validation: validation as any,
    adaptationIdsBefore: new Set(["adaptation.bootstrap", "adaptation.target"]),
    adaptationIdsAfter: new Set(["adaptation.bootstrap", "adaptation.target"]),
  });
  assert.equal(result.providerCallCount, 0);
  assert.equal(result.sourceProviderCallCount, 2);
  assert.equal(result.actionAttemptCount, 6);
});

test("validation rejects assisted runs, non-six-action runs, and adaptation-set changes", () => {
  const base = fixture();
  const applied = { ...base.proposal, status: "applied", appliedMutationCount: 1 };
  const validation = { ...base.run, summary: { ...base.run.summary, runId: "run.validation.later", status: "succeeded", interventionCount: 0, adaptationCount: 0 }, actionAttempts: Array.from({ length: 6 }, (_, index) => ({ attemptId: `v.${index}`, nodeId: `n.${index}`, definitionId: "web.output.dom-click", sequence: index, status: "succeeded" })), interventions: [], adaptationIds: [], changeProposalIds: [], providerCallCount: 0 };
  const common = { readiness: base.readiness, applied, sourceRun: base.run, validation, adaptationIdsBefore: new Set(["adaptation.bootstrap", "adaptation.target"]), adaptationIdsAfter: new Set(["adaptation.bootstrap", "adaptation.target"]) };
  assert.throws(() => evaluateExplorationAdaptationValidation({ ...common, validation: { ...validation, providerCallCount: 1 } } as any), /strict contract/u);
  assert.throws(() => evaluateExplorationAdaptationValidation({ ...common, validation: { ...validation, actionAttempts: validation.actionAttempts.slice(0, 5) } } as any), /strict contract/u);
  assert.throws(() => evaluateExplorationAdaptationValidation({ ...common, adaptationIdsAfter: new Set([...common.adaptationIdsAfter, "adaptation.extra"]) } as any), /strict contract/u);
});

test("validate launcher is secret-stripped and command is one provider-free exact-ID run", async () => {
  const manifest = JSON.parse(await readFile(path.join(repositoryRoot, "package.json"), "utf8")) as { scripts: Record<string, string> };
  assert.equal(manifest.scripts["demo:llm:explore:adapt:validate"], "node scripts/validate-demo-llm-exploration-adaptation.mjs");
  const launcher = await readFile(path.join(repositoryRoot, "scripts/validate-demo-llm-exploration-adaptation.mjs"), "utf8");
  assert.match(launcher, /withoutProviderSecrets/u);
  assert.doesNotMatch(launcher, /DEEPSEEK_API_KEY|error\.message|String\(error\)/u);
  const workspace = await readFile(path.join(repositoryRoot, "packages/test-runner/src/demo-workspace/exploration-adaptation.ts"), "utf8");
  const start = workspace.indexOf("export async function runDemoLlmExplorationAdaptationValidation");
  assert.notEqual(start, -1);
  const end = workspace.indexOf("export async function", start + 60);
  const body = workspace.slice(start, end);
  assert.match(body, /locateExactAppliedEvidenceGuidedCreation/u);
  assert.match(body, /selectFlowInCurrentProject|runZeroLlmAdaptationValidation/u);
  assert.equal((body.match(/runZeroLlmAdaptationValidation/g) ?? []).length, 1);
  assert.match(body, /generate-flow-bootstrap-adaptation[\s\S]*preflight-llm-execution[\s\S]*issue-llm-execution-grant/u);
  assert.doesNotMatch(body, /reviewAndApplyAdaptationViaUi|runAdaptationFromPanel|configureFirstLiveDiagnosisViaUi/u);
});
