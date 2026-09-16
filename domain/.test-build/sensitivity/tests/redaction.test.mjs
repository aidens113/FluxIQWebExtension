// src/sensitivity/tests/redaction.test.ts
import assert from "node:assert/strict";
import test from "node:test";

// src/sensitivity/redaction.ts
var WEB_AUTOMATION_WITHHELD_COMPARISON_TEXT = "(withheld: the action ran on a control that holds a secret)";
function isProducerRedactedComparison(validation) {
  if (!validation || typeof validation !== "object" || Array.isArray(validation)) return false;
  return validation.redacted === true;
}

// src/sensitivity/tests/redaction.test.ts
test("the marker's words are pinned, because both exits are grepped for them", () => {
  assert.equal(WEB_AUTOMATION_WITHHELD_COMPARISON_TEXT, "(withheld: the action ran on a control that holds a secret)");
  assert.equal(WEB_AUTOMATION_WITHHELD_COMPARISON_TEXT.includes("withheld"), true, "an operator reading it must be able to tell withholding from an empty field");
});
test("the boolean true, and only it, is a declaration", () => {
  assert.equal(isProducerRedactedComparison({ status: "failed", expected: "a withheld value of 12 characters", actual: "an empty field", redacted: true }), true);
});
test("an absent declaration is not a declaration", () => {
  assert.equal(isProducerRedactedComparison({ status: "failed", expected: 'the field holds "x"', actual: 'the field holds "y"' }), false);
  assert.equal(isProducerRedactedComparison({ status: "none", reason: "not-yet-validated" }), false);
  assert.equal(isProducerRedactedComparison({}), false);
});
test("nothing that merely resembles the declaration is one", () => {
  assert.equal(isProducerRedactedComparison({ redacted: false }), false);
  assert.equal(isProducerRedactedComparison({ redacted: "true" }), false);
  assert.equal(isProducerRedactedComparison({ redacted: 1 }), false);
  assert.equal(isProducerRedactedComparison({ redacted: "yes" }), false);
  assert.equal(isProducerRedactedComparison({ redacted: {} }), false);
  assert.equal(isProducerRedactedComparison({ Redacted: true }), false);
});
test("a value that is not a validation object claims nothing", () => {
  assert.equal(isProducerRedactedComparison(void 0), false);
  assert.equal(isProducerRedactedComparison(null), false);
  assert.equal(isProducerRedactedComparison("redacted"), false);
  assert.equal(isProducerRedactedComparison(0), false);
  assert.equal(isProducerRedactedComparison(true), false);
  assert.equal(isProducerRedactedComparison([{ redacted: true }]), false);
});
test("the marker is not itself a declaration", () => {
  assert.equal(isProducerRedactedComparison({ status: "failed", expected: WEB_AUTOMATION_WITHHELD_COMPARISON_TEXT, actual: WEB_AUTOMATION_WITHHELD_COMPARISON_TEXT }), false);
});
