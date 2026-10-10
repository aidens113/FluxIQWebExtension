// Which web actions commit: the ones whose effect is the page's to decide, so a
// lost acknowledgement leaves it unknown whether they happened (plan B3).
//
// The same set a Flow step must declare consequences for
// (`runtime/llm-evidence/plan-resolution/step-permission.ts`,
// `webPlanStepMustDeclare`): a press, a key press, a dialog answer, and typing
// that sends its form. It is restated here, as plain values, because the
// extension's background bundle asks it before every command and that module
// reaches Core's runtime through the permission gate. `tests/commits.test.ts`
// holds the two to the same answer for every action type, so they cannot drift.

import type { JsonObject } from "fluxiq/core";

const COMMITTING_ACTIONS: ReadonlySet<string> = new Set(["web.dom.click", "web.dom.keypress", "web.dom.dialog"]);

/** Whether making this action is a committing act: a lost answer leaves its effect unknown. */
export function webAutomationActionCommits(actionType: string, parameters: JsonObject | undefined): boolean {
  return COMMITTING_ACTIONS.has(actionType) || (actionType === "web.dom.type" && parameters?.submit === true);
}
