/** The fields of a run's options that name which workflow and variant it runs. */
export type WorkflowSelectionOptions = { workflowId?: string; variantId?: string };

/**
 * The workflow and variant a run selected, as the scenario contract's resolvers
 * take it: a field is present only when the run named one.
 *
 * The conditional spread is the whole point. Under `exactOptionalPropertyTypes`
 * an explicit `workflowId: undefined` is not the same value as an absent
 * `workflowId`, and the contract's resolvers read absence as "the primary
 * workflow" while reading `undefined` as a request for a workflow with no id.
 * Every caller that needs a selection goes through this, so that rule is
 * written once.
 */
export function workflowSelection(options: WorkflowSelectionOptions): { workflowId?: string; variantId?: string } {
  return { ...(options.workflowId === undefined ? {} : { workflowId: options.workflowId }), ...(options.variantId === undefined ? {} : { variantId: options.variantId }) };
}
