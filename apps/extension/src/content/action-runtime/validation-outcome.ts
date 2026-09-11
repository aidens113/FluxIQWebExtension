// What a validation implies for a result: the status it produces, and the
// structured failure that goes with it.
//
// These are the rules that decide whether an action actually succeeded, so they
// are kept free of the DOM and of page globals: `results.ts` assembles them
// with the page's URL, title, and snapshot, while the rules themselves are
// plain functions that a Node test can exercise directly. Every record built
// here has to survive Core's parser, which drops a record whole rather than
// repairing it -- hence the bounded, never-empty text and the retryable flags
// that match Core's own consistency rules.

import type { BrowserActionResult, BrowserActionStatus, BrowserActionValidation } from "../types";

/** Core's structured failure record, reached through the result type so no Core module enters the content bundle. */
type FailureRecord = NonNullable<BrowserActionResult["failure"]>;

/**
 * The bound on a validation's `expected` and `actual`, mirroring the domain's
 * `WEB_AUTOMATION_VALIDATION_TEXT_MAX_LENGTH`, which is Core's own record
 * limit. Page text is unbounded, so without this a failed validation could
 * produce a record Core discards, losing the failure instead of reporting it.
 */
export const VALIDATION_TEXT_MAX_LENGTH = 1_024;

/** Bounds a validation text and never yields the empty string, which Core's parser also rejects. */
export function truncateValidationText(value: string): string {
  const collapsed = value.replace(/\s+/gu, " ").trim();
  if (!collapsed) return "(none)";
  return collapsed.length <= VALIDATION_TEXT_MAX_LENGTH ? collapsed : `${collapsed.slice(0, VALIDATION_TEXT_MAX_LENGTH - 1)}…`;
}

/** The validation as it may be reported: its text bounded to what Core accepts. */
export function boundValidation(validation: BrowserActionValidation): BrowserActionValidation {
  if (validation.status === "none") return validation;
  return {
    status: validation.status,
    expected: truncateValidationText(validation.expected),
    actual: truncateValidationText(validation.actual)
  };
}

/** An action whose post-condition did not hold did not succeed, whatever else went right. */
export function statusForValidation(validation: BrowserActionValidation): BrowserActionStatus {
  return validation.status === "failed" ? "failed" : "succeeded";
}

/** The failure for an action that ran but whose intended effect was never observed. */
export function outputNotObservedFailure(validation: BrowserActionValidation): FailureRecord | undefined {
  if (validation.status !== "failed") return undefined;
  return {
    category: "output_not_observed",
    code: "web.validation.output_not_observed",
    retryable: true,
    stage: "verification",
    expected: validation.expected,
    actual: validation.actual
  };
}

/**
 * The failure for a target that was disabled, hidden, or covered. The plan
 * calls this ACTION_REJECTED; Core's category is
 * `blocked_by_capability_or_policy`, which its parser forbids from ever being
 * retryable.
 */
export function rejectionFailure(code: string, validation: BrowserActionValidation): FailureRecord {
  return {
    category: "blocked_by_capability_or_policy",
    code: `web.action.${code}`,
    retryable: false,
    stage: "execution",
    ...comparedText(validation)
  };
}

/** The failure for a wait or an action that ran out of time. */
export function timeoutFailure(validation: BrowserActionValidation): FailureRecord {
  return {
    category: "timeout",
    code: "web.action.timeout",
    retryable: true,
    stage: "execution",
    ...comparedText(validation)
  };
}

/** The failure for a verb that is registered but not built yet, so a Flow that reaches one fails honestly. */
export function notImplementedFailure(): FailureRecord {
  return {
    category: "blocked_by_capability_or_policy",
    code: "web.action.not_implemented",
    retryable: false,
    stage: "dispatch"
  };
}

function comparedText(validation: BrowserActionValidation): { expected?: string; actual?: string } {
  return validation.status === "none" ? {} : { expected: validation.expected, actual: validation.actual };
}
