// What failed, in Core's taxonomy. One classifier, so the domain hop and the
// browser path cannot drift into two vocabularies.
//
// The rules are ordered by how much the producer knew, strongest evidence
// first. A failure the producer already reported wins outright: it stood
// nearest the page and saw what happened, and re-labelling it would throw that
// away. That holds whether the record arrived in the outcome or rode on the
// thrown value; `carrier.ts` reads the second and says why a record, rather
// than a bespoke error class, is how a producer reports its own code. Only then
// does the classifier infer from the outcome itself -- the status the action
// reported and the post-condition it checked.
//
// Two outcomes name no failure, and the classifier says so by returning
// nothing: an action that succeeded with its post-condition intact, and a
// cancelled command, whose meaning Core's `failureForCommandStatus` derives
// from the command status alone. Everything else lands on a code, so a failure
// can never reach the wire structureless.

import type { WebAutomationActionStatus, WebAutomationActionType, WebAutomationActionValidation } from "../../actions/types";
import { carriedWebAutomationFailure } from "./carrier";
import {
  WEB_AUTOMATION_FAILURE_CODES,
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
   * unchanged, and it can be, because the field's type holds `code` to the
   * closed set: a caller in this build cannot put an unnamed code here without
   * failing to compile. A record that crossed a boundary the compiler does not
   * span -- read off a thrown value, or arrived over the WebSocket -- has no
   * such guarantee and must not be assigned here untested;
   * `carriedWebAutomationFailure` and `adapter.ts`'s `clientReportedFailure`
   * are the two readers that re-establish one on the set.
   */
  failure?: WebAutomationFailureRecord | undefined;
  /** What the action said about itself, used only when nothing structured is available. */
  message?: string | undefined;
};

/**
 * The failure record for an action that did not do what was asked, or nothing
 * when the outcome names no failure.
 *
 * `error` is whatever was thrown, if anything: a value carrying a failure
 * record is the producer's own classification and is honoured, re-established
 * on the closed set by `carriedWebAutomationFailure`; any other thrown value is
 * an action that ran and failed for a reason no code names.
 *
 * A producer that already knows its code does not come through here -- it calls
 * `webAutomationFailureRecord` directly, and attaches the result to what it
 * throws if it is throwing. This is the path for a caller holding an outcome
 * and an error and no opinion about either.
 */
export function classifyWebAutomationFailure(error: unknown, outcome: WebAutomationActionOutcome): WebAutomationFailureRecord | undefined {
  if (outcome.failure !== undefined) return outcome.failure;
  const carried = carriedWebAutomationFailure(error, withActual(comparedText(outcome.validation), errorMessage(error)));
  if (carried !== undefined) return carried;
  const classified = classifyOutcome(error, outcome);
  return classified === undefined ? undefined : webAutomationFailureRecord(classified.code, classified.comparison);
}

type ClassifiedFailure = { code: WebAutomationFailureCode; comparison: WebAutomationFailureComparison };

function classifyOutcome(error: unknown, outcome: WebAutomationActionOutcome): ClassifiedFailure | undefined {
  const compared = comparedText(outcome.validation);
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

function errorMessage(error: unknown): string | undefined {
  if (error instanceof Error) return error.message.length > 0 ? error.message : undefined;
  if (typeof error === "string") return error.length > 0 ? error : undefined;
  if (typeof error !== "object" || error === null) return undefined;
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" && message.length > 0 ? message : undefined;
}
