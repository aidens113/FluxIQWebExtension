// Which faults a node's own execution absorbs, and which it must not.
//
// The user's rule, 2026-09-26: the runtime is defensive by default, for every
// node, custom or core, and a Flow does not stop because something recoverable
// went wrong. This file is the line that makes that a policy rather than a
// sentiment, because "retry it" without a line is how a mutating action runs
// twice and how a deterministic refusal costs a full retry cycle before
// answering the same way.
//
// **The first gate is the repository's own declaration, not a new opinion.**
// Every code in the closed set is already bound to a `retryable` flag in
// `domain/src/runtime/failure/codes.ts`, whose own comment says what the flag
// answers: "whether retrying the same action unchanged can succeed without a
// person or a Flow edit". Five codes say yes -- a target that was not found, a
// post-condition that did not appear, a page that moved, a wait that expired,
// and a verb that threw a reason no code names. Everything else says no, and no
// amount of waiting turns an ambiguous target, an authored parameter Core
// refused, a sign-in wall or a verb this build does not implement into a
// success. Reading the flag rather than restating it means a code added to the
// set arrives here with its answer already decided.
//
// **The second gate is the mutation rule, and it is the one that needed
// writing.** A retryable code says a retry *can* work; it does not say a retry
// is *safe*. A click that dispatched its gesture and then lost the confirmation
// -- the page navigated during the hit test, the frame went away before the
// post-condition could be read -- has very probably already done what it was
// asked to do, and pressing it again buys a second order, a second message, a
// second row. So a verb that changes the page is absorbed only on a fault
// decided **before anything was dispatched**, which of the five is exactly
// `target_absent`: `resolve-target.ts` throws before a verb touches the page at
// all. The other four are all decided after the gesture, or after a read that
// followed one, and for a mutating verb they end the attempt honestly instead.
//
// A verb that only reads has no such exposure and absorbs all five: reading the
// same page twice costs time and nothing else.
//
// **`web.dom.extract_list` is judged per command, not per type, and that is the
// row this file exists for.** A list read only reads -- but it reads by
// *following pagination*, and a second attempt at a read that already pressed
// "next" resumes from whichever page the first one reached, answering with rows
// duplicated or rows skipped. So the question is not whether the verb reads; it
// is whether running it again can move the page. A request that names no
// `paginate` cannot, so it is a pure read and absorbs all five faults. One that
// names pagination can, so it absorbs only `target_absent`, and its defence
// against a list drawn late stays its own bounded wait, measured and settled on
// 2026-09-25 (`extraction/page-render.ts`).
//
// **That row is the one the audit measured.** `minItems` defaults to 1, so a
// read of a page that had not finished drawing fails its own post-condition and
// reports OUTPUT_NOT_OBSERVED -- and **eleven of roughly eighteen reportable
// live runs died on exactly that code**
// (`docs/working/language-driven-flow-loop-plan/reports/t163-defensive-runtime-audit.md`,
// section 2, "An empty or partial result"). Core declines to retry it because
// its retry gate excludes the whole `verification` stage, using the stage as a
// proxy for side-effect safety that the stage does not carry
// (`retry-policy.ts:90` in FluxIQ Core's `runtime/executor/`). That gate is
// Core's to fix and another task's file. What this loop does is answer the same
// fault one layer earlier, in the page, where the side-effect question can
// actually be asked of the command -- so an unpaginated read of a slow page is
// read again here and never reaches the gate at all.

import {
  WEB_AUTOMATION_ACTION_TYPES,
  WEB_AUTOMATION_FAILURE_CODES,
  WEB_AUTOMATION_FAILURE_CODE_DEFINITIONS,
  isWebAutomationFailureCode,
  type WebAutomationActionType,
  type WebAutomationFailureCode
} from "@fluxiq-web-extension/domain/client";
import type { BrowserActionCommand, BrowserActionResult } from "../../types";

/**
 * The fault a node's execution survived, as one word from a closed set.
 *
 * One word per retryable code, and the mapping below is total over them, so a
 * code the set later marks retryable cannot arrive here as a fault with no
 * name. Words rather than the codes themselves because this is an account of
 * what the *execution* absorbed, which is a different question from what the
 * *command* finally reported, and a reader tallying one must not be able to
 * mistake it for the other.
 */
