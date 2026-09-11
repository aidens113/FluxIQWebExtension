import type { ScenarioExpected, ScenarioStep, ScenarioVariant, WebScenario } from "./scenario.js";

/** One run's workflow: what the recording lane performs and what the run must meet. */
export type ResolvedScenarioWorkflow = {
  workflowId: string | undefined;
  variant: ScenarioVariant | undefined;
  recordingScript: ScenarioStep[];
  expected: ScenarioExpected;
};

/**
 * Resolves the primary workflow (no `workflowId`) or a named `workflows[]`
 * entry, then applies `variantId` from that workflow's own variants: every
 * field the variant's `expected` sets replaces the workflow's field.
 */
export function resolveScenarioWorkflow(
  scenario: WebScenario,
  selection: { workflowId?: string; variantId?: string } = {},
): ResolvedScenarioWorkflow {
  const { workflowId, variantId } = selection;
  const workflow = workflowId === undefined ? scenario : scenario.workflows?.find((candidate) => candidate.id === workflowId);
  if (!workflow) throw new Error(`Scenario ${scenario.id} has no workflow ${workflowId}`);
  const variant = variantId === undefined ? undefined : workflow.variants?.find((candidate) => candidate.id === variantId);
  if (variantId !== undefined && !variant) throw new Error(`Scenario ${scenario.id} workflow ${workflowId ?? "primary"} has no variant ${variantId}`);
  return {
    workflowId,
    variant,
    recordingScript: workflow.recordingScript,
    expected: variant ? { ...workflow.expected, ...variant.expected } : workflow.expected,
  };
}
