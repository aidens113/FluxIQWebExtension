// The withholding marker, and the producer's declaration that it withheld the
// values itself.
//
// The predicate is three lines and it is the whole reason a sensitive control's
// failure can still say something useful, so every way the declaration can fail
// to arrive is a row here rather than a comment. It reads a value that crossed
// a WebSocket as JSON: the sender may be older than the contract, may be some
// other client entirely, or may be hand-written, and any of those is a leak if
// this returns true when it should not.

import assert from "node:assert/strict";
import test from "node:test";
import { WEB_AUTOMATION_WITHHELD_COMPARISON_TEXT, isProducerRedactedComparison } from "../redaction";

test("the marker's words are pinned, because both exits are grepped for them", () => {
  // Two exits substitute this string and every leak proof in this plan was a
  // search of a whole serialized payload. A marker that drifts at one exit is a
  // proof nobody can repeat.
  assert.equal(WEB_AUTOMATION_WITHHELD_COMPARISON_TEXT, "(withheld: the action ran on a control that holds a secret)");
  assert.equal(WEB_AUTOMATION_WITHHELD_COMPARISON_TEXT.includes("withheld"), true, "an operator reading it must be able to tell withholding from an empty field");
});

test("the boolean true, and only it, is a declaration", () => {
  assert.equal(isProducerRedactedComparison({ status: "failed", expected: "a withheld value of 12 characters", actual: "an empty field", redacted: true }), true);
});

test("an absent declaration is not a declaration", () => {
  // The fail-safe, and the point of the whole design: a verb nobody taught the
  // flag, and a client that predates the contract, both land here.
  assert.equal(isProducerRedactedComparison({ status: "failed", expected: "the field holds \"x\"", actual: "the field holds \"y\"" }), false);
  assert.equal(isProducerRedactedComparison({ status: "none", reason: "not-yet-validated" }), false);
  assert.equal(isProducerRedactedComparison({}), false);
});

test("nothing that merely resembles the declaration is one", () => {
  // A wire carries JSON, so a sender can put anything in the field. Truthiness
  // is not the test; the boolean is.
  assert.equal(isProducerRedactedComparison({ redacted: false }), false);
  assert.equal(isProducerRedactedComparison({ redacted: "true" }), false);
  assert.equal(isProducerRedactedComparison({ redacted: 1 }), false);
  assert.equal(isProducerRedactedComparison({ redacted: "yes" }), false);
  assert.equal(isProducerRedactedComparison({ redacted: {} }), false);
  assert.equal(isProducerRedactedComparison({ Redacted: true }), false);
});

test("a value that is not a validation object claims nothing", () => {
  // The input is `unknown` on purpose, so every shape that is not an object has
  // to answer false rather than throw into a caller mid-redaction.
  assert.equal(isProducerRedactedComparison(undefined), false);
  assert.equal(isProducerRedactedComparison(null), false);
  assert.equal(isProducerRedactedComparison("redacted"), false);
  assert.equal(isProducerRedactedComparison(0), false);
  assert.equal(isProducerRedactedComparison(true), false);
  assert.equal(isProducerRedactedComparison([{ redacted: true }]), false);
});

test("the marker is not itself a declaration", () => {
  // A comparison carrying the marker text but no flag is still withheld again,
  // which is idempotent and costs nothing. Text is never read here: this row
  // exists so nobody adds a shortcut that reads it.
  assert.equal(isProducerRedactedComparison({ status: "failed", expected: WEB_AUTOMATION_WITHHELD_COMPARISON_TEXT, actual: WEB_AUTOMATION_WITHHELD_COMPARISON_TEXT }), false);
});
