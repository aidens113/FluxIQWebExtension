// T1 coverage of the result model's decision rules (Phase 1.2 step 1): what a
// validation implies for an action's status, and the structured failure that
// goes with it.
//
// The rules are tested against Core's own parser rather than against a copy of
// its expectations, because Core drops a record whole when it is unbounded or
// self-contradictory: a record that does not survive the parser would lose the
// failure silently on the way to the gateway. `validation-outcome.ts` is kept
// free of the DOM precisely so this can run here; the assembled result is
// proven against a real page by `e2e/content/tests/actions.spec.ts`.

import assert from "node:assert/strict";
import test from "node:test";
import { parseAutomationStudioFailureRecord } from "fluxiq/automation-studio";
import { WEB_AUTOMATION_VALIDATION_TEXT_MAX_LENGTH } from "@fluxiq-web-extension/domain/client";
import {
  VALIDATION_TEXT_MAX_LENGTH,
  boundValidation,
  notImplementedFailure,
  outputNotObservedFailure,
  rejectionFailure,
  statusForValidation,
  timeoutFailure
} from "../validation-outcome";

test("an action whose post-condition did not hold did not succeed", () => {
  assert.equal(statusForValidation({ status: "failed", expected: "a", actual: "b" }), "failed");
  assert.equal(statusForValidation({ status: "passed", expected: "a", actual: "a" }), "succeeded");
  assert.equal(statusForValidation({ status: "none", reason: "evidence-only" }), "succeeded");
  assert.equal(statusForValidation({ status: "none", reason: "not-yet-validated" }), "succeeded");
});

test("a failed validation becomes output_not_observed carrying both sides", () => {
  const failure = outputNotObservedFailure({ status: "failed", expected: "the form is submitted", actual: "the form was not submitted" });
  assert.deepEqual(failure, {
    category: "output_not_observed",
    code: "web.validation.output_not_observed",
    retryable: true,
    stage: "verification",
    expected: "the form is submitted",
    actual: "the form was not submitted"
  });
  assert.deepEqual(parseAutomationStudioFailureRecord(failure), failure, "Core keeps the record whole");
});

test("a passed or skipped validation produces no failure", () => {
  assert.equal(outputNotObservedFailure({ status: "passed", expected: "a", actual: "a" }), undefined);
  assert.equal(outputNotObservedFailure({ status: "none", reason: "evidence-only" }), undefined);
});

test("a rejection is never retryable, which is Core's own rule for the category", () => {
  const failure = rejectionFailure("disabled", { status: "failed", expected: "an enabled target", actual: "the target is disabled" });
  assert.deepEqual(failure, {
    category: "blocked_by_capability_or_policy",
    code: "web.action.disabled",
    retryable: false,
    stage: "execution",
    expected: "an enabled target",
    actual: "the target is disabled"
  });
  assert.deepEqual(parseAutomationStudioFailureRecord(failure), failure);
  // Core drops a record that calls this category retryable, so the flag is the
  // difference between a reported rejection and a lost one.
  assert.equal(parseAutomationStudioFailureRecord({ ...failure, retryable: true }), null);
});

test("a timeout carries Core's timeout category", () => {
  const failure = timeoutFailure({ status: "failed", expected: "an element matching #late", actual: "no element matched before the timeout" });
  assert.equal(failure.category, "timeout");
  assert.equal(failure.code, "web.action.timeout");
  assert.deepEqual(parseAutomationStudioFailureRecord(failure), failure);
});

test("an unbuilt verb reports a capability refusal, not a success", () => {
  const failure = notImplementedFailure();
  assert.equal(failure.category, "blocked_by_capability_or_policy");
  assert.equal(failure.retryable, false);
  assert.deepEqual(parseAutomationStudioFailureRecord(failure), failure);
});

test("validation text is bounded to Core's limit and is never empty", () => {
  assert.equal(VALIDATION_TEXT_MAX_LENGTH, WEB_AUTOMATION_VALIDATION_TEXT_MAX_LENGTH, "the content script and the domain agree on the bound");
  assert.deepEqual(boundValidation({ status: "failed", expected: "   ", actual: "a  b\n c" }), {
    status: "failed",
    expected: "(none)",
    actual: "a b c"
  }, "Core rejects an empty expected or actual");
  assert.deepEqual(boundValidation({ status: "none", reason: "evidence-only" }), { status: "none", reason: "evidence-only" });
});

test("an unbounded validation still produces a record Core accepts", () => {
  // Page text is unbounded. Without the bound, Core would discard the whole
  // record and the failure would vanish rather than being truncated.
  const bounded = boundValidation({ status: "failed", expected: "e".repeat(5_000), actual: "a".repeat(5_000) });
  const failure = outputNotObservedFailure(bounded);
  assert.equal(failure?.expected?.length, VALIDATION_TEXT_MAX_LENGTH);
  assert.deepEqual(parseAutomationStudioFailureRecord(failure), failure);
});
