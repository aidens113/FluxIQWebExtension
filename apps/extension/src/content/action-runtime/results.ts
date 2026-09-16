// The result the background worker receives for an action: what happened, the
// post-condition that proves it happened, and -- when it did not -- the closed
// failure code that says why.
//
// Every result carries a validation (decision D4), so an action cannot report
// success without saying what it checked. `success()` takes one as an argument
// rather than defaulting it: a verb that has no post-condition yet has to say
// so in the call, which is what makes the gap visible instead of silent. A
// failed validation is not a successful action -- it becomes a `failed` result
// carrying `OUTPUT_NOT_OBSERVED`, or `STATE_MISMATCH` when the claim that did
// not hold was the Flow's own `web.dom.assert` rather than the verb's.
//
// Every failure record is built by `webAutomationFailureRecord` from a code in
// the domain's closed set (Phase 1.5 step 3). No wire string is written here:
// the code decides the Core category, the retryable flag and the stage, so a
// record assembled at a call site cannot contradict one of Core's consistency
// rules and be dropped whole by its parser -- which loses the failure rather
// than reporting it. `classifyWebAutomationFailure` covers the one case with no
// code known in advance, an action that threw.
//
// A failure also carries the page as it stood at that instant: `buildResult`
// captures a snapshot for every non-succeeded result whether or not snapshot
// capture is on, because the domain builds the sanitized `web-llm-evidence.v1`
// packet from it (Phase 1.5 step 4) and a snapshot taken later, at diagnosis
// time, describes a page that has since moved on.
//
// Two codes are decided from the page rather than from the verb, and both sit
// here because this is the single point every result passes through.
// `authGateFailure` reports AUTH_REQUIRED when the target (or a list read's
// item selector) matched nothing, or a URL claim did not hold, and what is on
// the page is a sign-in wall.
// `blockedByModal` reports USER_INTERVENTION_REQUIRED when a target was refused
// as covered or inert and a modal dialog is standing over the page -- the
// condition that code was named for, which nothing in the browser path produced
// until now, and which the plan's own corpus row W14 requires.
//
// What a validation implies for the status is decided in
// `validation-outcome.ts`; this module assembles it with what the page can
// tell us.

import {
  WEB_AUTOMATION_FAILURE_CODES,
  classifyWebAutomationFailure,
  isWebAutomationFailureCode,
  webAutomationFailureRecord,
  type WebAutomationFailureCode
} from "@fluxiq-web-extension/domain/client";
import { captureSettings } from "../capture-settings";
import { captureSnapshot } from "../dom-snapshot";
import type {
  BrowserActionCommand,
  BrowserActionResult,
  BrowserActionTargetResolution,
  BrowserActionValidation,
  DomElementDescriptor,
  DomSnapshot,
  JsonValue
} from "../types";
import { boundValidation, statusForValidation } from "./validation-outcome";

type FailureRecord = NonNullable<BrowserActionResult["failure"]>;

/**
 * What an action observed while it ran, all optional and all independent of
 * whether it passed.
 *
 * `resolution` is the measurement that chose the target, and every verb that
 * resolves one now passes it: `resolveTarget` returns it beside the element, so
 * a *successful* resolution reports its strategy, its candidate count and --
 * when scoring decided it -- its scores, which is what D1 promised for every
 * action result and what a bare `Element` return type quietly withheld. It is
 * absent only where nothing was resolved: a keypress with no named target, an
 * assertion about a selector, a scroll to a position.
 *
 * `extracted` holds only what a read took off the page. `web.dom.extract_list`
 * gives an account of its read beside it on `extraction`: counts, a flag and
 * the declared field keys, never page text (C2). A native dialog handled before
 * the action rides on `dialog`, never on `extracted`.
 */
export type ActionResultEvidence = {
  element?: DomElementDescriptor | undefined;
  snapshot?: DomSnapshot | undefined;
  extracted?: JsonValue | undefined;
  extraction?: BrowserActionResult["extraction"];
  dialog?: BrowserActionResult["dialog"];
  resolution?: BrowserActionTargetResolution | undefined;
};

