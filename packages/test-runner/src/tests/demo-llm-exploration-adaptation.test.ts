import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { FIRST_LIVE_ADAPTATION_PROFILE } from "../demo-llm-adaptation.js";
import { evaluateExplorationAdaptationApply, evaluateExplorationAdaptationProposal, evaluateExplorationAdaptationValidation, unexecutedTargetProposalIsSound } from "../demo-llm-exploration-adaptation.js";

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
  const proposal = { adaptationId: "adaptation.target", projectId: "project.one", flowId: "flow.checkpoint", subflowId: "subflow.one", sourceRunId: "run.failed", status: "proposed", adaptationKind: "runtime_patch", patchKinds: ["edit_action_target"], validationSucceededCount: 0, validationFailedCount: 0, appliedMutationCount: 0 };
  // What Core records for a proposal it has only checked, never run (Core a2de143).
  const structure = { targetResolution: "resolved", structuralCheckStatuses: ["passed"] };
  return { readiness, existingAdaptationIds: new Set(["adaptation.bootstrap"]), run, proposal, structure };
}

test("accepts exactly one diagnosis+patch attempt and leaves it pending", () => {
  const result = evaluateExplorationAdaptationProposal(fixture() as any);
  assert.equal(result.status, "proposed");
  assert.equal(result.providerCallCount, 2);
  assert.equal(result.reviewOutcome, "pending");
  assert.equal(result.applyOutcome, "not_attempted");
  assert.deepEqual(result.patchKinds, ["edit_action_target"]);
});

test("reports what an iterating proposal run actually spent, through apply and validation", () => {
  for (const calls of [3, FIRST_LIVE_ADAPTATION_PROFILE.budget.maxCallsPerRun]) {
    const base = fixture();
    base.run.providerCallCount = calls;
    const source = evaluateExplorationAdaptationProposal(base as any);
    assert.equal(source.providerCallCount, calls);
    const applied = { ...base.proposal, status: "applied", appliedMutationCount: 1 };
    const validation = {
      ...base.run,
      summary: { ...base.run.summary, runId: "run.validation", status: "succeeded", interventionCount: 0, adaptationCount: 0 },
      actionAttempts: Array.from({ length: 6 }, (_, index) => ({ attemptId: `i.${index}`, nodeId: `n.${index}`, definitionId: "web.output.dom-click", sequence: index, status: "succeeded" })),
      interventions: [], adaptationIds: [], changeProposalIds: [], providerCallCount: 0,
    };
    const ids = new Set(["adaptation.bootstrap", "adaptation.target"]);
    const apply = evaluateExplorationAdaptationApply({
      readiness: base.readiness as any, source, applied: applied as any, resultingExecutionDigest: "digest.changed",
      validation: validation as any, expectedAdaptationIds: ids, adaptationIdsAfter: ids,
    });
    assert.equal(apply.sourceProviderCallCount, calls);
    const later = evaluateExplorationAdaptationValidation({
      readiness: base.readiness as any, applied: applied as any, sourceRun: base.run as any, validation: validation as any,
      adaptationIdsBefore: ids, adaptationIdsAfter: ids,
    });
    assert.equal(later.sourceProviderCallCount, calls);
  }
});

test("refuses a proposal run whose call count its grant could not have produced", () => {
  for (const calls of [undefined, 0, 1, FIRST_LIVE_ADAPTATION_PROFILE.budget.maxCallsPerRun + 1]) {
    const base = fixture() as any;
    base.run.providerCallCount = calls;
    assert.throws(() => evaluateExplorationAdaptationProposal(base), (error: any) => /strict contract/u.test(error.message)
      && error.details?.reasonCode === "exploration_adaptation_run.provider_accounting_invalid", `${calls} calls`);
  }
  const base = fixture();
  const applied = { ...base.proposal, status: "applied", appliedMutationCount: 1 };
  const validation = { ...base.run, summary: { ...base.run.summary, runId: "run.validation", status: "succeeded", interventionCount: 0, adaptationCount: 0 }, actionAttempts: Array.from({ length: 6 }, (_, index) => ({ attemptId: `o.${index}`, nodeId: `n.${index}`, definitionId: "web.output.dom-click", sequence: index, status: "succeeded" })), interventions: [], adaptationIds: [], changeProposalIds: [], providerCallCount: 0 };
  const ids = new Set(["adaptation.bootstrap", "adaptation.target"]);
  const overSource = { ...base.run, providerCallCount: FIRST_LIVE_ADAPTATION_PROFILE.budget.maxCallsPerRun + 1 };
  assert.throws(() => evaluateExplorationAdaptationValidation({
    readiness: base.readiness as any, applied: applied as any, sourceRun: overSource as any, validation: validation as any,
    adaptationIdsBefore: ids, adaptationIdsAfter: ids,
  }), /strict contract/u);
});

