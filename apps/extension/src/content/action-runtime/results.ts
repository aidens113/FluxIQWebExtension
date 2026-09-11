// The result the background worker receives for an action: what happened, and
// the post-condition that proves it happened.
//
// Every result carries a validation (decision D4), so an action cannot report
// success without saying what it checked. `success()` takes one as an argument
// rather than defaulting it: a verb that has no post-condition yet has to say
// so in the call, which is what makes the gap visible instead of silent. A
// failed validation is not a successful action -- it becomes a `failed` result
// carrying Core's `output_not_observed` category.
//
// What a validation implies is decided in `validation-outcome.ts`; this module
// assembles it with what the page can tell us.

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
import {
  boundValidation,
  notImplementedFailure,
  outputNotObservedFailure,
  rejectionFailure,
  statusForValidation,
  timeoutFailure
} from "./validation-outcome";

type FailureRecord = NonNullable<BrowserActionResult["failure"]>;

/** What an action observed while it ran, all optional and all independent of whether it passed. */
export type ActionResultEvidence = {
  element?: DomElementDescriptor | undefined;
  snapshot?: DomSnapshot | undefined;
  extracted?: JsonValue | undefined;
  resolution?: BrowserActionTargetResolution | undefined;
};

export function actionFailure(action: BrowserActionCommand, error: unknown, startedAt = Date.now()): BrowserActionResult {
  const snapshot = captureSettings.snapshots ? captureSnapshot() : undefined;
  return {
    commandId: action.commandId,
    actionType: action.actionType,
    status: "failed",
    validation: { status: "none", reason: "not-yet-validated" },
    message: error instanceof Error ? error.message : "Action failed.",
    url: location.href,
    title: document.title,
    ...(snapshot ? { snapshot } : {}),
    startedAt,
    finishedAt: Date.now()
  };
}

/**
 * The result of an action that ran. `validation` decides the status: a passed
 * or skipped validation succeeds, a failed one reports `failed` with
 * `output_not_observed` and the two values that disagreed.
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
    failure: outputNotObservedFailure(bounded)
  }, evidence);
}

/** An action refused before it ran: the target was disabled, hidden, or covered. */
export function actionRejected(
  action: BrowserActionCommand,
  startedAt: number,
  code: string,
  expected: string,
  actual: string,
  evidence: ActionResultEvidence = {}
): BrowserActionResult {
  const validation = boundValidation({ status: "failed", expected, actual });
  return buildResult(action, startedAt, {
    status: "failed",
    validation,
    message: `Action rejected: ${validation.status === "failed" ? validation.actual : actual}`,
    failure: rejectionFailure(code, validation)
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
    failure: timeoutFailure(bounded)
  }, evidence);
}

/** A verb that is registered but not built yet. */
export function actionNotImplemented(action: BrowserActionCommand, startedAt: number, what: string): BrowserActionResult {
  return buildResult(action, startedAt, {
    status: "failed",
    validation: { status: "none", reason: "not-yet-validated" },
    message: `${what} is not implemented yet.`,
    failure: notImplementedFailure()
  }, {});
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
  if (core.failure !== undefined) result.failure = core.failure;
  if (evidence.element) result.element = evidence.element;
  if (action.visualTarget) result.visualTarget = action.visualTarget;
  if (evidence.snapshot ?? captureSettings.snapshots) result.snapshot = evidence.snapshot ?? captureSnapshot();
  if (evidence.extracted !== undefined) result.extracted = evidence.extracted;
  if (evidence.resolution) result.resolution = evidence.resolution;
  return result;
}
