// The two things Core asks this domain to interpret while an exploration runs:
// how to read one of its refusals, and what "where the exploration is" means
// here.
//
// Both are domain meaning Core deliberately does not hold. Core cannot
// interpret `web.action.rejected.cross_origin`, and must never learn to: the
// refusal is a statement about a browser page, and Core has no browser in it. Core likewise holds the scope policy and compares opaque strings without
// ever learning that this domain spells a scope as an origin, which is exactly
// what lets a domain with no pages use the same policy for its own idea of
// where it is. So the translations live here, in the domain that owns the
// meaning, and their output is Core's own closed vocabulary.
//
// They sit beside `vocabulary.ts` rather than in it: that file names the
// options this bundle registers, these two are read at run time by the
// exploration, and keeping them apart is also what holds each file inside the
// exported-value budget.

import type { AutomationStudioExplorationRefusal } from "fluxiq/automation";
import { webLlmToolRejectionResultCode } from "../vocabulary";

/**
 * This domain's refusals, in Core's refusal kinds.
 *
 * A classified refusal ends nothing (Core t1057). Every refusal, classified or
 * not, reaches the model as the action's result, with its code and reason, and
 * the model tries something else; Core's loop detection and the model's own loop
 * decision handle a run of them. Classifying one says what kind of refusal it
 * was: Core records it by kind on the exploration and its trace, counts the
 * action as refused rather than observed, and leaves it out of a reduction as a
 * step that did not happen. What ends an exploration is its answer, the run's
 * purse, its clock or a person -- never a count of refusals or actions.
 *
 * Only the scope refusals are classified, because only they say the action was
 * outside what the exploration may do. There used to be a third, `target_unsafe` as
 * `destructive_action_refused`, raised when this domain judged from a
 * control's shape or wording -- and at first from its selector -- that it must
 * not be pressed. That judgement is gone (see `../press.ts`), and nothing
 * raises the code, so it is gone from the vocabulary too rather than left as a
 * refusal waiting for someone to reuse.
 *
 * `permission_required` is left unclassified on purpose. It means Core's own
 * permission check said no (`../permission.ts`), and Core has already raised
 * the request and knows what follows; `operator_approval_required` is not one
 * of Core's refusal kinds, and Core records any answer outside them as
 * `destructive_action_refused`.
 *
 * Anything this function does not classify is ordinary feedback -- the model is
 * told no and tries something else -- and counts as an observed action. The
 * rest -- `invalid_input`,
 * `no_progress`, `target_unobserved`, `sensitive_value` and
 * `no_repeating_structure` -- are deliberately left unclassified and listed
 * here so the omission is a decision a reader can see rather than a gap:
 *
 * - `invalid_input` and `target_unobserved` are the model getting it wrong, and
 *   it can get it right on the next turn.
 * - `no_progress` means the page did not change, which the loop's own repeat
 *   detection already steers.
 * - `sensitive_value` is raised by one option, structure detection, for a list
 *   whose every field is a sensitive control. Nothing was read or shown: the
 *   answer is "that list is all secrets", and the model can name another
 *   target or another page, so it is an answer rather than a refusal. Core's
 *   refusal kinds have none it would fit, and recording it as
 *   `destructive_action_refused` would call an exploration unsafe that never
 *   was. The inspect and press options never raise it; the sanitizer drops a
 *   secret-bearing control before the model can name it.
 * - `no_repeating_structure` is detection saying the page has no readable list
 *   there, which is an answer, not a stop. It stays unclassified now that it
 *   says *which* of the four situations it is (`../structure/refusal.ts`), and
 *   more firmly than before: each of the four names a different next move the
 *   exploration can make -- point somewhere else, ask page-wide, deal with what
 *   covers the page, go where the content is -- so treating it as a refusal
 *   would misreport one that had just been told what to do. A model that
 *   ignores all four is steered by Core's loop detection and ended by the purse.
 *
 * A model that does nothing but get refused goes on until the purse or the clock
 * ends it, and the exploration then ends `budget_exhausted` on that code -- never
 * as one that quietly found nothing, because a refused action is never evidence.
 */
export function webAutomationExplorationRefusalClassifier(resultCode: string): AutomationStudioExplorationRefusal | undefined {
  if (resultCode === webLlmToolRejectionResultCode("out_of_scope") || resultCode === webLlmToolRejectionResultCode("cross_origin")) return "out_of_scope_refused";
  return undefined;
}

/**
 * What "where the exploration is" means for this domain: the page's origin.
 *
 * Core holds the scope policy and compares opaque strings; it never learns that
 * this domain spells a scope as an origin, which is exactly what lets a domain
 * with no pages use the same policy for its own idea of where it is.
 */
export function webAutomationExplorationScope(location: string): string {
  return new URL(location).origin;
}
