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

/** What an action observed while it ran, all optional and all independent of whether it passed. */
export type ActionResultEvidence = {
  element?: DomElementDescriptor | undefined;
  snapshot?: DomSnapshot | undefined;
  extracted?: JsonValue | undefined;
  resolution?: BrowserActionTargetResolution | undefined;
};

/**
 * An action that threw. The thrown value is the only evidence, so it is read
 * for everything it carries.
 *
 * A thrower that already classified itself wins: `resolve-target.ts` raises a
 * `TargetResolutionError` carrying a TARGET_NOT_FOUND or TARGET_AMBIGUOUS
 * record and the resolution that produced it, and both ride onto the result
 * rather than being flattened into a sentence -- which is what happened before
 * this seam existed, and why a Flow could not tell an ambiguous target from a
 * missing one. The record is read structurally rather than by class, because
 * the code is what has to be trusted and the class may be a bundled copy; a
 * code outside the closed set is not trusted at all. Failing that, the domain's
 * classifier honours a `WebAutomationRuntimeError`, and anything else is an
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
 * could: the element the action named is not in this document, and what is here
 * is a sign-in gate. An expired session is the common cause, and it is the one
 * failure a retry can never clear -- Core's `auth_required` asks a person to
 * sign in instead of retrying, so reporting it as a missing target or a bare
 * thrown error leaves the orchestrator retrying a wall.
 *
 * Both halves are required, because either alone is ordinary: a sign-in form on
 * a page whose target resolved fine is just a page with a sign-in form, and a
 * missing target with no gate is a missing target. An action that named no
 * selector cannot be judged this way at all, so it is left as it was. Nothing
 * here reads a field's value; only whether a password control is on the page.
 *
 * This is the one place a code is decided from the page rather than from the
 * verb, which is why it sits at the single point every result passes through
 * rather than in one producer.
 */
function authGateFailure(action: BrowserActionCommand, failure: FailureRecord): FailureRecord | undefined {
  if (!action.selector || !selectorMatchesNothing(action.selector) || !signInGatePresent()) return undefined;
  return webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.AUTH_REQUIRED, {
    expected: failure.expected ?? `an element matching ${action.selector}`,
    actual: `${failure.actual ?? "nothing matched the target"}; the document is a sign-in gate, so the session has probably expired`
  });
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
  if (evidence.resolution) result.resolution = evidence.resolution;
  return result;
}
