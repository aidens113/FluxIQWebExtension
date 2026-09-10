import type { ExistingFlowAdaptation, ExistingRunDetail } from "./existing-fluxiq-control.js";
import type { DemoLlmAdaptationReadiness } from "./demo-llm-adaptation-readiness.js";
import { FIRST_LIVE_ADAPTATION_PROFILE } from "./demo-llm-adaptation.js";
import { RunnerFailure } from "./failure.js";

export type ExplorationAdaptationProposalCheckpoint = Readonly<{
  status: "proposed";
  provider: "deepseek";
  model: "deepseek-chat";
  providerCallCount: 2;
  retryCount: 0;
  projectId: string;
  flowId: string;
  runId: string;
  adaptationId: string;
  failedActionCount: 1;
  interventionKinds: readonly ["diagnosis", "runtime_patch"];
  patchKinds: readonly ["edit_action_target"];
  validationSucceededCount: 1;
  validationFailedCount: 0;
  reviewOutcome: "pending";
  applyOutcome: "not_attempted";
  recordingCount: 0;
}>;

export type ExplorationAdaptationApplyCheckpoint = Readonly<{
  status: "passed";
  providerCallCount: 0;
  sourceProviderCallCount: 2;
  projectId: string;
  flowId: string;
  sourceRunId: string;
  validationRunId: string;
  adaptationId: string;
  reviewOutcome: "approved";
  applyOutcome: "applied";
  appliedMutationCount: 1;
  executionDigestChanged: true;
  actionAttemptCount: number;
  recordingCount: 0;
}>;

export type ExplorationAdaptationValidationCheckpoint = Readonly<{
  status: "passed";
  providerCallCount: 0;
  sourceProviderCallCount: 2;
  projectId: string;
  flowId: string;
  sourceRunId: string;
  validationRunId: string;
  adaptationId: string;
  actionAttemptCount: 6;
  recordingCount: 0;
}>;

/**
 * Validates the only provider-backed portion of the exploration adaptation
 * lane. It deliberately stops at a single inert manual-review proposal.
 */
