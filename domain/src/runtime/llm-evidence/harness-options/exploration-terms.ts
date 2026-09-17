// The two things Core asks this domain to interpret while an exploration runs:
// how to read one of its refusals, and what "where the exploration is" means
// here.
//
// Both are domain meaning Core deliberately does not hold. Core cannot
// interpret `web.action.rejected.target_unsafe`, and must never learn to: the
// refusal is a statement about a browser control, and Core has no browser in
// it. Core likewise holds the scope policy and compares opaque strings without
// ever learning that this domain spells a scope as an origin, which is exactly
// what lets a domain with no pages use the same policy for its own idea of
// where it is. So the translations live here, in the domain that owns the
// meaning, and their output is Core's own closed vocabulary.
//
// They sit beside `vocabulary.ts` rather than in it: that file names the
// options this bundle registers, these two are read at run time by the
// exploration, and keeping them apart is also what holds each file inside the
// exported-value budget.

import type { AutomationStudioExplorationStopReason } from "fluxiq/automation-studio";
import { webLlmToolRejectionResultCode } from "../vocabulary";

/**
 * This domain's refusals, in Core's vocabulary.
 *
 * Only the two that are genuinely terminal are classified. Anything this
 * function does not classify is ordinary feedback -- the model is told no and
 * tries something else -- which is the default, because a refusal that ends the
 * whole exploration is the exception. The rest -- `invalid_input`,
 * `no_progress`, `target_unobserved`, `sensitive_value` and
 * `no_repeating_structure` -- are deliberately left unclassified and listed
 * here so the omission is a decision a reader can see rather than a gap:
 *
 * - `invalid_input` and `target_unobserved` are the model getting it wrong, and
 *   it can get it right on the next turn.
 * - `no_progress` means the page did not change, which the loop's own repeat
 *   detection and the budget's repeat limit already bound.
 * - `sensitive_value` is raised by one option, structure detection, for a list
 *   whose every field is a sensitive control. Nothing was read or shown: the
 *   answer is "that list is all secrets", and the model can name another
 *   target or another page, so it is an answer rather than a stop. Core's stop
 *   vocabulary has no reason it would fit, and forcing it into
 *   `destructive_action_refused` would end an exploration that was never
 *   unsafe. The inspect and act options never raise it; the sanitizer drops a
 *   secret-bearing control before the model can name it.
 * - `no_repeating_structure` is detection saying the page has no readable list
 *   there, which is an answer, not a stop.
 *
 * Every unclassified refusal is still charged against the action budget, so a
 * model that does nothing but get refused ends in `budget_exhausted` rather
 * than in an exploration that quietly found nothing.
 */
export function webAutomationExplorationRefusalClassifier(resultCode: string): AutomationStudioExplorationStopReason | undefined {
  if (resultCode === webLlmToolRejectionResultCode("target_unsafe")) return "destructive_action_refused";
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
