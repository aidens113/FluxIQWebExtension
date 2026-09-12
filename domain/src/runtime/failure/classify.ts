// What failed, in Core's taxonomy. One classifier, so the domain hop and the
// browser path cannot drift into two vocabularies.
//
// The rules are ordered by how much the producer knew, strongest evidence
// first. A failure the producer already reported wins outright: it stood
// nearest the page and saw what happened, and re-labelling it would throw that
// away. Next a `WebAutomationRuntimeError`, whose `code` is the producer's own
// classification whenever it names one of the closed set. Only then does the
// classifier infer from the outcome itself -- the status the action reported
// and the post-condition it checked.
//
// Two outcomes name no failure, and the classifier says so by returning
// nothing: an action that succeeded with its post-condition intact, and a
// cancelled command, whose meaning Core's `failureForCommandStatus` derives
// from the command status alone. Everything else lands on a code, so a failure
// can never reach the wire structureless.

import type { WebAutomationActionStatus, WebAutomationActionType, WebAutomationActionValidation } from "../../actions/types";
import { WebAutomationRuntimeError } from "../errors";
import {
  WEB_AUTOMATION_FAILURE_CODES,
  isWebAutomationFailureCode,
  webAutomationFailureRecord,
  type WebAutomationFailureCode,
  type WebAutomationFailureComparison,
  type WebAutomationFailureRecord
} from "./codes";

/**
 * What is known about an action that has finished, or failed to finish. Every
 * field but `status` is optional because the domain hop may hold nothing else:
 * a command that went unanswered has a status and no result at all.
 *
 * `message` must already be a description safe to store -- never raw page
 * content, credentials, or recorded data -- because a message is the last
 * resort for saying what happened and travels into the record as `actual`.
 */
export type WebAutomationActionOutcome = {
  /** The status the action reported; `unknown` when nothing answered. */
  status: WebAutomationActionStatus;
  /** Which verb ran. It separates an authored assertion's failure from a post-condition's. */
  actionType?: WebAutomationActionType | undefined;
  /** The post-condition the action checked, when it checked one. */
  validation?: WebAutomationActionValidation | undefined;
  /**
   * A failure the producer already classified. A present one is reported
   * unchanged, so it must already carry one of the closed set's codes: the
   * classifier hands it straight back and would otherwise be the hole through
   * which an unnamed code reached the wire. A record arriving from outside this
   * build -- one read off a thrown value, say -- is not trusted until
   * `isWebAutomationFailureCode` has been run on its code.
   */
  failure?: WebAutomationFailureRecord | undefined;
  /** What the action said about itself, used only when nothing structured is available. */
  message?: string | undefined;
};

/**
 * The failure record for an action that did not do what was asked, or nothing
 * when the outcome names no failure.
 *
 * `error` is whatever was thrown, if anything: a `WebAutomationRuntimeError`
 * carrying one of the closed set's codes is the producer's classification and
 * is honoured as-is; a runtime error carrying any other code is treated as a
 * producer that could not name the cause; any other thrown value is an action
 * that ran and failed for a reason no code names.
 *
 * A producer that already knows its code does not come through here -- it calls
 * `webAutomationFailureRecord` directly. This is the path for a caller holding
 * an outcome and an error and no opinion about either.
 */
export function classifyWebAutomationFailure(error: unknown, outcome: WebAutomationActionOutcome): WebAutomationFailureRecord | undefined {
  if (outcome.failure !== undefined) return outcome.failure;
  const classified = classifyOutcome(error, outcome);
  return classified === undefined ? undefined : webAutomationFailureRecord(classified.code, classified.comparison);
}

type ClassifiedFailure = { code: WebAutomationFailureCode; comparison: WebAutomationFailureComparison };

function classifyOutcome(error: unknown, outcome: WebAutomationActionOutcome): ClassifiedFailure | undefined {
  const compared = comparedText(outcome.validation);
  const reportedCode = runtimeErrorCode(error);
  if (reportedCode !== undefined) {
    if (isWebAutomationFailureCode(reportedCode)) return { code: reportedCode, comparison: withActual(compared, errorMessage(error)) };
    // A producer that reached for a code outside the closed set did not name
    // the cause, whatever it believed. The code it used travels in `actual` so
    // the gap is visible rather than silently relabelled.
    return { code: WEB_AUTOMATION_FAILURE_CODES.UNKNOWN, comparison: { ...compared, actual: `unrecognized web automation failure code: ${reportedCode}` } };
  }
  // A wait that ran out of time also leaves a failed validation behind, and
  // `timeout` is the better name for it, so the status is read first.
  if (outcome.status === "timed_out") return { code: WEB_AUTOMATION_FAILURE_CODES.TIMEOUT, comparison: withActual(compared, errorMessage(error)) };
  if (outcome.validation?.status === "failed") {
    const code = outcome.actionType === "web.dom.assert" ? WEB_AUTOMATION_FAILURE_CODES.STATE_MISMATCH : WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED;
    return { code, comparison: compared };
  }
  if (error !== undefined && error !== null) {
    return { code: WEB_AUTOMATION_FAILURE_CODES.ACTION_FAILED, comparison: withActual(compared, errorMessage(error) ?? "the action threw a value that carried no message") };
  }
  if (outcome.status === "failed" || outcome.status === "unknown") {
    const message = outcome.message;
    if (message === undefined || message.trim().length === 0) return { code: WEB_AUTOMATION_FAILURE_CODES.UNKNOWN, comparison: compared };
    return { code: WEB_AUTOMATION_FAILURE_CODES.ACTION_FAILED, comparison: withActual(compared, message) };
  }
  return undefined;
}

/** A validation's two descriptions, when it has them. A skipped validation compared nothing. */
function comparedText(validation: WebAutomationActionValidation | undefined): WebAutomationFailureComparison {
  if (validation === undefined || validation.status === "none") return {};
  return { expected: validation.expected, actual: validation.actual };
}

/** The validation's observation wins; a message fills in only where there is none. */
function withActual(compared: WebAutomationFailureComparison, actual: string | undefined): WebAutomationFailureComparison {
  return compared.actual !== undefined ? compared : { ...compared, actual };
}

/**
 * The code a `WebAutomationRuntimeError` carries.
 *
 * The structural check is not defensiveness for its own sake: the error may
 * have been raised against a different copy of the class -- a bundled content
 * script, or a second module instance -- where `instanceof` is false although
 * the value is exactly what it claims to be.
 */
function runtimeErrorCode(error: unknown): string | undefined {
  if (error instanceof WebAutomationRuntimeError) return error.code;
  if (typeof error !== "object" || error === null) return undefined;
  const candidate = error as { name?: unknown; code?: unknown };
  if (candidate.name !== "WebAutomationRuntimeError") return undefined;
  return typeof candidate.code === "string" ? candidate.code : undefined;
}

function errorMessage(error: unknown): string | undefined {
  if (error instanceof Error) return error.message.length > 0 ? error.message : undefined;
  if (typeof error === "string") return error.length > 0 ? error : undefined;
  if (typeof error !== "object" || error === null) return undefined;
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" && message.length > 0 ? message : undefined;
}
