import type { FlowStopWithoutFailedAttempt, PersistedFlowAction, PersistedFlowRunOutcome } from "../persisted-flow-run.js";
import { recoveredByNode } from "../node-recovery.js";

/**
 * `FlowStopWithoutFailedAttempt` for a failed run whose attempted nodes all
 * ended well, over the action nodes `actionTypes` names. Historical failures
 * followed by success are healed; a node whose final attempt is unresolved,
 * cancelled or unknown is not a clean stop. This adds diagnosis only and
 * never changes the run's failed status.
 */
export function stopWithoutFailedAttempt(
  status: PersistedFlowRunOutcome["status"],
  actions: readonly PersistedFlowAction[],
  attemptedNodeIds: ReadonlySet<string>,
  actionTypes: ReadonlyMap<string, string> | undefined,
): FlowStopWithoutFailedAttempt | undefined {
  if (status !== "failed" || !actionTypes?.size || !recoveredByNode(actions).every((recovered) => recovered)) return undefined;
  const actionNodeIds = [...actionTypes.keys()];
  const attemptedActions = actionNodeIds.filter((nodeId) => attemptedNodeIds.has(nodeId)).length;
  const unvisitedActions = actionNodeIds.length - attemptedActions;
  return unvisitedActions > 0 ? { attemptedActions, unvisitedActions } : undefined;
}

