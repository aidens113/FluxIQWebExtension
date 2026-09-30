import type { ExpectedPersonHandOff, ScenarioPersonChecks } from "@fluxiq-web-extension/test-contracts";

/**
 * The hand-off a run is held to: the live task's own declaration when it has
 * one (`LiveInstructionTask.personCheck`), else the row the scenario's person
 * module declares for this workflow and variant, else none.
 *
 * A row is matched exactly: the primary workflow is the one with no
 * `workflowId`, and an unarmed row the one with no `variantId`, so a
 * declaration about a variant never leaks onto its unarmed workflow.
 */
export function expectedPersonHandOff(input: {
  module: ScenarioPersonChecks | null;
  workflowId: string | undefined;
  variantId: string | undefined;
  task?: ExpectedPersonHandOff | undefined;
}): ExpectedPersonHandOff | null {
  if (input.task) return { person: input.task.person, required: input.task.required, because: input.task.because };
  const row = input.module?.handOffs.find((entry) => entry.workflowId === input.workflowId && entry.variantId === input.variantId);
  return row ? { person: row.person, required: row.required, because: row.because } : null;
}
