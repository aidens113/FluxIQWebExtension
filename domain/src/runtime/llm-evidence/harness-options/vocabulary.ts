// The words this bundle puts on the wire, and the one place Core is told how
// to read them.
//
// Core cannot interpret `web.action.rejected.target_unsafe`, and must never
// learn to: the refusal is a statement about a browser control, and Core has no
// browser in it. So the translation lives here, in the domain that owns the
// meaning, and its output is Core's own closed vocabulary of stop reasons.
// Anything this function does not classify is ordinary feedback -- the model
// is told no and tries something else -- which is the default, because a
// refusal that ends the whole exploration is the exception.

import type { AutomationStudioExplorationStopReason } from "fluxiq/automation-studio";
import { webLlmToolRejectionResultCode } from "../vocabulary";

/** Every option this bundle registers, in the order it registers them. */
export const WEB_RECOVERY_HARNESS_OPTION_IDS = [
  "web.recovery.inspect",
  "web.recovery.reveal",
  "web.recovery.act_safe",
  "web.recovery.wait_for_change",
  "web.recovery.navigate_in_scope"
] as const;

export type WebRecoveryHarnessOptionId = (typeof WEB_RECOVERY_HARNESS_OPTION_IDS)[number];

export const WEB_RECOVERY_INSPECT_OPTION_ID = WEB_RECOVERY_HARNESS_OPTION_IDS[0];
export const WEB_RECOVERY_REVEAL_OPTION_ID = WEB_RECOVERY_HARNESS_OPTION_IDS[1];
export const WEB_RECOVERY_ACT_OPTION_ID = WEB_RECOVERY_HARNESS_OPTION_IDS[2];
export const WEB_RECOVERY_WAIT_OPTION_ID = WEB_RECOVERY_HARNESS_OPTION_IDS[3];
export const WEB_RECOVERY_NAVIGATE_OPTION_ID = WEB_RECOVERY_HARNESS_OPTION_IDS[4];

/**
 * This domain's refusals, in Core's vocabulary.
 *
 * Only the two that are genuinely terminal are classified. The rest --
 * `invalid_input`, `no_progress`, `target_unobserved` and `sensitive_value` --
 * are deliberately left unclassified and listed here so the omission is a
 * decision a reader can see rather than a gap:
 *
 * - `invalid_input` and `target_unobserved` are the model getting it wrong, and
 *   it can get it right on the next turn.
 * - `no_progress` means the page did not change, which the loop's own repeat
 *   detection and the budget's repeat limit already bound.
 * - `sensitive_value` is not raised by any option in this bundle today; the
 *   sanitizer drops a secret-bearing control before the model can name it, so
 *   there is nothing to refuse. If an option ever does raise it, it belongs in
 *   the classified set.
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
