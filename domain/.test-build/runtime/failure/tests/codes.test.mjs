// src/runtime/failure/tests/codes.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTOMATION_STUDIO_ADAPTIVE_FAILURE_CLASSES,
  AUTOMATION_STUDIO_FAILURE_RECORD_LIMITS,
  parseAutomationStudioFailureRecord
} from "fluxiq/automation-studio";

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

// src/runtime/failure/tests/codes.test.ts
var CODE_TABLE = [
  ["ACTION_REJECTED", "web.action.rejected", "blocked_by_capability_or_policy", false, "execution"],
  ["TARGET_NOT_FOUND", "web.target.not_found", "target_not_found", true, "target_resolution"],
  ["TARGET_AMBIGUOUS", "web.target.ambiguous", "target_ambiguous", false, "target_resolution"],
  ["OUTPUT_NOT_OBSERVED", "web.validation.output_not_observed", "output_not_observed", true, "verification"],
  ["STATE_MISMATCH", "web.validation.state_mismatch", "unexpected_state", false, "verification"],
  ["NAVIGATION_UNEXPECTED", "web.navigation.unexpected", "navigation_unexpected", false, "confirmation"],
  ["PAGE_CHANGED", "web.page.changed", "page_changed", true, "execution"],
  ["TIMEOUT", "web.action.timeout", "timeout", true, "execution"],
  ["AUTH_REQUIRED", "web.auth.required", "auth_required", false, "confirmation"],
  ["USER_INTERVENTION_REQUIRED", "web.intervention.required", "user_intervention_required", false, "execution"],
  ["UNSUPPORTED_TYPE", "web.action.unsupported_type", "blocked_by_capability_or_policy", false, "dispatch"],
  ["NOT_IMPLEMENTED", "web.action.not_implemented", "blocked_by_capability_or_policy", false, "dispatch"],
  ["ACTION_FAILED", "web.action.failed", "action_failed", true, "execution"],
  ["UNKNOWN", "web.action.unknown", "ambiguous_or_unknown", false, "execution"]
];
var CODES = Object.values(WEB_AUTOMATION_FAILURE_CODES);
test("the closed set is exactly the table the briefs quote, by vocabulary name and wire code", () => {
  assert.deepEqual(Object.keys(WEB_AUTOMATION_FAILURE_CODES), CODE_TABLE.map(([name]) => name));
  assert.deepEqual(CODES, CODE_TABLE.map(([, code]) => code));
  assert.equal(new Set(CODES).size, CODES.length, "a code is used once");
  assert.deepEqual(Object.keys(WEB_AUTOMATION_FAILURE_CODE_DEFINITIONS).sort(), [...CODES].sort(), "every code has a definition and no definition is orphaned");
  assert.equal(Object.isFrozen(WEB_AUTOMATION_FAILURE_CODES), true);
  assert.equal(Object.isFrozen(WEB_AUTOMATION_FAILURE_CODE_DEFINITIONS), true);
});
test("each code carries the category, retryable flag and stage its row names", () => {
  for (const [name, code, category, retryable, stage] of CODE_TABLE) {
    const definition = WEB_AUTOMATION_FAILURE_CODE_DEFINITIONS[code];
    assert.deepEqual(definition, { category, retryable, stage }, name);
    assert.equal(AUTOMATION_STUDIO_ADAPTIVE_FAILURE_CLASSES.includes(definition.category), true, `${name} names a Core category`);
  }
});
test("every code builds a record Core's parser accepts unchanged, bare and with descriptions", () => {
  for (const [name, code, category, retryable, stage] of CODE_TABLE) {
    const bare = webAutomationFailureRecord(code);
    assert.deepEqual(bare, { category, code, retryable, stage }, name);
    assert.deepEqual(parseAutomationStudioFailureRecord(bare), bare, `${name} survives Core's parser`);
    const described = webAutomationFailureRecord(code, { expected: "the saved banner", actual: "the form is still open" });
    assert.deepEqual(described, { category, code, retryable, stage, expected: "the saved banner", actual: "the form is still open" }, name);
    assert.deepEqual(parseAutomationStudioFailureRecord(described), described, `${name} survives Core's parser with descriptions`);
  }
});
test("the text bound is Core's own, and an over-long description is shortened rather than losing the record", () => {
  assert.equal(WEB_AUTOMATION_VALIDATION_TEXT_MAX_LENGTH, AUTOMATION_STUDIO_FAILURE_RECORD_LIMITS.textMaxLength);
  const record = webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED, { actual: "x".repeat(5e3) });
  assert.equal(record.actual?.length, WEB_AUTOMATION_VALIDATION_TEXT_MAX_LENGTH);
  assert.equal(record.actual?.endsWith("\u2026"), true);
  assert.deepEqual(parseAutomationStudioFailureRecord(record), record);
});
test("a description that says nothing is dropped, and whitespace is collapsed to one line", () => {
  const empty = webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.TIMEOUT, { expected: "   ", actual: "\n	 " });
  assert.equal("expected" in empty, false, "the parser rejects an empty string, so the field is omitted");
  assert.equal("actual" in empty, false);
  assert.deepEqual(parseAutomationStudioFailureRecord(empty), empty);
  const collapsed = webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.TIMEOUT, { actual: "  no element\n  matched  " });
  assert.equal(collapsed.actual, "no element matched");
});
test("an evidence digest is kept only in the shape Core accepts", () => {
  const digest = "a".repeat(64);
  const kept = webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.ACTION_FAILED, { evidenceDigest: digest });
  assert.equal(kept.evidenceDigest, digest);
  assert.deepEqual(parseAutomationStudioFailureRecord(kept), kept);
  const dropped = webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.ACTION_FAILED, { evidenceDigest: "NOT-A-DIGEST" });
  assert.equal("evidenceDigest" in dropped, false, "one lost optional field beats a record Core discards whole");
  assert.deepEqual(parseAutomationStudioFailureRecord(dropped), dropped);
});
test("the guard admits every code and nothing else", () => {
  for (const code of CODES) assert.equal(isWebAutomationFailureCode(code), true, code);
  for (const outside of ["web.action.rejected ", "WEB.ACTION.REJECTED", "web.target.missing", "", "toString", void 0, null, 7]) {
    assert.equal(isWebAutomationFailureCode(outside), false, JSON.stringify(outside));
  }
});