export type RecoveryFault = "target_absent" | "output_not_observed" | "page_changed" | "timeout" | "action_failed" | "transport" | "blocking_dialog" | "obstructed_target" | "disabled_target" | "rate_limited";

/**
 * Each retryable code's fault word. Total over the retryable half of the closed
 * set, which `tests/fault.test.ts` holds it to: a new retryable code with no
 * word here fails that test rather than silently becoming a fault nothing
 * absorbs.
 */
export const RECOVERY_FAULT_BY_CODE: Readonly<Partial<Record<WebAutomationFailureCode, RecoveryFault>>> = Object.freeze({
  [WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_FOUND]: "target_absent",
  [WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED]: "output_not_observed",
  [WEB_AUTOMATION_FAILURE_CODES.PAGE_CHANGED]: "page_changed",
  [WEB_AUTOMATION_FAILURE_CODES.TIMEOUT]: "timeout",
  [WEB_AUTOMATION_FAILURE_CODES.ACTION_FAILED]: "action_failed",
  // Reported by the background worker rather than by a verb in this frame
  // (`runtime/action-runner.ts`), so this loop does not see it in practice. It is
  // mapped all the same, because the totality check below is what keeps a code
  // Core may later mark retryable from arriving here as a fault with no name.
  [WEB_AUTOMATION_FAILURE_CODES.TRANSPORT_TRANSIENT]: "transport",
  // Named for the totality check, and never absorbed here: see
  // `ABSORBED_ELSEWHERE` below.
  [WEB_AUTOMATION_FAILURE_CODES.RATE_LIMITED]: "rate_limited"
} as const);

/**
 * Retryable faults this loop names and leaves to Core.
 *
 * A press the page refused for going too fast asks for a wait of seconds --
 * twelve on social-network-feed -- and this loop's whole budget is five
 * (`budget.ts`), so a retry here would press again inside the page's window and
 * earn the same notice. Core's node-level defence honours the wait the record
 * carries (`retryAfterMs`) and re-runs the node after it, which is the one place
 * the act is made again.
 */
const ABSORBED_ELSEWHERE: ReadonlySet<RecoveryFault> = new Set<RecoveryFault>(["rate_limited"]);

/**
 * The refusal reason words that mean "something was over the target", as
 * `actionability.ts` writes them. They are a closed machine vocabulary, not
 * prose: `ActionabilityRejectionCode` has exactly three members, the reason is
 * written as the leading token of the record's `actual`, and the domain already
 * reads that same token off the wire to tell an overlay from a disabled control
 * (`runtime/llm-evidence/action-failure.ts`).
 *
 * `disabled`, the third member, is deliberately absent, and it is the row that
 * makes this a list rather than "every ACTION_REJECTED". `covered` and `hidden`
 * are only ever produced by the actionability gate, which runs before any verb
 * touches the page, so a retry cannot repeat an act. `disabled` is produced
 * there too -- but also by `actions/check.ts` after `setCheckedState` failed, by
 * `actions/upload.ts` after `setInputFiles` failed, and by `actions/select.ts`
 * for an option that will be disabled however often it is asked. Absorbing the
 * word alone would mean retrying a verb that had already dispatched, which is
 * exactly what the mutation rule above forbids; `disabledBeforeDispatch` below
 * absorbs it only where the record says nothing was dispatched.
 */
const OBSTRUCTION_REASONS: readonly string[] = Object.freeze(["covered", "hidden"]);

/**
 * The faults that are not the failed action repeated unchanged: the page is
 * different by the time the verb runs again, because the loop cleared what was
 * over it first.
 *
 * **These are not gated on `retryable`, and that is the whole point.** Core's
 * own recovery ladder learned this first and says it in the same words: its
 * rungs that "wait for a state or clear an obstruction *and then* attempt" used
 * to be gated on `retryable`, "which switched the interference rung off for the
 * one thing it was built for: a dialog over the page reports
 * `blocked_by_dialog`, which is not retryable, so the rung for dialogs was
 * disabled by the dialog code" (`runtime/executor/recovery-ladder.ts` in FluxIQ
 * Core). The flag answers whether repeating the action *unchanged* can work,
 * and clearing the dialog first is a change to the page, not a repetition.
 *
 * **Every verb absorbs them, mutating or not**, because both are decided by the
 * actionability gate before the verb dispatched anything at all -- the same
 * reason `target_absent` is the one transient fault a mutating verb absorbs.
 * `results.ts` calls this shape "an action refused before it ran".
 */