/**
 * An action that threw. The thrown value is the only evidence, so it is read
 * for everything it carries.
 *
 * A thrower that already classified itself wins: `resolve-target.ts` raises a
 * `TargetResolutionError` carrying a TARGET_NOT_FOUND or TARGET_AMBIGUOUS
 * record and the resolution that produced it, and both ride onto the result
 * this function returns rather than being flattened into a sentence -- which is
 * what happened before this seam existed, and why a Flow could not tell an
 * ambiguous target from a missing one. Both then leave the browser, by
 * different doors: `runtime/result-mapping.ts` puts the record on the gateway
 * result's own `failure` field, and `webAutomationActionResultPayload` carries
 * the measurement inside the payload as `resolution`. So the scores a Flow
 * reads are fields, not only the prose the record's `expected` and `actual`
 * spell out. The record is read structurally rather than by class, because the
 * code is what has to be trusted and the class may be a bundled copy; a code
 * outside the closed set is not trusted at all.
 * Failing that, the domain's classifier reads the same attachment itself, so
 * this lift is a shortcut rather than a second mechanism; anything else is an
 * action that ran and failed for a reason no code names.
 */
export function actionFailure(action: BrowserActionCommand, error: unknown, startedAt = Date.now()): BrowserActionResult {
  const message = error instanceof Error ? error.message : "Action failed.";
  const reported = reportedFailure(error);
  const classified = reported ?? classifyWebAutomationFailure(error, { status: "failed", actionType: action.actionType, message });
  const resolution = reportedResolution(error);
  return buildResult(action, startedAt, {
    status: "failed",
    validation: { status: "none", reason: "not-yet-validated" },
    message,
    failure: classified ?? webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.UNKNOWN, { actual: message })
  }, resolution ? { resolution } : {});
}

/** The failure record a thrower attached, when its code is one the closed set names. */
function reportedFailure(error: unknown): FailureRecord | undefined {
  const failure = property(error, "failure");
  const code = property(failure, "code");
  return isWebAutomationFailureCode(code) ? failure as FailureRecord : undefined;
}

/** The target diagnostics a thrower attached: which strategy was tried, and how many candidates it weighed. */
function reportedResolution(error: unknown): BrowserActionTargetResolution | undefined {
  const resolution = property(error, "resolution");
  if (typeof property(resolution, "strategy") !== "string") return undefined;
  return typeof property(resolution, "candidateCount") === "number" ? resolution as BrowserActionTargetResolution : undefined;
}

function property(value: unknown, name: string): unknown {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>)[name] : undefined;
}

/**
 * The result of an action that ran. `validation` decides the status: a passed
 * or skipped validation succeeds, a failed one reports `failed` with the two
 * values that disagreed.
 *
 * A failed `web.dom.assert` is STATE_MISMATCH, not OUTPUT_NOT_OBSERVED. The
 * distinction is the whole point of the pair: the assert verb's post-condition
 * is the Flow's claim about the page, so a failure means the page is in a state
 * other than the asserted one, while OUTPUT_NOT_OBSERVED means an action ran
 * without its own effect appearing. A Flow recovers from them differently.
 */
export function success(
  action: BrowserActionCommand,
  startedAt: number,
  message: string,
  validation: BrowserActionValidation,
  evidence: ActionResultEvidence = {}
): BrowserActionResult {
  const bounded = boundValidation(validation);
  return buildResult(action, startedAt, {
    status: statusForValidation(bounded),
    validation: bounded,
    message,
    failure: bounded.status === "failed"
      ? webAutomationFailureRecord(unobservedOutputCode(action), { expected: bounded.expected, actual: bounded.actual })
      : undefined
  }, evidence);
}

