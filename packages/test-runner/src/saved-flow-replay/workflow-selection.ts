// Which workflow and variant a saved-Flow replay resolves.
//
// By default the task's own: the Flow is judged the way the task that built it
// is judged, on the rendering that task names. `lab replay --variant` names
// another variant to arm instead, on the task's workflow. That is the free
// pre-flight before a paid adaptation-gate round: a Flow built on the unchanged
// site is replayed with no model against the armed drift, so whether the drift
// forces a failure (rather than being absorbed by the fingerprint) is known
// before anyone pays for a build (run-mv6v2g3l-a865ead7, t512).

/** The task's own selection, or the named variant in place of the task's. Members are present only when set. */
export function replayWorkflowSelection(task: { workflowId: string | undefined; variantId: string | undefined }, variantId?: string): { workflowId?: string; variantId?: string } {
  const variant = variantId ?? task.variantId;
  return { ...(task.workflowId ? { workflowId: task.workflowId } : {}), ...(variant ? { variantId: variant } : {}) };
}
