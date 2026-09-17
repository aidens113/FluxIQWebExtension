import { DEFAULT_LLM_LAB_BUDGET } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "./failure.js";
import type { ExistingFlowAdaptation, ExistingFlowAdaptationSummary, ExistingFluxIQControlClient, ExistingRunDetail } from "./existing-fluxiq-control.js";

export type ExistingTargetAdaptationAction = "state" | "approve" | "apply" | "continue" | "revert";

export type ExistingTargetAdaptationScope = {
  projectId: string;
  flowId: string;
  subflowId: string;
};

export type ExistingTargetAdaptationSelector = {
  adaptationId?: string;
  sourceRunId?: string;
};

export type ExistingTargetAdaptationControl = Pick<ExistingFluxIQControlClient,
  "listFlowAdaptations" | "getFlowAdaptation" | "getRunDetail" | "approveFlowAdaptation" | "applyFlowAdaptation" | "revertFlowAdaptation">;

export type ExistingTargetAdaptationControlResult = Readonly<{
  action: ExistingTargetAdaptationAction;
  adaptationId: string;
  sourceRunId: string;
  initialStatus: string;
  status: string;
  approved: boolean;
  applied: boolean;
  reverted: boolean;
  appliedMutationCount: number | null;
  providerCallCount: 0;
}>;

export async function controlExistingLlmTargetAdaptation(
  control: ExistingTargetAdaptationControl,
  scope: ExistingTargetAdaptationScope,
  authorizationPin: string,
  action: ExistingTargetAdaptationAction,
  selector: ExistingTargetAdaptationSelector = {},
): Promise<ExistingTargetAdaptationControlResult> {
  const adaptation = await requireExactActiveTargetAdaptation(control, scope, selector);
  const initialStatus = adaptation.status;
  let current = adaptation;
  let approved = false;
  let applied = false;
  let reverted = false;

  if (action === "approve") {
    if (current.status !== "proposed") fail("Approval requires an exact proposed target adaptation");
    current = await control.approveFlowAdaptation({ ...scope, adaptationId: current.adaptationId, authorizationPin });
    approved = true;
  } else if (action === "apply") {
    if (current.status !== "validated") fail("Apply requires an exact validated target adaptation");
    current = await control.applyFlowAdaptation({ ...scope, adaptationId: current.adaptationId, authorizationPin });
    applied = true;
  } else if (action === "continue") {
    if (current.status === "proposed") {
      current = await control.approveFlowAdaptation({ ...scope, adaptationId: current.adaptationId, authorizationPin });
      approved = true;
    }
    if (current.status === "validated") {
      current = await control.applyFlowAdaptation({ ...scope, adaptationId: current.adaptationId, authorizationPin });
      applied = true;
    }
    if (current.status !== "applied") fail("Continuation did not reach the applied state");
  } else if (action === "revert") {
    if (current.status !== "applied" || current.appliedMutationCount !== 1) {
      fail("Revert requires an exact applied target adaptation with one persisted mutation");
    }
    current = await control.revertFlowAdaptation({
      ...scope,
      adaptationId: current.adaptationId,
      authorizationPin,
      reason: "Testing Lab rollback of the exact runtime target adaptation",
    });
    reverted = true;
  }

  requireTargetShape(current, scope, selector, action === "revert" ? "reverted" : undefined);
  if (current.status === "applied" && current.appliedMutationCount !== 1) {
    fail("Applied target adaptation did not persist exactly one mutation");
  }
  return Object.freeze({
    action,
    adaptationId: current.adaptationId,
    sourceRunId: current.sourceRunId!,
    initialStatus,
    status: current.status,
    approved,
    applied,
    reverted,
    appliedMutationCount: current.appliedMutationCount ?? null,
    providerCallCount: 0,
  });
}

async function requireExactActiveTargetAdaptation(
  control: ExistingTargetAdaptationControl,
  scope: ExistingTargetAdaptationScope,
  selector: ExistingTargetAdaptationSelector,
): Promise<ExistingFlowAdaptation> {
  const summaries = await control.listFlowAdaptations(scope.projectId, scope.flowId);
  const active = summaries.filter(item => isActive(item) && (selector.adaptationId === undefined || item.adaptationId === selector.adaptationId));
  const details = await Promise.all(active.map(item => control.getFlowAdaptation(scope.projectId, scope.flowId, item.adaptationId)));
  const nonBootstrap = details.filter(item => item.adaptationKind !== "flow_bootstrap");
  const matching = nonBootstrap.filter(item => isExactTargetShape(item, scope, selector));
  if (matching.length !== 1 || nonBootstrap.length !== 1) {
    fail("Expected exactly one active LLM target adaptation in the prepared Flow scope");
  }
  const adaptation = matching[0]!;
  const run = await control.getRunDetail(scope.projectId, adaptation.sourceRunId!);
  requireSourceRun(run, scope, adaptation.adaptationId);
  return adaptation;
}