/**
 * An action refused before it ran: the target was disabled, hidden, or covered.
 *
 * `reason` is the verb's own word for the refusal -- `disabled`, `covered`,
 * `hidden`, `not_checkable` -- and it travels in the record's `actual`, not in
 * its code. ACTION_REJECTED is one code, not one per reason: a reason invented
 * at a call site would be outside the closed set, and Core routes on the
 * category, which is the same for every refusal.
 *
 * One refusal is not that failure at all, and it is the second place a code is
 * decided from the page rather than from the verb: a target the page will not
 * let anything touch *because a modal dialog is waiting for an answer*. See
 * `blockedByModal` for the rule and what it deliberately does not claim.
 */
export function actionRejected(
  action: BrowserActionCommand,
  startedAt: number,
  reason: string,
  expected: string,
  actual: string,
  evidence: ActionResultEvidence = {}
): BrowserActionResult {
  const validation = boundValidation({ status: "failed", expected, actual });
  const observed = validation.status === "failed" ? validation.actual : actual;
  const modal = blockedByModal(reason);
  if (modal) {
    return buildResult(action, startedAt, {
      status: "failed",
      validation,
      message: `Action blocked: ${observed}; ${modal}`,
      failure: webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.USER_INTERVENTION_REQUIRED, {
        expected,
        actual: `${reason}: ${observed}; ${modal}`
      })
    }, evidence);
  }
  return buildResult(action, startedAt, {
    status: "failed",
    validation,
    message: `Action rejected: ${observed}`,
    failure: webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.ACTION_REJECTED, { expected, actual: `${reason}: ${observed}` })
  }, evidence);
}

/** A wait or an action that ran out of time. The status is `timed_out`, never flattened to `failed`. */
export function actionTimedOut(
  action: BrowserActionCommand,
  startedAt: number,
  message: string,
  validation: BrowserActionValidation,
  evidence: ActionResultEvidence = {}
): BrowserActionResult {
  const bounded = boundValidation(validation);
  return buildResult(action, startedAt, {
    status: "timed_out",
    validation: bounded,
    message,
    failure: webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.TIMEOUT, bounded.status === "none"
      ? { actual: message }
      : { expected: bounded.expected, actual: bounded.actual })
  }, evidence);
}

/** A verb that is registered but not built yet. */
export function actionNotImplemented(action: BrowserActionCommand, startedAt: number, what: string): BrowserActionResult {
  return buildResult(action, startedAt, {
    status: "failed",
    validation: { status: "none", reason: "not-yet-validated" },
    message: `${what} is not implemented yet.`,
    failure: webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.NOT_IMPLEMENTED, {
      expected: `${what} to be implemented`,
      actual: "the verb is registered but has no implementation"
    })
  }, {});
}

/** A failed assertion is the Flow's claim about the page; every other failed post-condition is the verb's own. */
function unobservedOutputCode(action: BrowserActionCommand): WebAutomationFailureCode {
  return action.actionType === "web.dom.assert"
    ? WEB_AUTOMATION_FAILURE_CODES.STATE_MISMATCH
    : WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED;
}

