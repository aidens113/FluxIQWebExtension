// The closed set of web-automation failure codes.
//
// Core owns the category names (`AutomationStudioAdaptiveFailureClass`) and the
// record shape; a producer owns the `code`. This module is the one place a
// web-automation code is named, and each code is bound here to the category,
// retryable flag and stage it always carries. That binding is the point: Core's
// parser drops a record whole rather than repairing it, so a record assembled
// by hand can contradict a consistency rule and vanish, losing the failure
// instead of reporting it. A record built from a code here cannot.
//
// The set is closed. The resolver, the content script's action results, the
// domain adapter and the test runner's allowlist all derive from it, so a code
// that is not named here has no way onto the wire from the browser path. Adding
// one is a deliberate edit to this file, not a string written at a call site.

import type { AutomationStudioAdaptiveFailureClass, AutomationStudioFailureRecord, AutomationStudioFailureStage } from "fluxiq/automation-studio";
import { WEB_AUTOMATION_VALIDATION_TEXT_MAX_LENGTH } from "../../actions/types";

/**
 * Every failure the browser path may report, keyed by the plan's vocabulary
 * name and valued by the code that travels on the wire. Read a code from here
 * rather than repeating its string: the key is what the plan, the scenario
 * manifests and the briefs call it, and the value is what Core stores.
 */
export const WEB_AUTOMATION_FAILURE_CODES = Object.freeze({
  /** The target was found but refused the action: disabled, hidden, or covered by another element. */
  ACTION_REJECTED: "web.action.rejected",
  /** No element matched the action's target with enough confidence. */
  TARGET_NOT_FOUND: "web.target.not_found",
  /** Several elements matched the action's target and none could be preferred. */
  TARGET_AMBIGUOUS: "web.target.ambiguous",
  /** The action ran and its post-condition did not hold (decision D4). */
  OUTPUT_NOT_OBSERVED: "web.validation.output_not_observed",
  /** An authored `web.dom.assert` condition did not hold. */
  STATE_MISMATCH: "web.validation.state_mismatch",
  /** The browser landed somewhere other than the requested URL, or never left where it was. */
  NAVIGATION_UNEXPECTED: "web.navigation.unexpected",
  /** The document was replaced between resolving the target and running the action. */
  PAGE_CHANGED: "web.page.changed",
  /** A wait, or an action, ran out of time. */
  TIMEOUT: "web.action.timeout",
  /** The host wants a sign-in before the action can continue. */
  AUTH_REQUIRED: "web.auth.required",
  /** A person must act first: a captcha, or a native dialog waiting for an answer. */
  USER_INTERVENTION_REQUIRED: "web.intervention.required",
  /** The client does not implement the requested action type at all. */
  UNSUPPORTED_TYPE: "web.action.unsupported_type",
  /** The verb is registered but not built yet, so a Flow that reaches one fails honestly. */
  NOT_IMPLEMENTED: "web.action.not_implemented",
  /** The action ran and failed for a reason no other code names. */
  ACTION_FAILED: "web.action.failed",
  /** Nothing said why the action failed. */
  UNKNOWN: "web.action.unknown"
} as const);

/** One of the closed set's codes, as it appears in a failure record. */
export type WebAutomationFailureCode = (typeof WEB_AUTOMATION_FAILURE_CODES)[keyof typeof WEB_AUTOMATION_FAILURE_CODES];

/** What a code always means: its Core category, whether retrying it unchanged can work, and where it was decided. */
export type WebAutomationFailureCodeDefinition = {
  readonly category: AutomationStudioAdaptiveFailureClass;
  readonly retryable: boolean;
  readonly stage: AutomationStudioFailureStage;
};

/**
 * The code table. Each row is fixed, which is what lets a producer name a code
 * and nothing else.
 *
 * The stage vocabulary, applied consistently: `target_resolution` while
 * deciding which element to act on; `dispatch` before anything ran, for a verb
 * the client will not run at all; `execution` while the action ran;
 * `confirmation` while confirming the action itself landed; `verification`
 * while checking a post-condition or an authored assertion.
 *
 * `retryable` answers only Core's question -- whether retrying the same action
 * unchanged can succeed without a person or a Flow edit. Core forbids six
 * categories from ever being retryable, so those rows have no choice; the rest
 * are judged: a target that could not be found may appear once the page
 * settles, whereas an ambiguous one stays ambiguous until the Flow says which
 * it meant.
 */
