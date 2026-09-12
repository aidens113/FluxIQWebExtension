// T1 coverage of the classifier: which code an outcome lands on, and in what
// order the evidence is weighed. Every record it produces is also run through
// Core's parser, because a classification Core discards is no classification.

import assert from "node:assert/strict";
import test from "node:test";
import { parseAutomationStudioFailureRecord } from "fluxiq/automation-studio";
import { type WebAutomationFailureCarrier } from "../carrier";
import { classifyWebAutomationFailure, type WebAutomationActionOutcome } from "../classify";
import { WEB_AUTOMATION_FAILURE_CODES, webAutomationFailureRecord, type WebAutomationFailureCode, type WebAutomationFailureRecord } from "../codes";

/**
 * A producer that knows what failed, as the tree writes one: an error whose
 * type says what went wrong, carrying the record that says it in Core's
 * taxonomy. `resolve-target.ts` and `execute.ts` are the real instances.
 */
class ProducerError extends Error implements WebAutomationFailureCarrier {
  readonly failure: WebAutomationFailureRecord;

  constructor(failure: WebAutomationFailureRecord, message: string) {
    super(message);
    this.name = "ProducerError";
    this.failure = failure;
  }
}

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

test("a thrower that attached its own record is honoured, for every code in the set", () => {
  for (const code of CODES) {
    const record = classified(new ProducerError(webAutomationFailureRecord(code), "the element was covered"), { status: "failed" });
    assert.equal(record?.code, code, code);
    assert.equal(record?.actual, "the element was covered", "the thrown message fills the description the producer left empty");
  }
});

test("a carried record outranks everything the outcome could be read for", () => {
  // The producer stood nearest the page. A failed validation and a timed-out
  // status would each name a code of their own, and neither displaces the one
  // the thrower chose. What the validation saw still fills the description.
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

test("a thrown value that classified nothing is an action that ran and failed", () => {
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