/**
 * AUTH_REQUIRED, when the page itself explains the failure better than the verb
 * could: what the action looked for is not in this document, and what is here
 * is a sign-in gate. An expired session is the common cause, and it is the one
 * failure a retry can never clear -- Core's `auth_required` asks a person to
 * sign in instead of retrying, so reporting it as a missing target or a bare
 * thrown error leaves the orchestrator retrying a wall.
 *
 * "Not in this document" has two shapes: the element the action named matches
 * nothing, or a `web.dom.assert` URL claim did not hold. For
 * `web.dom.extract_list` the element named is the list's item selector, so an
 * empty list read off a sign-in gate reports the gate rather than
 * OUTPUT_NOT_OBSERVED (decision D4). The URL claim is W19's --
 * a replayed click's recorded landing is checked as a URL, and an expired
 * session leaves the browser on the gate instead. A URL claim that names no URL
 * is a malformed Flow, not a session, so it is left as it was, as is an action
 * that named neither.
 *
 * Both halves are required, because either alone is ordinary: a sign-in form on
 * a page whose target resolved fine is just a page with a sign-in form, and a
 * missing target or a wrong URL with no gate is exactly that. Nothing here reads
 * a field's value; only whether a password control is on the page. The URL
 * record names the claim, never the address the page is at, which on a real
 * sign-in page carries a return path or a token.
 *
 * This is one of two places a code is decided from the page rather than from
 * the verb, which is why it sits at the single point every result passes
 * through rather than in one producer. The other is `blockedByModal` above,
 * and the two are ordered: a refusal met by a modal is settled before the
 * result is built, and this hook then runs over the record either branch
 * produced. AUTH_REQUIRED winning is deliberate -- a page that has become a
 * sign-in gate needs a person to sign in, which is more specific than "a person
 * must act" -- though the two cannot meet in practice, since a target that
 * resolved well enough to be refused is a target this hook's selector condition
 * (nothing matches it) rules out, and a URL claim is never refused.
 */
function authGateFailure(action: BrowserActionCommand, failure: FailureRecord): FailureRecord | undefined {
  const sought = soughtSelector(action);
  const missing = sought ? selectorMatchesNothing(sought) : false;
  if ((!missing && !namedUrlClaim(action)) || !signInGatePresent()) return undefined;
  const actual = missing ? failure.actual ?? "nothing matched the target" : "the page is not at the URL the Flow claimed";
  return webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.AUTH_REQUIRED, {
    expected: failure.expected ?? (missing ? `an element matching ${sought}` : "the page URL the Flow claimed"),
    actual: `${actual}; the document is a sign-in gate, so the session has probably expired`
  });
}

/** The selector whose matching nothing means "not in this document": a list read's item selector, and every other action's target. */
function soughtSelector(action: BrowserActionCommand): string | undefined {
  return action.actionType === "web.dom.extract_list" ? action.extractList?.item : action.selector;
}

/** A `web.dom.assert` URL claim that names a URL; one that failed says the page is not where the Flow expected it. */
function namedUrlClaim(action: BrowserActionCommand): boolean {
  return action.actionType === "web.dom.assert" && action.assert?.kind === "url" && Boolean(action.assert.expected);
}

/**
 * The two actionability refusals a modal dialog explains. `covered` is the
 * overlay-and-backdrop shape: the hit test landed on the scrim in front of the
 * target. `hidden` is the `inert` shape, which is the one a correct modal
 * actually produces -- both `dialog.showModal()` and the ARIA pattern mark the
 * rest of the document inert, and `actionability.ts` reports an inert target as
 * hidden, because there is no point on screen that belongs to it.
 *
 * `disabled` is not here, and neither is any verb's own word (`upload_rejected`,
 * `unsupported_key`, `not_checkable`): those describe the target, and a dialog
 * standing somewhere else on the page does not make them untrue.
 */
const MODAL_BLOCKED_REFUSALS: ReadonlySet<string> = new Set(["covered", "hidden"]);