/**
 * Whether a target repair's recorded validation is one Core could have
 * written. Since Core `a2de143` a repair that has only been checked carries no
 * validation result -- one means it ran and was compared -- and a live repair
 * applied and replayed still carried none. So: never a recorded failure, and a
 * success only on a repair that has been applied (or applied and reverted).
 */
export function targetRepairValidationIsHonest(adaptation: Pick<ExistingFlowAdaptation, "status" | "validationSucceededCount" | "validationFailedCount">): boolean {
  if ((adaptation.validationFailedCount ?? 0) !== 0) return false;
  const succeeded = adaptation.validationSucceededCount ?? 0;
  return succeeded === 0 || (succeeded === 1 && (adaptation.status === "applied" || adaptation.status === "reverted"));
}

function isActive(item: ExistingFlowAdaptationSummary): boolean {
  return item.status === "proposed" || item.status === "validated" || item.status === "applied";
}

function isExactTargetShape(adaptation: ExistingFlowAdaptation, scope: ExistingTargetAdaptationScope, selector: ExistingTargetAdaptationSelector): boolean {
  return adaptation.projectId === scope.projectId
    && adaptation.flowId === scope.flowId
    && adaptation.subflowId === scope.subflowId
    && adaptation.adaptationKind !== "flow_bootstrap"
    && typeof adaptation.sourceRunId === "string"
    && adaptation.sourceRunId.length > 0
    && adaptation.patchKinds?.length === 1
    && adaptation.patchKinds[0] === "edit_action_target"
    && targetRepairValidationIsHonest(adaptation)
    && (selector.sourceRunId === undefined || adaptation.sourceRunId === selector.sourceRunId);
}

function requireTargetShape(adaptation: ExistingFlowAdaptation, scope: ExistingTargetAdaptationScope, selector: ExistingTargetAdaptationSelector, expectedStatus?: string): void {
  if ((expectedStatus ? adaptation.status !== expectedStatus : !isActive(adaptation)) || !isExactTargetShape(adaptation, scope, selector)) {
    fail("Adaptation mutation returned an unexpected scope or shape");
  }
}

/**
 * Whether an adapting source run spent a provider call count its grant could
 * have produced. An adaptation iterates for as many calls as it needs, and a
 * call spent gathering evidence between the diagnosis and the patch leaves no
 * intervention behind, so the count is not a fixed number. It is at least one
 * call per recorded intervention, each being a model output, and at most what
 * the grant authorized. The panel sends Core no call count for an adapting run,
 * so Core authorizes its default, which the Lab's drift test
 * (`live-llm/tests/live-llm-plan.test.ts`) holds equal to
 * `DEFAULT_LLM_LAB_BUDGET.maxCallsPerRun`, the adaptation profile's ceiling too.
 *
 * The adaptation certificate (`demo-llm-adaptation.ts`) applies this rule to
 * the run it certifies, which is why this module reads the ceiling from the
 * Lab's default rather than importing the certificate's profile: that import
 * would close a module cycle. Only the length of `interventions` is read.
 */
export function adaptationCallCountWithinGrant(run: Readonly<{ providerCallCount?: number; interventions?: readonly unknown[] }>): boolean {
  const calls = run.providerCallCount;
  return typeof calls === "number" && Number.isSafeInteger(calls)
    && calls >= Math.max(1, run.interventions?.length ?? 0)
    && calls <= DEFAULT_LLM_LAB_BUDGET.maxCallsPerRun;
}

function requireSourceRun(run: ExistingRunDetail, scope: ExistingTargetAdaptationScope, adaptationId: string): void {
  const interventions = run.interventions ?? [];
  if (run.summary.projectId !== scope.projectId || run.summary.flowId !== scope.flowId
    || !(run.adaptationIds ?? []).includes(adaptationId)
    || run.actionAttempts.filter(item => item.status === "failed").length !== 1
    || interventions.length !== 2
    || interventions[0]?.kind !== "diagnosis"
    || interventions[1]?.kind !== "runtime_patch"
    || !adaptationCallCountWithinGrant(run)) {
    fail("The target adaptation source run does not match the bounded diagnosis-and-patch contract");
  }
}

function fail(message: string): never {
  throw new RunnerFailure("runtime.behavior", message);
}