export function evaluateExplorationAdaptationProposal(input: Readonly<{
  readiness: DemoLlmAdaptationReadiness;
  existingAdaptationIds: ReadonlySet<string>;
  run: ExistingRunDetail;
  proposal: ExistingFlowAdaptation;
}>): ExplorationAdaptationProposalCheckpoint {
  const { readiness, run, proposal } = input;
  if (run.summary.projectId !== readiness.projectId || run.summary.flowId !== readiness.flowId) fail("scope_mismatch");
  const failed = run.actionAttempts.filter(item => item.status === "failed");
  if (failed.length !== 1) fail("failed_action_invalid");
  if ((run.providerCallCount ?? 0) !== 2) fail("provider_accounting_invalid");
  const interventions = run.interventions ?? [];
  if (interventions.length !== 2 || interventions[0]?.kind !== "diagnosis" || interventions[1]?.kind !== "runtime_patch") fail("interventions_invalid");
  for (const [index, intervention] of interventions.entries()) {
    const prompt = index === 0 ? "automation-studio.runtime-diagnosis.v1" : "automation-studio.runtime-patch.v1";
    if (!intervention.requestId || intervention.provider !== "deepseek" || intervention.model !== "deepseek-chat"
      || intervention.promptVersion !== prompt || intervention.validationOk !== true
      || !Number.isSafeInteger(intervention.inputTokens) || !Number.isSafeInteger(intervention.outputTokens)
      || !Number.isSafeInteger(intervention.totalTokens)
      || intervention.inputTokens! + intervention.outputTokens! !== intervention.totalTokens
      || intervention.inputTokens! > FIRST_LIVE_ADAPTATION_PROFILE.budget.maxInputTokens
      || intervention.outputTokens! > FIRST_LIVE_ADAPTATION_PROFILE.budget.maxOutputTokens
      || intervention.totalTokens! > FIRST_LIVE_ADAPTATION_PROFILE.budget.maxTotalTokensPerRequest
      || typeof intervention.estimatedCostUsd !== "number" || !Number.isFinite(intervention.estimatedCostUsd)
      || intervention.estimatedCostUsd > FIRST_LIVE_ADAPTATION_PROFILE.budget.maxEstimatedCostUsd) fail("provider_accounting_invalid");
  }
  const adaptationIds = [...new Set(run.adaptationIds ?? [])];
  const proposalIds = [...new Set(run.changeProposalIds ?? [])];
  if (adaptationIds.length !== 1 || proposalIds.length !== 1 || adaptationIds[0] !== proposal.adaptationId
    || input.existingAdaptationIds.has(proposal.adaptationId)) fail("proposal_identity_invalid");
  if (proposal.projectId !== readiness.projectId || proposal.flowId !== readiness.flowId
    || proposal.sourceRunId !== run.summary.runId || proposal.subflowId !== readiness.subflowId) fail("scope_mismatch");
  if (proposal.status !== "proposed" || proposal.adaptationKind === "flow_bootstrap"
    || proposal.patchKinds?.length !== 1 || proposal.patchKinds[0] !== "edit_action_target"
    || proposal.validationSucceededCount !== 1 || proposal.validationFailedCount !== 0
    || (proposal.appliedMutationCount ?? 0) !== 0) fail("proposal_shape_invalid");

  return Object.freeze({
    status: "proposed" as const,
    provider: "deepseek" as const,
    model: "deepseek-chat" as const,
    providerCallCount: 2 as const,
    retryCount: 0 as const,
    projectId: readiness.projectId,
    flowId: readiness.flowId,
    runId: run.summary.runId,
    adaptationId: proposal.adaptationId,
    failedActionCount: 1 as const,
    interventionKinds: Object.freeze(["diagnosis", "runtime_patch"] as const),
    patchKinds: Object.freeze(["edit_action_target"] as const),
    validationSucceededCount: 1 as const,
    validationFailedCount: 0 as const,
    reviewOutcome: "pending" as const,
    applyOutcome: "not_attempted" as const,
    recordingCount: 0 as const,
  });
}

/** Validates the provider-free apply + single deterministic validation half. */
export function evaluateExplorationAdaptationApply(input: Readonly<{
  readiness: DemoLlmAdaptationReadiness;
  source: ExplorationAdaptationProposalCheckpoint;
  applied: ExistingFlowAdaptation;
  resultingExecutionDigest: string;
  validation: ExistingRunDetail;
  adaptationIdsAfter: ReadonlySet<string>;
  expectedAdaptationIds: ReadonlySet<string>;
}>): ExplorationAdaptationApplyCheckpoint {
  const { readiness, source, applied, validation } = input;
  if (source.projectId !== readiness.projectId || source.flowId !== readiness.flowId
    || applied.projectId !== readiness.projectId || applied.flowId !== readiness.flowId
    || applied.adaptationId !== source.adaptationId || applied.sourceRunId !== source.runId
    || applied.subflowId !== readiness.subflowId) fail("apply_scope_mismatch");
  if (applied.status !== "applied" || applied.patchKinds?.length !== 1 || applied.patchKinds[0] !== "edit_action_target"
    || applied.appliedMutationCount !== 1 || input.resultingExecutionDigest === readiness.currentExecutionDigest) fail("apply_invalid");
  if (validation.summary.projectId !== readiness.projectId || validation.summary.flowId !== readiness.flowId
    || validation.summary.status !== "succeeded" || validation.summary.runId === source.runId
    || validation.actionAttempts.length !== readiness.actionAttemptCount
    || validation.actionAttempts.some(item => item.status !== "succeeded")
    || (validation.providerCallCount ?? 0) !== 0 || (validation.interventions?.length ?? 0) !== 0
    || (validation.adaptationIds?.length ?? 0) !== 0 || (validation.changeProposalIds?.length ?? 0) !== 0
    || (validation.summary.adaptationCount ?? 0) !== 0) fail("validation_invalid");
  if (input.adaptationIdsAfter.size !== input.expectedAdaptationIds.size
    || [...input.expectedAdaptationIds].some(id => !input.adaptationIdsAfter.has(id))) fail("adaptation_set_changed");
  return Object.freeze({
    status: "passed" as const,
    providerCallCount: 0 as const,
    sourceProviderCallCount: 2 as const,
    projectId: readiness.projectId,
    flowId: readiness.flowId,
    sourceRunId: source.runId,
    validationRunId: validation.summary.runId,
    adaptationId: applied.adaptationId,
    reviewOutcome: "approved" as const,
    applyOutcome: "applied" as const,
    appliedMutationCount: 1 as const,
    executionDigestChanged: true as const,
    actionAttemptCount: validation.actionAttempts.length,
    recordingCount: 0 as const,
  });
}