/**
 * USER_INTERVENTION_REQUIRED, when the page is not refusing the action so much
 * as waiting for a person: a modal dialog is up, and the target is behind it.
 *
 * This is the page-side condition the code was named for -- Core's category is
 * "a person must act before the run can continue" -- and until now nothing in
 * the browser path produced it at all. It was reported as ACTION_REJECTED,
 * which tells an orchestrator the opposite of the truth: `blocked_by_capability_or_policy`
 * means a gate refused the action and no retry can change that, so a run met by
 * an unrecorded cookie wall or upsell interstitial stopped as if the *step* were
 * wrong. The plan's own corpus says otherwise: W14
 * (`modal-flows/interstitial/armed`) requires `user_intervention_required`, and
 * before this hook no producer could have satisfied it.
 *
 * Both halves are required, because either alone is ordinary -- the same rule
 * `authGateFailure` follows below. A rendered modal on a page whose target is
 * actionable is just a page with a dialog on it, and a covered or inert target
 * with no modal is an overlay, a sticky footer, or a genuinely hidden control:
 * `modal-flows`' cookie banner covers the primary action and is *not* modal, so
 * a refusal there stays ACTION_REJECTED, which is right.
 *
 * "Modal" is taken from the page's own declaration rather than guessed from
 * geometry: `aria-modal="true"`, which is the ARIA contract that the rest of
 * the document is not interactive, or `:modal`, which matches a `<dialog>` that
 * was opened with `showModal()` and nothing else. A dialog that is present but
 * not rendered does not count -- `modal-flows` keeps its invite dialog in the
 * markup behind `hidden` at all times, and treating that as blocking would make
 * every refusal on that fixture an intervention.
 *
 * **What it does not claim.** It does not check that the modal is the thing
 * covering *this* target, because the refusal arrives here as a reason and a
 * sentence, not as an element and a hit point. A target inside the modal that
 * is itself covered by something else would be reported as an intervention. A
 * captcha is not detected either: no fixture ships one, and a vendor-iframe
 * heuristic proved against nothing is a guess with a code attached.
 */
function blockedByModal(reason: string): string | undefined {
  if (!MODAL_BLOCKED_REFUSALS.has(reason) || !renderedModalPresent()) return undefined;
  return "a modal dialog is open over the page, so a person has to answer it before the run can continue";
}

/** A dialog the page declares modal and the browser is actually painting. */
function renderedModalPresent(): boolean {
  return rendered('[aria-modal="true"]') || rendered("dialog:modal");
}

/** Whether anything matching the selector has a box on screen. An unsupported selector is no answer, so it says false. */
function rendered(selector: string): boolean {
  try {
    for (const element of document.querySelectorAll(selector)) {
      if (element.getClientRects().length > 0) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** True when nothing in this document matches the selector. An unparseable selector is no answer at all, so it says false. */
function selectorMatchesNothing(selector: string): boolean {
  try {
    return document.querySelector(selector) === null;
  } catch {
    return false;
  }
}

/** A rendered password control inside a form: the one page signature a sign-in gate always has. */
function signInGatePresent(): boolean {
  const control = document.querySelector('form input[type="password"], form input[autocomplete="current-password"]');
  return control instanceof HTMLElement && control.getClientRects().length > 0;
}

type ResultCore = Pick<BrowserActionResult, "status" | "validation" | "message"> & { failure?: FailureRecord | undefined };

function buildResult(
  action: BrowserActionCommand,
  startedAt: number,
  core: ResultCore,
  evidence: ActionResultEvidence
): BrowserActionResult {
  const result: BrowserActionResult = {
    commandId: action.commandId,
    actionType: action.actionType,
    status: core.status,
    validation: core.validation,
    url: location.href,
    title: document.title,
    startedAt,
    finishedAt: Date.now()
  };
  if (core.message !== undefined) result.message = core.message;
  if (core.failure !== undefined) result.failure = authGateFailure(action, core.failure) ?? core.failure;
  if (evidence.element) result.element = evidence.element;
  if (action.visualTarget) result.visualTarget = action.visualTarget;
  // A failure always carries the page it failed on: the domain builds the
  // sanitized failure-evidence packet from this snapshot, and one captured
  // later would describe a page that has moved on.
  const snapshot = evidence.snapshot ?? (captureSettings.snapshots || core.status !== "succeeded" ? captureSnapshot() : undefined);
  if (snapshot) result.snapshot = snapshot;
  if (evidence.extracted !== undefined) result.extracted = evidence.extracted;
  if (evidence.extraction) result.extraction = evidence.extraction;
  if (evidence.dialog) result.dialog = evidence.dialog;
  if (evidence.resolution) result.resolution = evidence.resolution;
  return result;
}
