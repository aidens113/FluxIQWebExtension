// Approving and applying the proposal a live build left, through the same
// `review-flow-adaptation` actions the panel's Approve and Apply buttons post.
// Nothing reaches the Flow before this: a build only ever proposes.

import type { ExistingFlowAdaptation } from "../../existing-fluxiq-control.js";
import { RunnerFailure } from "../../failure.js";

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
  input: { projectId: string; flowId: string; adaptationId: string; authorizationPin: string },
): Promise<CreatedFlowReview> {
  await control.approveFlowAdaptation(input);
  const applied = await control.applyFlowAdaptation(input);
  const appliedMutationCount = applied.appliedMutationCount ?? 0;
  if (appliedMutationCount < 1) {
    throw new RunnerFailure("runtime.behavior", "Core applied the build's proposal but reported no change to the Flow", { details: { adaptationId: input.adaptationId } });
  }
  return Object.freeze({ adaptationId: input.adaptationId, appliedMutationCount });
}
