// T1 coverage of the closed failure-code set.
//
// The table below is the contract the other Wave 3 briefs quote, restated
// independently of `codes.ts` so a silent edit to a category, a retryable flag
// or a stage fails here rather than reaching the wire. Every row is then run
// through Core's own parser: a record Core would drop is a failure that never
// gets reported, which is the whole defect this taxonomy exists to close.

import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTOMATION_STUDIO_ADAPTIVE_FAILURE_CLASSES,
  AUTOMATION_STUDIO_FAILURE_RECORD_LIMITS,
  parseAutomationStudioFailureRecord
} from "fluxiq/automation-studio";
import { WEB_AUTOMATION_VALIDATION_TEXT_MAX_LENGTH } from "../../../actions/types";
import {
  WEB_AUTOMATION_FAILURE_CODES,
  WEB_AUTOMATION_FAILURE_CODE_DEFINITIONS,
  isWebAutomationFailureCode,
  webAutomationFailureRecord,
  type WebAutomationFailureCode,
  type WebAutomationFailureRecord
} from "../codes";

// [vocabulary name, wire code, category, retryable, stage]
const CODE_TABLE: ReadonlyArray<readonly [string, string, string, boolean, string]> = [
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

const CODES = Object.values(WEB_AUTOMATION_FAILURE_CODES) as WebAutomationFailureCode[];

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
    const definition = WEB_AUTOMATION_FAILURE_CODE_DEFINITIONS[code as WebAutomationFailureCode];
    assert.deepEqual(definition, { category, retryable, stage }, name);
    assert.equal(AUTOMATION_STUDIO_ADAPTIVE_FAILURE_CLASSES.includes(definition.category), true, `${name} names a Core category`);
  }
});

test("every code builds a record Core's parser accepts unchanged, bare and with descriptions", () => {
  for (const [name, code, category, retryable, stage] of CODE_TABLE) {
    const bare = webAutomationFailureRecord(code as WebAutomationFailureCode);
    assert.deepEqual(bare, { category, code, retryable, stage }, name);
    assert.deepEqual(parseAutomationStudioFailureRecord(bare), bare, `${name} survives Core's parser`);

    const described = webAutomationFailureRecord(code as WebAutomationFailureCode, { expected: "the saved banner", actual: "the form is still open" });
    assert.deepEqual(described, { category, code, retryable, stage, expected: "the saved banner", actual: "the form is still open" }, name);
    assert.deepEqual(parseAutomationStudioFailureRecord(described), described, `${name} survives Core's parser with descriptions`);
  }
});

test("the text bound is Core's own, and an over-long description is shortened rather than losing the record", () => {
  assert.equal(WEB_AUTOMATION_VALIDATION_TEXT_MAX_LENGTH, AUTOMATION_STUDIO_FAILURE_RECORD_LIMITS.textMaxLength);
  const record = webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED, { actual: "x".repeat(5_000) });
  assert.equal(record.actual?.length, WEB_AUTOMATION_VALIDATION_TEXT_MAX_LENGTH);
  assert.equal(record.actual?.endsWith("…"), true);
  assert.deepEqual(parseAutomationStudioFailureRecord(record), record);
});

test("a description that says nothing is dropped, and whitespace is collapsed to one line", () => {
  const empty = webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.TIMEOUT, { expected: "   ", actual: "\n\t " });
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

test("a record written out by hand with a code outside the set does not compile", () => {
  // The invariant, pinned. `webAutomationFailureRecord` checked its argument
  // against the set and then returned Core's record, whose `code` is a bare
  // `string` -- so the check was discarded one line after it was made, and a
  // record written out at a call site compiled with any string at all. Four
  // workers reported out-of-set codes reaching the wire while every gate
  // passed; `WebAutomationFailureRecord` is what closes that, and this row is
  // what keeps it closed.
  //
  // `@ts-expect-error` is the assertion: if this literal ever compiles again,
  // the narrowing has been widened and `check` fails here, rather than a Flow
  // meeting a code nothing downstream can act on. The runtime guard is
  // asserted beside it because the two answer different questions -- the
  // compiler speaks for values written in this build, and
  // `isWebAutomationFailureCode` for a record that crossed a process boundary.
  const handBuilt: WebAutomationFailureRecord = {
    category: "unexpected_state",
    // @ts-expect-error - "web.assert.state_mismatch" is not one of the closed set's codes
    code: "web.assert.state_mismatch",
    retryable: false,
    stage: "verification"
  };
  assert.equal(isWebAutomationFailureCode(handBuilt.code), false, "the runtime guard agrees with the compiler");
});

test("the guard admits every code and nothing else", () => {
  for (const code of CODES) assert.equal(isWebAutomationFailureCode(code), true, code);
  for (const outside of ["web.action.rejected ", "WEB.ACTION.REJECTED", "web.target.missing", "", "toString", undefined, null, 7]) {
    assert.equal(isWebAutomationFailureCode(outside), false, JSON.stringify(outside));
  }
});
