// What a validation implies for a result: the status it produces, and the
// bound its text has to respect.
//
// These are the rules that decide whether an action actually succeeded, so they
// are kept free of the DOM and of page globals: `results.ts` assembles them
// with the page's URL, title, and snapshot, while the rules themselves are
// plain functions that a Node test can exercise directly.
//
// This module builds no failure records. It used to carry four builders --
// `outputNotObservedFailure`, `rejectionFailure`, `timeoutFailure` and
// `notImplementedFailure` -- each writing a Core category, a retryable flag and
// a stage by hand beside a `code` string, and `rejectionFailure` composing that
// string from a caller-supplied suffix. Every one of them lost its last
// production caller when `results.ts` moved to the domain's closed code set
// (Phase 1.5 step 3), and `rejectionFailure` was by then the only way left in
// the content bundle to mint a code the set does not name. They are gone rather
// than converted: `webAutomationFailureRecord` already binds each code to its
// category, retryable flag and stage, so a second builder could only restate
// that binding or contradict it, and a contradiction is dropped whole by Core's
// parser -- losing the failure instead of reporting it.
//
// Deletion, not the type system, is what keeps them gone, and that is worth
// knowing before anyone reinstates one as a convenience. `webAutomationFailureRecord`
// narrows its `code` *parameter*, but the record type a builder returns --
// Core's `AutomationStudioFailureRecord`, reached here through
// `BrowserActionResult["failure"]` -- types `code` as a bare `string`, because
// Core owns the categories and every producer owns its own codes. So a record
// written out as a literal still compiles with any string at all; only the
// builders' absence stops one being written. `tests/validation-outcome.test.ts`
// pins the exported surface for exactly that reason.
//
// The text bound stays here because `results.ts` bounds a *validation*, which
// an operator reads, and the domain bounds only the *record*.

import type { BrowserActionStatus, BrowserActionValidation } from "../types";

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