const OBSTRUCTION_FAULTS: Readonly<Partial<Record<WebAutomationFailureCode, RecoveryFault>>> = Object.freeze({
  [WEB_AUTOMATION_FAILURE_CODES.BLOCKED_BY_DIALOG]: "blocking_dialog",
  [WEB_AUTOMATION_FAILURE_CODES.ACTION_REJECTED]: "obstructed_target"
} as const);

/** The refusal reason word for a control the page will not let anything use yet. */
const DISABLED_REASON = "disabled";

/**
 * A control the page disabled, refused by the actionability gate before the
 * verb dispatched anything.
 *
 * The case it exists for: job-board's applicant tracker shows its "I'm a
 * person" button disabled, reading "Please wait N", for three seconds after
 * Submit, and a Flow reaches that step well inside three seconds -- so the step
 * failed ACTION_REJECTED on a control that was about to be usable
 * (reports/t195-w19d-audit-apply-quillmark.md, C5). Waiting it out is safe only
 * because of where the refusal was decided, which the word cannot say and the
 * record does: a gate refusal states Core's closed `effect: "unacted"`
 * (`results.ts`, set by the gate call sites in `actions/`), and a `disabled`
 * written after a verb acted -- `check.ts` after `setCheckedState`, `upload.ts`
 * after `setInputFiles` -- or for a select's option states nothing, and stays a
 * refusal. No sentence is read: the reason token and the effect are both
 * closed vocabularies.
 *
 * Not an obstruction: nothing stands over the control, so the loop waits and
 * does not press any layer's way out.
 */
function disabledBeforeDispatch(code: WebAutomationFailureCode, result: BrowserActionResult): boolean {
  if (code !== WEB_AUTOMATION_FAILURE_CODES.ACTION_REJECTED) return false;
  const failure = result.failure;
  if (failure?.effect !== "unacted" || typeof failure.actual !== "string") return false;
  return failure.actual.startsWith(`${DISABLED_REASON}:`);
}

/** Every fault word an obstruction can be reported as, for the totality check the tests make. */
export const RECOVERY_OBSTRUCTION_FAULTS: readonly RecoveryFault[] = Object.freeze(["blocking_dialog", "obstructed_target"]);

/**
 * Whether this fault is one the loop answers by acting on the page before it
 * retries, rather than by waiting alone.
 *
 * Waiting alone does not move a dialog: a promotion that opened over the page
 * is still there four seconds later, so a defence that only paused would spend
 * its whole ladder and report the same refusal. These two are the faults whose
 * retry is worth making only after `interference/clear.ts` has pressed the
 * layer's own way out.
 */
export function faultNeedsInterference(fault: RecoveryFault): boolean {
  return fault === "blocking_dialog" || fault === "obstructed_target";
}

/**
 * Whether this fault may be a target the page draws only once a layer over it
 * is answered, so that the loop clears such a layer -- when one is there --
 * before it waits.
 *
 * `target_absent` only. A consent wall is not over the target when the target
 * is not drawn at all: company-website opens its newsletter offer four seconds
 * after consent is answered, so a fresh visitor's playback met
 * `target_not_found`, never a covered refusal, and the loop waited out its
 * ladder at a wall it cleared only for an obstruction (lane t174, row R2). It
 * is not `faultNeedsInterference`, because a missing target is usually just
 * late and must not be pressed at blind: the loop clears for it only when the
 * page shows a clearable layer (`interference/presence.ts`), and waits on the
 * target's own ladder either way. It is the one fault a mutating verb absorbs,
 * decided before anything was dispatched, so clearing and retrying repeats no
 * act.
 */
export function faultMayHideBehindLayer(fault: RecoveryFault): boolean {
  return fault === "target_absent";
}

/**
 * The obstruction this result reports, if it reports one.
 *
 * BLOCKED_BY_DIALOG needs no reason word: it is produced in one place, from a
 * `covered` or `hidden` refusal with a dialog standing over the page, so it
 * already means what the reason words mean. ACTION_REJECTED is the code every
 * other refusal shares, so its reason word is what separates a layer over the
 * target from a target that refused on its own account.
 */