/** Validates a later provider-free replay of the exact already-applied target adaptation. */
export function evaluateExplorationAdaptationValidation(input: Readonly<{
  readiness: DemoLlmAdaptationReadiness;
  applied: ExistingFlowAdaptation;
  sourceRun: ExistingRunDetail;
  validation: ExistingRunDetail;
  adaptationIdsBefore: ReadonlySet<string>;
  adaptationIdsAfter: ReadonlySet<string>;
}>): ExplorationAdaptationValidationCheckpoint {
  const { readiness, applied, sourceRun, validation } = input;
  if (readiness.nodeCount !== 6 || readiness.actionAttemptCount !== 6
    || applied.projectId !== readiness.projectId || applied.flowId !== readiness.flowId
    || applied.status !== "applied" || applied.adaptationKind === "flow_bootstrap"
    || applied.subflowId !== readiness.subflowId || !applied.sourceRunId
    || applied.patchKinds?.length !== 1 || applied.patchKinds[0] !== "edit_action_target"
    || applied.appliedMutationCount !== 1) fail("validation_target_invalid");
  if (sourceRun.summary.projectId !== readiness.projectId || sourceRun.summary.flowId !== readiness.flowId
    || sourceRun.summary.runId !== applied.sourceRunId || sourceRun.providerCallCount !== 2
    || sourceRun.interventions?.length !== 2
    || sourceRun.interventions[0]?.kind !== "diagnosis" || sourceRun.interventions[1]?.kind !== "runtime_patch"
    || sourceRun.adaptationIds?.length !== 1 || sourceRun.adaptationIds[0] !== applied.adaptationId
    || sourceRun.changeProposalIds?.length !== 1) fail("validation_source_invalid");
  if (validation.summary.projectId !== readiness.projectId || validation.summary.flowId !== readiness.flowId
    || validation.summary.runId === sourceRun.summary.runId || validation.summary.status !== "succeeded"
    || validation.actionAttempts.length !== 6 || validation.actionAttempts.some(item => item.status !== "succeeded")
    || (validation.providerCallCount ?? 0) !== 0 || (validation.interventions?.length ?? 0) !== 0
    || (validation.adaptationIds?.length ?? 0) !== 0 || (validation.changeProposalIds?.length ?? 0) !== 0
    || (validation.summary.adaptationCount ?? 0) !== 0) fail("validation_run_invalid");
  if (input.adaptationIdsAfter.size !== input.adaptationIdsBefore.size
    || [...input.adaptationIdsBefore].some(id => !input.adaptationIdsAfter.has(id))) fail("validation_adaptation_set_changed");
  return Object.freeze({
    status: "passed" as const,
    providerCallCount: 0 as const,
    sourceProviderCallCount: 2 as const,
    projectId: readiness.projectId,
    flowId: readiness.flowId,
    sourceRunId: sourceRun.summary.runId,
    validationRunId: validation.summary.runId,
    adaptationId: applied.adaptationId,
    actionAttemptCount: 6 as const,
    recordingCount: 0 as const,
  });
}

function fail(suffix: string): never {
  throw new RunnerFailure("runtime.behavior", "Exploration adaptation proposal checkpoint failed its strict contract", {
    details: { reasonCode: `exploration_adaptation_run.${suffix}` },
  });
}
