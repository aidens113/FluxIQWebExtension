// Asking Core whether an action the model declared may be taken.
//
// The consequence classes are what the model says its own action does -- the
// press it is about to make while exploring, or the step it writes into the
// Flow. They are never FluxIQ's reading of what a control looks like: the user's
// rule is that nothing is refused on FluxIQ's own judgement of a control, and
// the one thing that gates a lasting act is his instruction or his grant. Core
// holds both (`AS/runtime/action-permissions/`), reads the instruction for what
// it asks for, and answers; when the answer is no it has already raised the
// request that goes to the person, so this module only reports the refusal.
//
// An action that declares no lasting consequence asks nothing: moving about,
// opening, ticking a row are undone by looking away. A declaration that is not
// a list of Core's classes is not a declaration at all, and no permission is
// asked for something nobody could read. Without a check to ask -- a caller
// that did not pass Core's -- a declared consequence is refused, never taken.

import type { AutomationStudioActionPermissionCheck } from "fluxiq/automation-studio";
import { isAutomationStudioActionConsequence } from "fluxiq/automation-studio";

/** How an action a model declared stands: nothing to ask, asked and allowed, asked and refused, or unreadable. */
export type WebActionPermission = "no_consequence" | "permitted" | "refused" | "invalid";

/**
 * `control.name` must be the words the model was shown for the control -- Core
 * carries it to the person only when it can find it in evidence already shown.
 * `kind` is one plain word for what the control is; `verb` what the action does to it.
 */
export async function webActionPermission(input: {
  check: AutomationStudioActionPermissionCheck | undefined;
  declared: unknown;
  control: { name: string | undefined; kind: string };
  verb: string;
}): Promise<WebActionPermission> {
  if (input.declared === undefined) return "no_consequence";
  if (!Array.isArray(input.declared) || input.declared.length > 10 || !input.declared.every(isAutomationStudioActionConsequence)) return "invalid";
  if (input.declared.length === 0) return "no_consequence";
  if (input.check === undefined) return "refused";
  const name = input.control.name?.trim() || `an unlabelled ${input.control.kind}`;
  const verdict = await input.check({ consequences: input.declared, control: { name, kind: input.control.kind }, verb: input.verb });
  return verdict.permitted ? "permitted" : "refused";
}
