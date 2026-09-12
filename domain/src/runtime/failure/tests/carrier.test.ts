// T1 coverage of the one mechanism a producer uses to report a failure it
// already classified: a record attached to what it throws.
//
// Two of these rows exist because of what replaced them. Until 2026-09-12 the
// documented mechanism was a `WebAutomationRuntimeError` carrying a bare
// `code: string`, which nothing in the tree ever threw and which the browser
// side -- the one place that would produce one -- could not reach through any
// barrel. The rows below pin the properties that made the record the mechanism
// that won: it survives a class identity the reader does not share, and it
// cannot deliver a row Core's parser would drop.

import assert from "node:assert/strict";
import test from "node:test";
import { parseAutomationStudioFailureRecord } from "fluxiq/automation-studio";
import { carriedWebAutomationFailure, type WebAutomationFailureCarrier } from "../carrier";
import { WEB_AUTOMATION_FAILURE_CODES, webAutomationFailureRecord, type WebAutomationFailureRecord } from "../codes";

/** Assert the record survives Core's parser, and hand it back. */
function carried(error: unknown, fallback?: { expected?: string; actual?: string }): WebAutomationFailureRecord | undefined {
  const record = carriedWebAutomationFailure(error, fallback);
  if (record !== undefined) assert.deepEqual(parseAutomationStudioFailureRecord(record), record, `Core's parser accepts ${record.code}`);
  return record;
}

test("the carrier type holds a producer's code to the closed set at the throw", () => {
  // The compile-time half of this module's contract, and the half the retired
  // error class did not have: `failure` is a `WebAutomationFailureRecord`, so
  // `code` is the closed union. A producer writing `code: "web.target.missing"`
  // here does not reach a runtime UNKNOWN -- it fails `tsc`.
  class TargetResolutionError extends Error implements WebAutomationFailureCarrier {
    readonly failure = webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.TARGET_AMBIGUOUS, {
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
  // The content script bundles its own copy of the domain, so `instanceof`
  // against anything declared here is false for a value it threw, and so is
  // any check on the class name -- which the retired mechanism depended on.
  // Only the record's shape crosses that boundary, and it is all this reads.
  const fromAnotherBundle = { name: "SomeErrorThisBuildHasNeverHeardOf", message: "the document was replaced", failure: { category: "page_changed", code: "web.page.changed", retryable: true, stage: "execution" } };
  const record = carried(fromAnotherBundle);
  assert.equal(record?.code, WEB_AUTOMATION_FAILURE_CODES.PAGE_CHANGED);
});

test("a carried record is rebuilt from its own code, so a contradicting row cannot reach Core", () => {
  // A thrower one build behind can pair a named code with a category its row
  // forbids. Core's parser drops an inconsistent record whole rather than
  // repairing it, so trusting the value field by field risks losing the failure
  // entirely. This is the answer `clientReportedFailure` in `adapter.ts` gives
  // the same drift arriving over the WebSocket.
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
  for (const value of [undefined, null, "a string", new Error("no record"), {}, { failure: undefined }, { failure: {} }, { failure: { code: 7 } }, { failure: "web.action.rejected" }]) {
    assert.equal(carried(value), undefined, JSON.stringify(value ?? null));
  }
});
