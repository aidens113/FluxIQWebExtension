// T1 coverage of the result model's decision rules (Phase 1.2 step 1): what a
// validation implies for an action's status, and the bound its text has to
// respect.
//
// The four failure builders this file used to cover are gone, along with their
// tests. Each wrote a Core category, a retryable flag and a stage by hand beside
// a `code` string, and `rejectionFailure` composed that string from a
// caller-supplied suffix -- the last way in the content bundle to mint a code
// the closed set does not name. None had a production caller once `results.ts`
// moved to `webAutomationFailureRecord`, so a green test here was proof of dead
// code that disagreed with the wire. What replaced that coverage lives where the
// records are actually built: `runtime/tests/action-results.test.ts` and
// `content/actions/tests/assert.test.ts` both round-trip a whole record through
// Core's parser, which drops one it refuses rather than repairing it.
//
// `validation-outcome.ts` is kept free of the DOM precisely so this can run in
// Node; the assembled result is proven against a real page by
// `e2e/content/tests/actions.spec.ts`.

import assert from "node:assert/strict";
import test from "node:test";
import { parseAutomationStudioFailureRecord } from "fluxiq/automation-studio";
import {
  WEB_AUTOMATION_FAILURE_CODES,
  WEB_AUTOMATION_VALIDATION_TEXT_MAX_LENGTH,
  webAutomationFailureRecord
} from "@fluxiq-web-extension/domain/client";
import * as validationOutcome from "../validation-outcome";
import { VALIDATION_TEXT_MAX_LENGTH, boundValidation, statusForValidation, truncateValidationText } from "../validation-outcome";

test("an action whose post-condition did not hold did not succeed", () => {
  assert.equal(statusForValidation({ status: "failed", expected: "a", actual: "b" }), "failed");
  assert.equal(statusForValidation({ status: "passed", expected: "a", actual: "a" }), "succeeded");
  assert.equal(statusForValidation({ status: "none", reason: "evidence-only" }), "succeeded");
  assert.equal(statusForValidation({ status: "none", reason: "not-yet-validated" }), "succeeded");
});

test("the module exports no failure builder, which is what keeps the closed set closed", () => {
  // The surface is pinned rather than described, because the risk is additive:
  // a builder reintroduced here would be the only place in the content bundle
  // that writes a `code` outside the domain's table, and it would pass every
  // other gate -- including the type checker.
  //
  // That last part is the reason this row is not redundant with the compiler,
  // and it was measured rather than assumed. `webAutomationFailureRecord`
  // narrows its `code` parameter, so a *call* naming an out-of-set string is
  // `TS2345`. A record written out as a literal is not: the type it lands in is
  // Core's `AutomationStudioFailureRecord`, whose `code` is a bare `string`
  // because Core owns the categories and each producer owns its own codes. A
  // hand-built `{ category, code: "web.assert.state_mismatch", retryable,
  // stage }` compiles at exit 0 today. Narrowing `BrowserActionResult`'s
  // `failure` would turn that into `TS2322`, and it needs the domain builder's
  // *return* type narrowed in the same change or every honest producer breaks;
  // when that lands, this row can go.
  //
  // A value that did not come from source is a different question, and it is
  // already answered elsewhere: `results.ts`'s `reportedFailure` runs
  // `isWebAutomationFailureCode` over the record a thrown error carries before
  // trusting it. Nothing else reaches the extension carrying a failure record
  // -- the gateway sends commands, and results only travel outward.
  assert.deepEqual(Object.keys(validationOutcome).sort(), [
    "VALIDATION_TEXT_MAX_LENGTH",
    "boundValidation",
    "statusForValidation",
    "truncateValidationText"
  ]);
  assert.equal(truncateValidationText("  a  b "), "a b");
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
  // record and the failure would vanish rather than being truncated. The record
  // is built the way `results.ts` builds it, from the closed set, because that
  // is the pair that has to hold: this module bounds the validation an operator
  // reads, and the domain bounds the record Core parses.
  const bounded = boundValidation({ status: "failed", expected: "e".repeat(5_000), actual: "a".repeat(5_000) });
  assert.equal(bounded.status === "failed" && bounded.expected.length, VALIDATION_TEXT_MAX_LENGTH);
  const failure = webAutomationFailureRecord(
    WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED,
    bounded.status === "failed" ? { expected: bounded.expected, actual: bounded.actual } : {}
  );
  assert.equal(failure.expected?.length, VALIDATION_TEXT_MAX_LENGTH);
  assert.deepEqual(parseAutomationStudioFailureRecord(failure), failure);
});
