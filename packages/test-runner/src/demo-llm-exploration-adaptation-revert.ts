import type {
  ExistingFlowAdaptation,
  ExistingFluxIQControlClient,
} from "./existing-fluxiq-control.js";
import { locateExactAppliedEvidenceGuidedCreation } from "./demo-llm-exploration-adaptation-readiness.js";
import { RunnerFailure } from "./failure.js";

type ExplorationAdaptationRevertControl = Pick<ExistingFluxIQControlClient,
  "listFlowSummaries" | "listFlowAdaptations" | "getFlowAdaptation" | "listFlowSubflows" | "getFlowRouter" | "getRunDetail" | "rejectFlowAdaptation" | "revertFlowAdaptation"
>;

export type ExplorationAdaptationRevertResult = Readonly<{
  status: "reverted";
  projectId: string;
  flowId: string;
  subflowId: string;
  adaptationId: string;
  providerCallCount: 0;
}>;

export type ExplorationAdaptationRejectResult = Readonly<{
  status: "rejected";
  projectId: string;
  flowId: string;
  subflowId: string;
  adaptationId: string;
  providerCallCount: 0;
}>;

/**
 * Reverts only the one applied target edit owned by the newest evidence-guided
 * exploration Flow. Discovery is independent of the prepared demo Flow state.
 */
export async function revertExactAppliedExplorationTargetAdaptation(
  control: ExplorationAdaptationRevertControl,
  projectId: string,
  authorizationPin: string,
): Promise<ExplorationAdaptationRevertResult> {
  const { target, subflowId, adaptation } = await requireExactTarget(control, projectId, "applied", 1);

  const reverted = await control.revertFlowAdaptation({
    projectId,
    flowId: target.flowId,
    adaptationId: adaptation.adaptationId,
    authorizationPin,
    reason: "Testing Lab rollback of the exact evidence-guided exploration target adaptation",
  });
  requireExactTargetShape(reverted, projectId, target.flowId, subflowId, "reverted", 1);

  return Object.freeze({
    status: "reverted" as const,
    projectId,
    flowId: target.flowId,
    subflowId,
    adaptationId: reverted.adaptationId,
    providerCallCount: 0 as const,
  });
}

/** Rejects the one still-inert target proposal on the newest exact exploration Flow. */
export async function rejectExactPendingExplorationTargetAdaptation(
  control: ExplorationAdaptationRevertControl,
  projectId: string,
  authorizationPin: string,
): Promise<ExplorationAdaptationRejectResult> {
  const { target, subflowId, adaptation } = await requireExactTarget(control, projectId, "proposed", 0);
  const rejected = await control.rejectFlowAdaptation({
    projectId,
    flowId: target.flowId,
    adaptationId: adaptation.adaptationId,
    authorizationPin,
    reason: "Testing Lab rejection of the exact evidence-guided exploration target proposal",
  });
  requireExactTargetShape(rejected, projectId, target.flowId, subflowId, "rejected", 0);
  return Object.freeze({
    status: "rejected" as const,
    projectId,
    flowId: target.flowId,
    subflowId,
    adaptationId: rejected.adaptationId,
    providerCallCount: 0 as const,
  });
}

async function requireExactTarget(
  control: ExplorationAdaptationRevertControl,
  projectId: string,
  expectedStatus: "applied" | "proposed",
  expectedMutationCount: 0 | 1,
) {
  const target = await locateExactAppliedEvidenceGuidedCreation(control, projectId, { allowCurrentExecutionDrift: true });
  const subflows = await control.listFlowSubflows(projectId, target.flowId);
  if (subflows.length !== 1 || !subflows[0]?.graphFlowId) fail("Exact exploration target control requires one graph-backed owned Subflow");
  const subflowId = subflows[0]!.subflowId;
  const router = await control.getFlowRouter(projectId, target.flowId);
  const routedSubflowIds = new Set([
    ...(router?.fallback?.subflowId ? [router.fallback.subflowId] : []),
    ...(router?.rules.flatMap(rule => rule.target?.subflowId ? [rule.target.subflowId] : []) ?? []),
  ]);
  if (!router || routedSubflowIds.size !== 1 || !routedSubflowIds.has(subflowId)) {
    fail("Exact exploration target control requires a Router scoped to its one owned Subflow");
  }
  const summaries = await control.listFlowAdaptations(projectId, target.flowId);
  const details = await Promise.all(summaries.map(summary => control.getFlowAdaptation(projectId, target.flowId, summary.adaptationId)));
  const bootstrap = details.filter(item => item.adaptationId === target.bootstrapAdaptationId);
  const activeOrdinary = details.filter(item => item.adaptationKind !== "flow_bootstrap" && isActive(item.status));
  if (bootstrap.length !== 1 || bootstrap[0]?.status !== "applied" || activeOrdinary.length !== 1
    || activeOrdinary[0]?.status !== expectedStatus) {
    fail(`Exact exploration target control requires one applied Bootstrap and one ${expectedStatus} ordinary adaptation`);
  }
  const adaptation = activeOrdinary[0]!;
  requireExactTargetShape(adaptation, projectId, target.flowId, subflowId, expectedStatus, expectedMutationCount);
  const run = await control.getRunDetail(projectId, adaptation.sourceRunId!);
  const interventions = run.interventions ?? [];
  if (run.summary.projectId !== projectId || run.summary.flowId !== target.flowId
    || !(run.adaptationIds ?? []).includes(adaptation.adaptationId)
    || run.actionAttempts.filter(item => item.status === "failed").length !== 1
    || interventions.length !== 2 || interventions[0]?.kind !== "diagnosis"
    || interventions[1]?.kind !== "runtime_patch" || run.providerCallCount !== 2) {
    fail("Exploration target adaptation source run does not match the bounded diagnosis-and-patch contract");
  }
  return { target, subflowId, adaptation };
}

function requireExactTargetShape(
  adaptation: ExistingFlowAdaptation,
  projectId: string,
  flowId: string,
  subflowId: string,
  status: "applied" | "proposed" | "rejected" | "reverted",
  appliedMutationCount: 0 | 1,
): void {
  if (adaptation.projectId !== projectId || adaptation.flowId !== flowId
    || adaptation.subflowId !== subflowId || adaptation.status !== status
    || adaptation.adaptationKind === "flow_bootstrap"
    || adaptation.patchKinds?.length !== 1 || adaptation.patchKinds[0] !== "edit_action_target"
    || typeof adaptation.sourceRunId !== "string" || adaptation.sourceRunId.length === 0
    || (adaptation.appliedMutationCount ?? 0) !== appliedMutationCount
    || adaptation.validationSucceededCount !== 1 || adaptation.validationFailedCount !== 0) {
    fail("Applied exploration adaptation has an unexpected scope, Subflow, patch, or mutation shape");
  }
}

function isActive(status: string): boolean {
  return status === "proposed" || status === "validated" || status === "applied";
}

function fail(message: string): never {
  throw new RunnerFailure("runtime.behavior", message, {
    details: { reasonCode: "exploration_adaptation_revert.scope_invalid" },
  });
}