export const WEB_AUTOMATION_FAILURE_CODE_DEFINITIONS: Readonly<Record<WebAutomationFailureCode, WebAutomationFailureCodeDefinition>> = Object.freeze({
  "web.action.rejected": { category: "blocked_by_capability_or_policy", retryable: false, stage: "execution" },
  "web.target.not_found": { category: "target_not_found", retryable: true, stage: "target_resolution" },
  "web.target.ambiguous": { category: "target_ambiguous", retryable: false, stage: "target_resolution" },
  "web.validation.output_not_observed": { category: "output_not_observed", retryable: true, stage: "verification" },
  "web.validation.state_mismatch": { category: "unexpected_state", retryable: false, stage: "verification" },
  "web.navigation.unexpected": { category: "navigation_unexpected", retryable: false, stage: "confirmation" },
  "web.page.changed": { category: "page_changed", retryable: true, stage: "execution" },
  "web.action.timeout": { category: "timeout", retryable: true, stage: "execution" },
  "web.auth.required": { category: "auth_required", retryable: false, stage: "confirmation" },
  "web.intervention.required": { category: "user_intervention_required", retryable: false, stage: "execution" },
  "web.action.unsupported_type": { category: "blocked_by_capability_or_policy", retryable: false, stage: "dispatch" },
  "web.action.not_implemented": { category: "blocked_by_capability_or_policy", retryable: false, stage: "dispatch" },
  "web.action.failed": { category: "action_failed", retryable: true, stage: "execution" },
  "web.action.unknown": { category: "ambiguous_or_unknown", retryable: false, stage: "execution" }
});

/** The short descriptions a record may carry, and the digest of the evidence packet captured with it. */
export type WebAutomationFailureComparison = {
  /** What was expected, in words. Never raw page content, credentials, or recorded data. */
  expected?: string | undefined;
  /** What was observed instead, under the same rule as `expected`. */
  actual?: string | undefined;
  /** Lowercase SHA-256 hex digest of the failure-evidence packet. */
  evidenceDigest?: string | undefined;
};

/** True when a string is one of the closed set's codes. */
export function isWebAutomationFailureCode(value: unknown): value is WebAutomationFailureCode {
  return typeof value === "string" && Object.hasOwn(WEB_AUTOMATION_FAILURE_CODE_DEFINITIONS, value);
}

/**
 * The Core failure record for a code. The category, retryable flag and stage
 * come from the table, so the caller decides only which failure happened and
 * what it can say about it.
 *
 * Text is collapsed to one line and bounded to Core's own record limit, and a
 * description that collapses to nothing is dropped rather than passed on: the
 * parser rejects an empty string, and an unbounded one would take the whole
 * record with it. A digest that is not a lowercase SHA-256 hex string is
 * dropped for the same reason -- losing one optional field beats losing the
 * failure.
 */
export function webAutomationFailureRecord(code: WebAutomationFailureCode, comparison: WebAutomationFailureComparison = {}): AutomationStudioFailureRecord {
  const definition = WEB_AUTOMATION_FAILURE_CODE_DEFINITIONS[code];
  const expected = boundedText(comparison.expected);
  const actual = boundedText(comparison.actual);
  const evidenceDigest = comparison.evidenceDigest !== undefined && EVIDENCE_DIGEST_PATTERN.test(comparison.evidenceDigest) ? comparison.evidenceDigest : undefined;
  return {
    category: definition.category,
    code,
    retryable: definition.retryable,
    stage: definition.stage,
    ...(expected === undefined ? {} : { expected }),
    ...(actual === undefined ? {} : { actual }),
    ...(evidenceDigest === undefined ? {} : { evidenceDigest })
  };
}

const EVIDENCE_DIGEST_PATTERN = /^[a-f0-9]{64}$/u;

function boundedText(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const collapsed = value.replace(/\s+/gu, " ").trim();
  if (collapsed.length === 0) return undefined;
  if (collapsed.length <= WEB_AUTOMATION_VALIDATION_TEXT_MAX_LENGTH) return collapsed;
  return `${collapsed.slice(0, WEB_AUTOMATION_VALIDATION_TEXT_MAX_LENGTH - 1)}…`;
}
