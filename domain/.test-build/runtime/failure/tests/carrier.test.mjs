// src/runtime/failure/tests/carrier.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { parseAutomationStudioFailureRecord } from "fluxiq/automation-studio";

// src/actions/types.ts
var WEB_AUTOMATION_VALIDATION_TEXT_MAX_LENGTH = 1024;

// src/runtime/failure/codes.ts
var WEB_AUTOMATION_FAILURE_CODES = Object.freeze({
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
});
var WEB_AUTOMATION_FAILURE_CODE_DEFINITIONS = Object.freeze({
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
function isWebAutomationFailureCode(value) {
  return typeof value === "string" && Object.hasOwn(WEB_AUTOMATION_FAILURE_CODE_DEFINITIONS, value);
}
function webAutomationFailureRecord(code, comparison = {}) {
  const definition = WEB_AUTOMATION_FAILURE_CODE_DEFINITIONS[code];
  const expected = boundedText(comparison.expected);
  const actual = boundedText(comparison.actual);
  const evidenceDigest = comparison.evidenceDigest !== void 0 && EVIDENCE_DIGEST_PATTERN.test(comparison.evidenceDigest) ? comparison.evidenceDigest : void 0;
  return {
    category: definition.category,
    code,
    retryable: definition.retryable,
    stage: definition.stage,
    ...expected === void 0 ? {} : { expected },
    ...actual === void 0 ? {} : { actual },
    ...evidenceDigest === void 0 ? {} : { evidenceDigest }
  };
}
var EVIDENCE_DIGEST_PATTERN = /^[a-f0-9]{64}$/u;
function boundedText(value) {
  if (value === void 0) return void 0;
  const collapsed = value.replace(/\s+/gu, " ").trim();
  if (collapsed.length === 0) return void 0;
  if (collapsed.length <= WEB_AUTOMATION_VALIDATION_TEXT_MAX_LENGTH) return collapsed;
  return `${collapsed.slice(0, WEB_AUTOMATION_VALIDATION_TEXT_MAX_LENGTH - 1)}\u2026`;
}

// src/runtime/failure/carrier.ts
function carriedWebAutomationFailure(error, fallback = {}) {
  const carried2 = property(error, "failure");
  const code = property(carried2, "code");
  if (typeof code !== "string") return void 0;
  const comparison = {
    expected: text(property(carried2, "expected")) ?? fallback.expected,
    actual: text(property(carried2, "actual")) ?? fallback.actual,
    evidenceDigest: text(property(carried2, "evidenceDigest")) ?? fallback.evidenceDigest
  };
  if (isWebAutomationFailureCode(code)) return webAutomationFailureRecord(code, comparison);
  const unnamed = `unrecognized web automation failure code: ${code}`;
  return webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.UNKNOWN, {
    ...comparison,
    actual: comparison.actual === void 0 ? unnamed : `${comparison.actual}; ${unnamed}`
  });
}
function property(value, name) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value[name] : void 0;
}
function text(value) {
  return typeof value === "string" && value.length > 0 ? value : void 0;
}

// src/runtime/failure/tests/carrier.test.ts
function carried(error, fallback) {
  const record = carriedWebAutomationFailure(error, fallback);
  if (record !== void 0) assert.deepEqual(parseAutomationStudioFailureRecord(record), record, `Core's parser accepts ${record.code}`);
  return record;
}
test("the carrier type holds a producer's code to the closed set at the throw", () => {
  class TargetResolutionError extends Error {
    failure = webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.TARGET_AMBIGUOUS, {
      expected: "one Save control",
      actual: "three controls scored within the margin"
    });
  }
  const record = carried(new TargetResolutionError("several controls matched"));
  assert.equal(record?.code, WEB_AUTOMATION_FAILURE_CODES.TARGET_AMBIGUOUS);
  assert.equal(record?.category, "target_ambiguous");
  assert.equal(record?.expected, "one Save control");
  assert.equal(record?.actual, "three controls scored within the margin");
});
test("a record thrown from another bundle of this package is read by shape, not by class", () => {
  const fromAnotherBundle = { name: "SomeErrorThisBuildHasNeverHeardOf", message: "the document was replaced", failure: { category: "page_changed", code: "web.page.changed", retryable: true, stage: "execution" } };
  const record = carried(fromAnotherBundle);
  assert.equal(record?.code, WEB_AUTOMATION_FAILURE_CODES.PAGE_CHANGED);
});
test("a carried record is rebuilt from its own code, so a contradicting row cannot reach Core", () => {
  const contradicting = { failure: { category: "action_failed", code: "web.target.not_found", retryable: false, stage: "execution", actual: "nothing matched #pay" } };
  const record = carried(contradicting);
  assert.equal(record?.code, WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_FOUND);
  assert.equal(record?.category, "target_not_found", "the code decides the category, not the thrower");
  assert.equal(record?.retryable, true);
  assert.equal(record?.stage, "target_resolution");
  assert.equal(record?.actual, "nothing matched #pay", "what only the producer saw rides across untouched");
});
test("a code outside the closed set becomes UNKNOWN, carrying the code it used", () => {
  const drifted = { failure: { category: "target_not_found", code: "web.target.missing", retryable: true, stage: "target_resolution", actual: "nothing matched" } };
  const record = carried(drifted);
  assert.equal(record?.code, WEB_AUTOMATION_FAILURE_CODES.UNKNOWN);
  assert.equal(record?.category, "ambiguous_or_unknown");
  assert.equal(record?.actual, "nothing matched; unrecognized web automation failure code: web.target.missing", "the gap is visible beside what was seen, not relabelled away");
  const wordless = carried({ failure: { code: "web.target.missing" } });
  assert.equal(wordless?.actual, "unrecognized web automation failure code: web.target.missing");
});
test("the fallback fills only the descriptions the producer left empty", () => {
  const chosen = carried({ failure: { code: "web.action.rejected", expected: "an enabled control", actual: "the control is disabled" } }, { expected: "ignored", actual: "ignored" });
  assert.equal(chosen?.expected, "an enabled control");
  assert.equal(chosen?.actual, "the control is disabled");
  const filled = carried({ failure: { code: "web.action.rejected" } }, { expected: "an enabled control", actual: "the control is disabled" });
  assert.equal(filled?.expected, "an enabled control");
  assert.equal(filled?.actual, "the control is disabled");
});
test("a value that claimed no classification carries none", () => {
  for (const value of [void 0, null, "a string", new Error("no record"), {}, { failure: void 0 }, { failure: {} }, { failure: { code: 7 } }, { failure: "web.action.rejected" }]) {
    assert.equal(carried(value), void 0, JSON.stringify(value ?? null));
  }
});
