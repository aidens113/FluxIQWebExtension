/**
 * The run's task as the spend ledger names it (`scripts/lab/live-guards/live-launch.mjs`):
 * `<scenario>/<instruction task or llm task>[/workflow=..][/variant=..]`, so a
 * row of the run index and a ledger line about the same run read alike.
 */
export function ledgerTask(input: { scenarioId: string; work: string; workflowId?: string | undefined; variantId?: string | undefined }): string {
  return [input.scenarioId, input.work, ...(input.workflowId ? [`workflow=${input.workflowId}`] : []), ...(input.variantId ? [`variant=${input.variantId}`] : [])].join("/");
}