function obstructionFault(code: WebAutomationFailureCode, result: BrowserActionResult): RecoveryFault | undefined {
  const fault = OBSTRUCTION_FAULTS[code];
  if (fault === undefined) return undefined;
  if (code !== WEB_AUTOMATION_FAILURE_CODES.ACTION_REJECTED) return fault;
  const actual = result.failure?.actual;
  if (typeof actual !== "string") return undefined;
  return OBSTRUCTION_REASONS.some((reason) => actual.startsWith(`${reason}:`)) ? fault : undefined;
}

/**
 * The one fault decided before a verb dispatched anything, so the one a verb
 * that changes the page may be retried on.
 *
 * `resolve-target.ts` throws before any verb touches the page: the gesture, the
 * value, the key press and the file have not happened, and nothing on the page
 * can have moved because of this attempt. Every other fault word is reported at
 * or after the point a mutating verb has already acted.
 */
const DECIDED_BEFORE_DISPATCH: ReadonlySet<RecoveryFault> = new Set<RecoveryFault>(["target_absent"]);

/**
 * The action types that only read, and so may be retried on any transient
 * fault.
 *
 * Total over `WEB_AUTOMATION_ACTION_TYPES` by omission -- anything not here is
 * treated as changing the page, which is the safe direction for a type added
 * later and never classified. `tests/fault.test.ts` asserts every known type is
 * decided, so the omission is checked rather than assumed.
 *
 * `web.dom.extract_list` is **not** here: it reads, but it pages, and the file
 * comment says why paging makes a second attempt unsafe.
 */
const READS_ONLY: ReadonlySet<WebAutomationActionType> = new Set<WebAutomationActionType>([
  "web.dom.capture_snapshot",
  "web.dom.extract",
  "web.dom.assert",
  "web.dom.wait_for_selector",
  "web.dom.wait_for_text"
]);

/**
 * Whether running this command again cannot move the page, which decides how
 * much of the transient set it absorbs.
 *
 * The command rather than the type alone, because one type answers both ways:
 * `web.dom.extract_list` is a pure read until its request names `paginate`, at
 * which point re-running it presses a control and lands on a different page. A
 * command whose type is unknown to this build answers `false`, which is the safe
 * direction for a verb added and never classified.
 */
export function webActionReadsOnly(action: Pick<BrowserActionCommand, "actionType" | "extractList">): boolean {
  if (action.actionType === "web.dom.extract_list") return action.extractList?.paginate === undefined;
  return READS_ONLY.has(action.actionType as WebAutomationActionType);
}

/**
 * The fault this result may be retried on, or `undefined` for a result that is
 * finished -- succeeded, or failed for a reason retrying cannot change.
 *
 * Read off the failure record's code, and -- for ACTION_REJECTED alone -- the
 * closed reason token that code is written with. No sentence is read: a
 * decision taken from prose is a decision that changes when someone improves
 * the wording, and this one decides whether a page gets pressed a second time.
 * The reason token is not prose. It is one of three members of
 * `ActionabilityRejectionCode`, written by the gate as the leading `word:` of
 * the record's `actual`, and it is the only thing that separates a target with
 * a layer over it from a target that refused on its own account -- a difference
 * ACTION_REJECTED does not carry, because it is one code for every refusal.
 */
export function recoverableFault(result: BrowserActionResult, action: Pick<BrowserActionCommand, "actionType" | "extractList">): RecoveryFault | undefined {
  if (result.status === "succeeded") return undefined;
  const code = result.failure?.code;
  if (!isWebAutomationFailureCode(code)) return undefined;
  const obstruction = obstructionFault(code, result);
  if (obstruction !== undefined) return obstruction;
  if (disabledBeforeDispatch(code, result)) return "disabled_target";
  if (!WEB_AUTOMATION_FAILURE_CODE_DEFINITIONS[code].retryable) return undefined;
  const fault = RECOVERY_FAULT_BY_CODE[code];
  if (fault === undefined || ABSORBED_ELSEWHERE.has(fault)) return undefined;
  if (webActionReadsOnly(action)) return fault;
  return DECIDED_BEFORE_DISPATCH.has(fault) ? fault : undefined;
}

/** Every action type this build knows, for the totality check the tests make. */
export const RECOVERY_KNOWN_ACTION_TYPES: readonly WebAutomationActionType[] = WEB_AUTOMATION_ACTION_TYPES;
