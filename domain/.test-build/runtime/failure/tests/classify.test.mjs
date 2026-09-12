// src/runtime/failure/tests/classify.test.ts
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
  const carried = property(error, "failure");
  const code = property(carried, "code");
  if (typeof code !== "string") return void 0;
  const comparison = {
    expected: text(property(carried, "expected")) ?? fallback.expected,
    actual: text(property(carried, "actual")) ?? fallback.actual,
    evidenceDigest: text(property(carried, "evidenceDigest")) ?? fallback.evidenceDigest
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

// src/runtime/failure/classify.ts
function classifyWebAutomationFailure(error, outcome) {
  if (outcome.failure !== void 0) return outcome.failure;
  const carried = carriedWebAutomationFailure(error, withActual(comparedText(outcome.validation), errorMessage(error)));
  if (carried !== void 0) return carried;
  const classified2 = classifyOutcome(error, outcome);
  return classified2 === void 0 ? void 0 : webAutomationFailureRecord(classified2.code, classified2.comparison);
}
function classifyOutcome(error, outcome) {
  const compared = comparedText(outcome.validation);
  if (outcome.status === "timed_out") return { code: WEB_AUTOMATION_FAILURE_CODES.TIMEOUT, comparison: withActual(compared, errorMessage(error)) };
  if (outcome.validation?.status === "failed") {
    const code = outcome.actionType === "web.dom.assert" ? WEB_AUTOMATION_FAILURE_CODES.STATE_MISMATCH : WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED;
    return { code, comparison: compared };
  }
  if (error !== void 0 && error !== null) {
    return { code: WEB_AUTOMATION_FAILURE_CODES.ACTION_FAILED, comparison: withActual(compared, errorMessage(error) ?? "the action threw a value that carried no message") };
  }
  if (outcome.status === "failed" || outcome.status === "unknown") {
    const message = outcome.message;
    if (message === void 0 || message.trim().length === 0) return { code: WEB_AUTOMATION_FAILURE_CODES.UNKNOWN, comparison: compared };
    return { code: WEB_AUTOMATION_FAILURE_CODES.ACTION_FAILED, comparison: withActual(compared, message) };
  }
  return void 0;
}
function comparedText(validation) {
  if (validation === void 0 || validation.status === "none") return {};
  return { expected: validation.expected, actual: validation.actual };
}
function withActual(compared, actual) {
  return compared.actual !== void 0 ? compared : { ...compared, actual };
}
function errorMessage(error) {
  if (error instanceof Error) return error.message.length > 0 ? error.message : void 0;
  if (typeof error === "string") return error.length > 0 ? error : void 0;
  if (typeof error !== "object" || error === null) return void 0;
  const message = error.message;
  return typeof message === "string" && message.length > 0 ? message : void 0;
}

// src/runtime/failure/tests/classify.test.ts
var ProducerError = class extends Error {
  failure;
  constructor(failure, message) {
    super(message);
    this.name = "ProducerError";
    this.failure = failure;
  }
};
var CODES = Object.values(WEB_AUTOMATION_FAILURE_CODES);
var failedValidation = { status: "failed", expected: "the saved banner", actual: "the form is still open" };
function classified(error, outcome) {
  const record = classifyWebAutomationFailure(error, outcome);
  if (record !== void 0) assert.deepEqual(parseAutomationStudioFailureRecord(record), record, `Core's parser accepts ${record.code}`);
  return record;
}
test("a failure the producer already reported is passed through untouched", () => {
  const reported = { category: "target_not_found", code: "web.target.not_found", retryable: true, stage: "target_resolution" };
  const record = classified(new Error("ignored"), { status: "failed", failure: reported, validation: failedValidation });
  assert.equal(record, reported, "the producer stood nearest the page; nothing here overwrites it");
});
test("a thrower that attached its own record is honoured, for every code in the set", () => {
  for (const code of CODES) {
    const record = classified(new ProducerError(webAutomationFailureRecord(code), "the element was covered"), { status: "failed" });
    assert.equal(record?.code, code, code);
    assert.equal(record?.actual, "the element was covered", "the thrown message fills the description the producer left empty");
  }
});
test("a carried record outranks everything the outcome could be read for", () => {
  const record = classified(new ProducerError(webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.PAGE_CHANGED), "the document was replaced"), {
    status: "timed_out",
    actionType: "web.dom.assert",
    validation: failedValidation
  });
  assert.equal(record?.code, WEB_AUTOMATION_FAILURE_CODES.PAGE_CHANGED);
  assert.equal(record?.expected, "the saved banner");
  assert.equal(record?.actual, "the form is still open");
});
test("a thrown value carrying no record at all is classified from the outcome, not silently honoured", () => {
  const noFailureProperty = classified(new Error("the click never landed"), { status: "failed" });
  assert.equal(noFailureProperty?.code, WEB_AUTOMATION_FAILURE_CODES.ACTION_FAILED);
  const failureWithoutCode = classified(Object.assign(new Error("the click never landed"), { failure: { actual: "nothing happened" } }), { status: "failed" });
  assert.equal(failureWithoutCode?.code, WEB_AUTOMATION_FAILURE_CODES.ACTION_FAILED, "a `failure` that names no code claimed no classification");
});
test("a timed-out action is a timeout, not the failed validation the wait left behind", () => {
  const record = classified(void 0, { status: "timed_out", validation: { status: "failed", expected: "an element matching #late", actual: "no element matched before the timeout" } });
  assert.equal(record?.code, WEB_AUTOMATION_FAILURE_CODES.TIMEOUT);
  assert.equal(record?.category, "timeout");
  assert.equal(record?.actual, "no element matched before the timeout", "the validation still says what was seen");
});
test("a failed post-condition is OUTPUT_NOT_OBSERVED, and an authored assertion is STATE_MISMATCH", () => {
  const observed = classified(void 0, { status: "failed", actionType: "web.dom.click", validation: failedValidation });
  assert.equal(observed?.code, WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED);
  assert.equal(observed?.expected, "the saved banner");
  assert.equal(observed?.actual, "the form is still open");
  const asserted = classified(void 0, { status: "failed", actionType: "web.dom.assert", validation: failedValidation });
  assert.equal(asserted?.code, WEB_AUTOMATION_FAILURE_CODES.STATE_MISMATCH);
  assert.equal(asserted?.category, "unexpected_state");
});
test("an action that succeeded on paper but failed its post-condition is still classified", () => {
  const record = classified(void 0, { status: "succeeded", actionType: "web.dom.type", validation: failedValidation });
  assert.equal(record?.code, WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED);
});
test("a thrown value that classified nothing is an action that ran and failed", () => {
  const withMessage = classified(new TypeError("target.focus is not a function"), { status: "failed" });
  assert.equal(withMessage?.code, WEB_AUTOMATION_FAILURE_CODES.ACTION_FAILED);
  assert.equal(withMessage?.actual, "target.focus is not a function");
  const wordless = classified({ thrown: true }, { status: "failed" });
  assert.equal(wordless?.code, WEB_AUTOMATION_FAILURE_CODES.ACTION_FAILED);
  assert.equal(wordless?.actual, "the action threw a value that carried no message");
});
test("a failure described only in words becomes ACTION_FAILED; one described not at all becomes UNKNOWN", () => {
  const described = classified(void 0, { status: "failed", message: "The download never started." });
  assert.equal(described?.code, WEB_AUTOMATION_FAILURE_CODES.ACTION_FAILED);
  assert.equal(described?.actual, "The download never started.");
  for (const outcome of [{ status: "failed" }, { status: "failed", message: "   " }, { status: "unknown" }]) {
    const record = classified(void 0, outcome);
    assert.equal(record?.code, WEB_AUTOMATION_FAILURE_CODES.UNKNOWN, JSON.stringify(outcome));
    assert.equal(record?.category, "ambiguous_or_unknown");
  }
});
test("an outcome that names no failure classifies as none", () => {
  assert.equal(classified(void 0, { status: "succeeded", validation: { status: "passed", expected: "the saved banner", actual: "the saved banner" } }), void 0);
  assert.equal(classified(void 0, { status: "succeeded", validation: { status: "none", reason: "evidence-only" } }), void 0);
  assert.equal(classified(null, { status: "cancelled" }), void 0, "Core derives a cancellation from the command status itself");
});