test("rejects reused, applied, cross-scope, and over-budget proposals", () => {
  const reused = fixture(); reused.existingAdaptationIds.add("adaptation.target");
  assert.throws(() => evaluateExplorationAdaptationProposal(reused as any), /strict contract/u);
  const applied = fixture(); applied.proposal.status = "applied";
  assert.throws(() => evaluateExplorationAdaptationProposal(applied as any), /strict contract/u);
  const escaped = fixture(); escaped.proposal.flowId = "flow.other";
  assert.throws(() => evaluateExplorationAdaptationProposal(escaped as any), /strict contract/u);
  // Over budget is judged against the live profile, not a restated number: t027 raised it to the Lab's model-sized request.
  const { maxInputTokens, maxOutputTokens } = FIRST_LIVE_ADAPTATION_PROFILE.budget;
  const overAccounting = (error: any) => /strict contract/u.test(error.message) && error.details?.reasonCode === "exploration_adaptation_run.provider_accounting_invalid";
  const atLimit = fixture(); const limitCall = atLimit.run.interventions[0]!;
  limitCall.inputTokens = maxInputTokens; limitCall.totalTokens = limitCall.inputTokens + limitCall.outputTokens;
  assert.equal(evaluateExplorationAdaptationProposal(atLimit as any).status, "proposed");
  const overInput = fixture(); const inputCall = overInput.run.interventions[0]!;
  inputCall.inputTokens = maxInputTokens + 1; inputCall.totalTokens = inputCall.inputTokens + inputCall.outputTokens;
  assert.throws(() => evaluateExplorationAdaptationProposal(overInput as any), overAccounting);
  const overOutput = fixture(); const outputCall = overOutput.run.interventions[1]!;
  outputCall.outputTokens = maxOutputTokens + 1; outputCall.totalTokens = outputCall.inputTokens + outputCall.outputTokens;
  assert.throws(() => evaluateExplorationAdaptationProposal(overOutput as any), overAccounting);
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

test("accepts exactly six clean actions for an already-applied diagnosis-and-patch target adaptation", () => {
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

// The shape of an explored Flow is the model's to choose. A live exploration
// built seven nodes, five of them actions, and a later repair has to validate
// against that Flow's own deterministic baseline, not a fixed six.
test("validation accepts the explored Flow's own baseline action count, whatever it is", () => {
  const base = fixture();
  const readiness = { ...base.readiness, nodeCount: 7, edgeCount: 6, actionAttemptCount: 5 };
  const applied = { ...base.proposal, status: "applied", appliedMutationCount: 1 };
  const validation = {
    ...base.run,
    summary: { ...base.run.summary, runId: "run.validation.seven", status: "succeeded", interventionCount: 0, adaptationCount: 0 },
    actionAttempts: Array.from({ length: 5 }, (_, index) => ({ attemptId: `seven.${index}`, nodeId: `node.${index}`, definitionId: "web.output.dom-click", sequence: index, status: "succeeded" })),
    interventions: [], adaptationIds: [], changeProposalIds: [], providerCallCount: 0,
  };
  const common = {
    readiness: readiness as any, applied: applied as any, sourceRun: base.run as any,
    adaptationIdsBefore: new Set(["adaptation.bootstrap", "adaptation.target"]),
    adaptationIdsAfter: new Set(["adaptation.bootstrap", "adaptation.target"]),
  };
  assert.equal(evaluateExplorationAdaptationValidation({ ...common, validation: validation as any }).actionAttemptCount, 5);
  const six = { ...validation, actionAttempts: [...validation.actionAttempts, { ...validation.actionAttempts[0]!, attemptId: "seven.extra" }] };
  assert.throws(() => evaluateExplorationAdaptationValidation({ ...common, validation: six as any }), /strict contract/u);
  assert.throws(() => evaluateExplorationAdaptationValidation({ ...common, readiness: { ...readiness, nodeCount: 0 } as any, validation: validation as any }), /strict contract/u);
});

// Core records no validation for a repair it has checked but not run: a
// validation entry means "it ran and was compared". A live repair was refused
// for lacking the one success the lane used to demand at proposal time.
test("a proposal is sound when it claims no run and its structural check passed", () => {
  const base = fixture();
  assert.equal(evaluateExplorationAdaptationProposal(base as any).validationSucceededCount, 0);
  const absent = fixture() as any; delete absent.proposal.validationSucceededCount; delete absent.proposal.validationFailedCount;
  assert.equal(evaluateExplorationAdaptationProposal(absent).structurallyChecked, true);
  const claimed = fixture(); claimed.proposal.validationSucceededCount = 1;
  const failedRun = fixture(); failedRun.proposal.validationFailedCount = 1;
  const failedCheck = fixture(); failedCheck.structure.structuralCheckStatuses = ["passed", "failed"];
  const noCheck = fixture(); noCheck.structure.structuralCheckStatuses = [];
  const unresolved = fixture() as any; delete unresolved.structure.targetResolution;
  for (const [label, value] of Object.entries({ claimed, failedRun, failedCheck, noCheck, unresolved })) {
    assert.throws(() => evaluateExplorationAdaptationProposal(value as any), (error: any) => error.details?.reasonCode === "exploration_adaptation_run.proposal_shape_invalid", label);
  }
  assert.equal(unexecutedTargetProposalIsSound({ status: "applied", validationSucceededCount: 1, validationFailedCount: 0 } as any, base.structure), true);
  assert.equal(unexecutedTargetProposalIsSound({ status: "validated" } as any, { targetResolution: "matched", structuralCheckStatuses: ["passed"] }), true);
});

test("both adaptation lanes read Core's structural record before judging a proposal", async () => {
  for (const file of ["demo-workspace/adaptation-lane.ts", "demo-workspace/exploration-adaptation.ts"]) {
    const source = await readFile(path.join(repositoryRoot, "packages/test-runner/src", file), "utf8");
    assert.match(source, /readTargetProposalStructure\(/u, file);
    assert.doesNotMatch(source, /validationSucceededCount !== 1/u, file);
  }
});
