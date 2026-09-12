// The one way a producer that already knows what failed says so: it attaches
// the record to what it throws.
//
// This is a convention rather than a class on purpose, and the choice was made
// by attrition. `WebAutomationRuntimeError` -- an Error subclass carrying a
// bare `code` -- existed from Wave 1 for exactly this job, was honoured by the
// classifier, and in the whole of Phase 1.5 not one producer used it: the
// resolver, the verb dispatcher, the action runner, the tab and download
// runtimes and the expectation evaluator all attached a record instead. The
// class was removed on 2026-09-12 rather than given a producer, because the
// record is strictly the better carrier:
//
//   - it says what was expected and what was seen, which a code alone cannot,
//     and those two strings are what a Flow and a diagnosing model read first;
//   - it was built by `webAutomationFailureRecord`, so its category, retryable
//     flag and stage are the code's own and cannot contradict Core's parser;
//   - it needs no shared class identity, so a content script bundling its own
//     copy of the domain still reports the same failure -- the reason the old
//     classifier needed a structural `name === ...` lookalike branch at all;
//   - the code is compiler-checked at the throw, because `WebAutomationFailure
//     Record["code"]` is the closed set, whereas the class typed `code` as a
//     bare `string` and left the set to be re-checked at runtime, or not.
//
// A producer therefore raises an error of whatever type says most about the
// failure -- `TargetResolutionError` also carries the resolution diagnostics --
// and declares `WebAutomationFailureCarrier` to say the record is there.

import {
  WEB_AUTOMATION_FAILURE_CODES,
  isWebAutomationFailureCode,
  webAutomationFailureRecord,
  type WebAutomationFailureComparison,
  type WebAutomationFailureRecord
} from "./codes";

/**
 * What a thrown value must have for its own classification to be honoured: a
 * record from the closed set, built by `webAutomationFailureRecord`.
 *
 * Declare it on the error class -- `class TargetResolutionError extends Error
 * implements WebAutomationFailureCarrier` -- so the compiler holds the field to
 * the closed set at the throw. Nothing reads the value *through* this type: a
 * thrown value arrives as `unknown`, possibly from another bundle of this
 * package, so `carriedWebAutomationFailure` checks the shape it actually finds.
 */
export type WebAutomationFailureCarrier = {
  readonly failure: WebAutomationFailureRecord;
};

/**
 * The record a thrower attached, re-established on the closed set, or nothing
 * when it attached none.
 *
 * The record is rebuilt from its own code rather than returned as found. It
 * came off an `unknown` -- the compiler vouched for nothing, and the thrower may
 * be a build behind -- so the code is the only part worth trusting, and the
 * category, retryable flag and stage are taken from the code's row here. For a
 * record this build produced that is a no-op; for one that pairs a code with a
 * category its row forbids it is the difference between a reported failure and
 * a record Core's parser drops whole.
 *
 * A code outside the set is drift, not a classification, so it becomes UNKNOWN
 * carrying the code it used -- the same answer `clientReportedFailure` in
 * `adapter.ts` gives the same drift arriving over the WebSocket. Reporting the
 * unnamed code beside what the producer saw is what makes the gap visible;
 * degrading quietly to "the action failed" is how out-of-set codes survived a
 * whole wave unnoticed.
 *
 * `fallback` fills only the descriptions the carried record left empty, so a
 * caller holding a failed validation or the thrown message can supply them
 * without overwriting anything the producer chose to say.
 */
export function carriedWebAutomationFailure(error: unknown, fallback: WebAutomationFailureComparison = {}): WebAutomationFailureRecord | undefined {
  const carried = property(error, "failure");
  const code = property(carried, "code");
  // No claim to a classification at all: the caller should infer one from the
  // outcome rather than be told this value said something it did not.
  if (typeof code !== "string") return undefined;
  const comparison: WebAutomationFailureComparison = {
    expected: text(property(carried, "expected")) ?? fallback.expected,
    actual: text(property(carried, "actual")) ?? fallback.actual,
    evidenceDigest: text(property(carried, "evidenceDigest")) ?? fallback.evidenceDigest
  };
  if (isWebAutomationFailureCode(code)) return webAutomationFailureRecord(code, comparison);
  const unnamed = `unrecognized web automation failure code: ${code}`;
  return webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.UNKNOWN, {
    ...comparison,
    actual: comparison.actual === undefined ? unnamed : `${comparison.actual}; ${unnamed}`
  });
}

function property(value: unknown, name: string): unknown {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>)[name] : undefined;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
