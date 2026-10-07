// Approving and applying the proposal a live build left, through the same
// `review-flow-adaptation` actions the panel's Approve and Apply buttons post.
// Nothing reaches the Flow before this: a build only ever proposes. A
// legacy-mode Core proposes every build; a candidate-mode one proposes only a
// candidate whose trial was judged a confirmed yes, and only a Core
// `./readiness.ts` admitted is reviewed at all.

import type { AutomationStudioAuthoringMode } from "fluxiq/automation-studio";
import type { ExistingFlowAdaptation } from "../../existing-fluxiq-control.js";
import { RunnerFailure } from "../../failure.js";
import { assertCreatedFlowVerificationReady, type CreatedFlowCandidateTrialReadiness } from "./readiness.js";

export type CreatedFlowReviewControl = {
  approveFlowAdaptation(input: { projectId: string; flowId: string; adaptationId: string; authorizationPin: string }): Promise<ExistingFlowAdaptation>;
  applyFlowAdaptation(input: { projectId: string; flowId: string; adaptationId: string; authorizationPin: string }): Promise<ExistingFlowAdaptation>;
};

/** What applying changed, by count. */
export type CreatedFlowReview = Readonly<{ adaptationId: string; appliedMutationCount: number }>;

/**
 * Approves, then applies. The client refuses a status other than the one each
 * action must reach; an apply that reports no mutation left the Flow blank and
 * fails here rather than as a run with nothing to execute.
 */
export async function applyCreatedFlowProposal(
  control: CreatedFlowReviewControl,
  input: { projectId: string; flowId: string; adaptationId: string; authorizationPin: string; authoringMode: AutomationStudioAuthoringMode; candidateTrial?: CreatedFlowCandidateTrialReadiness },
): Promise<CreatedFlowReview> {
  const { authoringMode, candidateTrial, ...review } = input;
  assertCreatedFlowVerificationReady(authoringMode, candidateTrial);
  await control.approveFlowAdaptation(review);
  const applied = await control.applyFlowAdaptation(review);
  const appliedMutationCount = applied.appliedMutationCount ?? 0;
  if (appliedMutationCount < 1) {
    throw new RunnerFailure("runtime.behavior", "Core applied the build's proposal but reported no change to the Flow", { details: { adaptationId: input.adaptationId } });
  }
  return Object.freeze({ adaptationId: input.adaptationId, appliedMutationCount });
}
