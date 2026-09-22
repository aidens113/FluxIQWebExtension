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
//
// **A refusal is reported with what Core said about it.** The standing product
// rule is that a blocked action is put to the person rather than quietly
// refused, so the two refusals here are not the same event and this module
// stopped flattening them into one word on 2026-09-22. Core answering "no" has
// *already* raised a request the person will see, and says which classes are
// missing and which request carries them; a caller with no check to pass has
// raised nothing, and there is nobody to ask at all. `requestId` is what tells
// the two apart, and both it and `missing` travel into the refusal the model is
// given (`./press.ts`, `./tool-rejection.ts`), so neither the model nor a trace
// has to guess which of them happened.

import type { AutomationStudioActionConsequence, AutomationStudioActionPermissionCheck } from "fluxiq/automation-studio";
import { isAutomationStudioActionConsequence } from "fluxiq/automation-studio";

/**
 * How an action a model declared stands: nothing to ask, asked and allowed,
 * refused, or unreadable.
 *
 * `refused` always means: do not take it. `missing` is the classes this run
 * does not hold, in Core's own words, and `requestId` names the request Core
 * raised for the person -- `null` where there was no check to ask, so nothing
 * was raised and nobody can answer it.
 */
export type WebActionPermission =
  | { kind: "no_consequence" }
  | { kind: "permitted" }
  | { kind: "refused"; missing: readonly AutomationStudioActionConsequence[]; requestId: string | null }
  | { kind: "invalid" };

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
  if (input.declared === undefined) return { kind: "no_consequence" };
  if (!Array.isArray(input.declared) || input.declared.length > 10 || !input.declared.every(isAutomationStudioActionConsequence)) return { kind: "invalid" };
  if (input.declared.length === 0) return { kind: "no_consequence" };
  const declared: readonly AutomationStudioActionConsequence[] = input.declared;
  // Nobody to ask, so the whole declaration is what is missing: none of it was
  // put to anyone.
  if (input.check === undefined) return { kind: "refused", missing: declared, requestId: null };
  const name = input.control.name?.trim() || `an unlabelled ${input.control.kind}`;
  const verdict = await input.check({ consequences: declared, control: { name, kind: input.control.kind }, verb: input.verb });
  if (verdict.permitted) return { kind: "permitted" };
  return { kind: "refused", missing: verdict.missing, requestId: verdict.requestId };
}
