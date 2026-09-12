// T1 coverage of the classifier: which code an outcome lands on, and in what
// order the evidence is weighed. Every record it produces is also run through
// Core's parser, because a classification Core discards is no classification.

import assert from "node:assert/strict";
import test from "node:test";
import { parseAutomationStudioFailureRecord } from "fluxiq/automation-studio";
import { WebAutomationRuntimeError } from "../../errors";
import { classifyWebAutomationFailure, type WebAutomationActionOutcome } from "../classify";
import { WEB_AUTOMATION_FAILURE_CODES, type WebAutomationFailureCode, type WebAutomationFailureRecord } from "../codes";

const CODES = Object.values(WEB_AUTOMATION_FAILURE_CODES) as WebAutomationFailureCode[];

const failedValidation = { status: "failed", expected: "the saved banner", actual: "the form is still open" } as const;

/** Classify, assert the result survives Core's parser, and hand it back. */
function classified(error: unknown, outcome: WebAutomationActionOutcome): WebAutomationFailureRecord | undefined {
  const record = classifyWebAutomationFailure(error, outcome);
  if (record !== undefined) assert.deepEqual(parseAutomationStudioFailureRecord(record), record, `Core's parser accepts ${record.code}`);
  return record;
}

test("a failure the producer already reported is passed through untouched", () => {
  const reported: WebAutomationFailureRecord = { category: "target_not_found", code: "web.target.not_found", retryable: true, stage: "target_resolution" };
  const record = classified(new Error("ignored"), { status: "failed", failure: reported, validation: failedValidation });
  assert.equal(record, reported, "the producer stood nearest the page; nothing here overwrites it");
});

test("a runtime error naming a code in the closed set is honoured, for every code", () => {
  for (const code of CODES) {
    const record = classified(new WebAutomationRuntimeError(code, "the element was covered"), { status: "failed" });
    assert.equal(record?.code, code, code);
  }
});

test("a runtime error raised against another copy of the class is recognized structurally", () => {
  const lookalike = { name: "WebAutomationRuntimeError", code: WEB_AUTOMATION_FAILURE_CODES.PAGE_CHANGED, message: "the document was replaced" };
  const record = classified(lookalike, { status: "failed" });
  assert.equal(record?.code, WEB_AUTOMATION_FAILURE_CODES.PAGE_CHANGED);
  assert.equal(record?.actual, "the document was replaced");
});

test("a runtime error naming a code outside the set becomes UNKNOWN, carrying the code it used", () => {
  const record = classified(new WebAutomationRuntimeError("web.target.missing", "no idea"), { status: "failed" });
  assert.equal(record?.code, WEB_AUTOMATION_FAILURE_CODES.UNKNOWN);
  assert.equal(record?.actual, "unrecognized web automation failure code: web.target.missing");
});

test("a timed-out action is a timeout, not the failed validation the wait left behind", () => {
  const record = classified(undefined, { status: "timed_out", validation: { status: "failed", expected: "an element matching #late", actual: "no element matched before the timeout" } });
  assert.equal(record?.code, WEB_AUTOMATION_FAILURE_CODES.TIMEOUT);
  assert.equal(record?.category, "timeout");
  assert.equal(record?.actual, "no element matched before the timeout", "the validation still says what was seen");
});

test("a failed post-condition is OUTPUT_NOT_OBSERVED, and an authored assertion is STATE_MISMATCH", () => {
  const observed = classified(undefined, { status: "failed", actionType: "web.dom.click", validation: failedValidation });
  assert.equal(observed?.code, WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED);
  assert.equal(observed?.expected, "the saved banner");
  assert.equal(observed?.actual, "the form is still open");

  const asserted = classified(undefined, { status: "failed", actionType: "web.dom.assert", validation: failedValidation });
  assert.equal(asserted?.code, WEB_AUTOMATION_FAILURE_CODES.STATE_MISMATCH);
  assert.equal(asserted?.category, "unexpected_state");
});

test("an action that succeeded on paper but failed its post-condition is still classified", () => {
  const record = classified(undefined, { status: "succeeded", actionType: "web.dom.type", validation: failedValidation });
  assert.equal(record?.code, WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED);
});

test("a thrown value that is not a runtime error is an action that ran and failed", () => {
  const withMessage = classified(new TypeError("target.focus is not a function"), { status: "failed" });
  assert.equal(withMessage?.code, WEB_AUTOMATION_FAILURE_CODES.ACTION_FAILED);
  assert.equal(withMessage?.actual, "target.focus is not a function");

  const wordless = classified({ thrown: true }, { status: "failed" });
  assert.equal(wordless?.code, WEB_AUTOMATION_FAILURE_CODES.ACTION_FAILED);
  assert.equal(wordless?.actual, "the action threw a value that carried no message");
});

test("a failure described only in words becomes ACTION_FAILED; one described not at all becomes UNKNOWN", () => {
  const described = classified(undefined, { status: "failed", message: "The download never started." });
  assert.equal(described?.code, WEB_AUTOMATION_FAILURE_CODES.ACTION_FAILED);
  assert.equal(described?.actual, "The download never started.");

  for (const outcome of [{ status: "failed" } as const, { status: "failed", message: "   " } as const, { status: "unknown" } as const]) {
    const record = classified(undefined, outcome);
    assert.equal(record?.code, WEB_AUTOMATION_FAILURE_CODES.UNKNOWN, JSON.stringify(outcome));
    assert.equal(record?.category, "ambiguous_or_unknown");
  }
});

test("an outcome that names no failure classifies as none", () => {
  assert.equal(classified(undefined, { status: "succeeded", validation: { status: "passed", expected: "the saved banner", actual: "the saved banner" } }), undefined);
  assert.equal(classified(undefined, { status: "succeeded", validation: { status: "none", reason: "evidence-only" } }), undefined);
  assert.equal(classified(null, { status: "cancelled" }), undefined, "Core derives a cancellation from the command status itself");
});
