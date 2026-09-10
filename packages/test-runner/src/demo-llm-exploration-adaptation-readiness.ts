import type {
  ExistingFlowAdaptation,
  ExistingFlowAdaptationSummary,
  ExistingFlowSummary,
} from "./existing-fluxiq-control.js";
import {
  inspectDemoLlmAdaptationReadiness,
  type DemoLlmAdaptationReadiness,
} from "./demo-llm-adaptation-readiness.js";
import { locateLatestAppliedEvidenceGuidedCreation } from "./demo-llm-exploration-apply.js";
import { RunnerFailure } from "./failure.js";
import { isActiveRuntimeAdaptationStatus, resolveAuthoritativeAdaptationStatus } from "./authoritative-adaptation-status.js";

export const explorationAdaptationReadinessFailureCodes = [
  "exploration_adaptation_readiness.binding_invalid",
  "exploration_adaptation_readiness.evidence_audit_invalid",
  "exploration_adaptation_readiness.accounting_invalid",
  "exploration_adaptation_readiness.scope_mismatch",
] as const;

type AppliedEvidenceGuidedCreationControl = Readonly<{
  listFlowSummaries(projectId: string): Promise<ExistingFlowSummary[]>;
  listFlowAdaptations(projectId: string, flowId: string, status?: string): Promise<ExistingFlowAdaptationSummary[]>;
  getFlowAdaptation(projectId: string, flowId: string, adaptationId: string): Promise<ExistingFlowAdaptation>;
}>;

type ExplorationAdaptationReadinessControl = Parameters<typeof inspectDemoLlmAdaptationReadiness>[0] & AppliedEvidenceGuidedCreationControl;

export type AppliedEvidenceGuidedCreationTarget = Readonly<{
  projectId: string;
  flowId: string;
  flowName: string;
  bootstrapAdaptationId: string;
  appliedExecutionDigest: string;
  currentExecutionDigest: string;
  providerCallCount: number | null;
  toolCallCount: number;
  evidenceBytes: number;
}>;

export async function requireExplorationBaselineDriftExplanation(
  control: Pick<AppliedEvidenceGuidedCreationControl, "listFlowAdaptations" | "getFlowAdaptation">,
  target: AppliedEvidenceGuidedCreationTarget,
  ownedSubflowId: string,
): Promise<void> {
  if (target.currentExecutionDigest === target.appliedExecutionDigest) return;
  const summaries = await control.listFlowAdaptations(target.projectId, target.flowId);
  const authoritativeStatuses = new Map(summaries.map(item => [item.adaptationId, item.status] as const));
  const details = await Promise.all(summaries.map(item => control.getFlowAdaptation(target.projectId, target.flowId, item.adaptationId)));
  const statusFor = (item: ExistingFlowAdaptation) => resolveAuthoritativeAdaptationStatus(
    item.adaptationId, authoritativeStatuses, authoritativeStatuses.get(item.adaptationId), item.status
  );
  const ordinary = details.filter(item => item.adaptationKind !== "flow_bootstrap");
  const revertedTargets = ordinary.filter(item => statusFor(item) === "reverted"
    && item.subflowId === ownedSubflowId
    && Boolean(item.sourceRunId)
    && item.patchKinds?.length === 1 && item.patchKinds[0] === "edit_action_target"
    && item.validationSucceededCount === 1 && item.validationFailedCount === 0
    && item.appliedMutationCount === 1);
  const active = ordinary.filter(item => isActiveRuntimeAdaptationStatus(statusFor(item)));
  if (revertedTargets.length !== 1 || active.length !== 0) {
    throw new RunnerFailure("runtime.behavior", "Exploration baseline execution drift is not explained by one exact reverted target adaptation", {
      details: { reasonCode: "exploration_baseline.binding_drift_unexplained" },
    });
  }
}

/**
 * Finds the applied counterpart of the proposal-only exploration checkpoint.
 * This is deliberately identity-based and fails on ambiguity: an adaptation
 * test must never silently fall back to the older prepared demo Flow.
 */
export async function locateExactAppliedEvidenceGuidedCreation(
  control: AppliedEvidenceGuidedCreationControl,
  projectId: string,
  options: Readonly<{ allowCurrentExecutionDrift?: boolean }> = {},
): Promise<AppliedEvidenceGuidedCreationTarget> {
  const latest = await locateLatestAppliedEvidenceGuidedCreation(control, projectId, options);
  const adaptation = await control.getFlowAdaptation(projectId, latest.flowId, latest.adaptationId);
  const binding = adaptation.bootstrapBinding;
  const evidence = adaptation.evidenceLoop!;
  if (!binding?.baseExecutionDigest || !binding.appliedExecutionDigest || !binding.currentExecutionDigest
    || !options.allowCurrentExecutionDrift && binding.currentExecutionDigest !== binding.appliedExecutionDigest
    || binding.baseExecutionDigest === binding.appliedExecutionDigest) {
    fail("exploration_adaptation_readiness.binding_invalid", "Applied checkpoint does not match its current execution state");
  }
  if (evidence.providerCallCount !== undefined && evidence.providerCallCount < 1
    || evidence.toolCallCount < 1 || evidence.evidenceBytes < 1) {
    fail("exploration_adaptation_readiness.evidence_audit_invalid", "Applied checkpoint has no bounded evidence-guided generation audit");
  }
  if (!adaptation.accounting || adaptation.accounting.inputTokens === undefined || adaptation.accounting.outputTokens === undefined
    || adaptation.accounting.totalTokens !== adaptation.accounting.inputTokens + adaptation.accounting.outputTokens) {
    fail("exploration_adaptation_readiness.accounting_invalid", "Applied checkpoint has inconsistent provider accounting");
  }

  return Object.freeze({
    projectId,
    flowId: latest.flowId,
    flowName: latest.flowName,
    bootstrapAdaptationId: adaptation.adaptationId,
    appliedExecutionDigest: binding.appliedExecutionDigest,
    currentExecutionDigest: binding.currentExecutionDigest,
    providerCallCount: evidence.providerCallCount ?? null,
    toolCallCount: evidence.toolCallCount,
    evidenceBytes: evidence.evidenceBytes,
  });
}

/** Provider-free composition of exact checkpoint discovery and the existing strict runtime-adaptation gate. */
export async function inspectExactExplorationAdaptationReadiness(
  control: ExplorationAdaptationReadinessControl,
  projectId: string,
  options: Readonly<{ allowCurrentExecutionDrift?: boolean }> = {},
): Promise<Readonly<{ target: AppliedEvidenceGuidedCreationTarget; readiness: DemoLlmAdaptationReadiness }>> {
  const target = await locateExactAppliedEvidenceGuidedCreation(control, projectId, options);
  const readiness = await inspectDemoLlmAdaptationReadiness(control, target);
  if (readiness.bootstrapAdaptationId !== target.bootstrapAdaptationId
    || readiness.currentExecutionDigest !== target.currentExecutionDigest) {
    fail("exploration_adaptation_readiness.scope_mismatch", "Adaptation readiness escaped the exact exploration checkpoint");
  }
  return Object.freeze({ target, readiness });
}

function fail(reasonCode: typeof explorationAdaptationReadinessFailureCodes[number], message: string): never {
  throw new RunnerFailure("runtime.behavior", message, { details: { reasonCode } });
}
