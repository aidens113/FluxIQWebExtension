import assert from "node:assert/strict";
import test from "node:test";
import type { AutomationStudioFailureRecord } from "fluxiq/automation-studio";
import { WEB_AUTOMATION_FAILURE_CODES as C, webAutomationFailureRecord } from "../../failure";
import { readWebHostFailure, webHostFailure, webHostThrownFailure, webHostAttemptFailure } from "..";

const original: AutomationStudioFailureRecord = {
  category: "action_failed", code: C.RATE_LIMITED, retryable: true,
  stage: "confirmation", effect: "ambiguous", retryAfterMs: 12,
  expected: "private expectation", actual: "private comparison", evidenceDigest: "a".repeat(64)
};

test("host annotates only explicit temporary causes while preserving original controls and private comparisons", () => {
  const result = webHostFailure(original);
  assert.deepEqual(result, { ...original, transient: true });
  assert.notEqual(result, original);
  assert.equal(original.transient, undefined);
  for (const code of [C.RATE_LIMITED, C.TRANSPORT_TRANSIENT]) {
    assert.equal(webHostFailure(webAutomationFailureRecord(code))?.transient, true);
    assert.equal(webAutomationFailureRecord(code).transient, undefined, "shared browser constructor stays unchanged");
  }
  for (const code of [C.TIMEOUT, C.ACTION_FAILED, C.NO_EFFECT, C.TARGET_NOT_ACTIONABLE, C.TARGET_NOT_SHOWN, C.REFUSED_BY_PAGE]) {
    assert.equal(webHostFailure(webAutomationFailureRecord(code, { actual: "busy retry later loading timeout" }))?.transient, undefined, code);
  }
});

test("valid original authority and unknown code survive, while invalid annotation retains the original", () => {
  for (const category of ["blocked_by_capability_or_policy", "auth_required", "user_intervention_required", "graph_validation_or_unknown_node"] as const) {
    const authoritative = { category, code: C.RATE_LIMITED, retryable: false, effect: "ambiguous" as const };
    assert.deepEqual(webHostFailure(authoritative), authoritative);
  }
  const unknown = { ...original, code: "client.future_failure", retryable: false, retryAfterMs: undefined };
  assert.deepEqual(webHostFailure(unknown), readWebHostFailure(unknown));
  assert.equal(webHostFailure({ ...original, transient: false }), undefined);
  const thrown = Object.assign(new Error("private throw"), { failure: original });
  assert.deepEqual(webHostThrownFailure(thrown), webHostFailure(original));
  assert.equal(webHostThrownFailure(Object.defineProperty({}, "failure", { get: () => { throw new Error("getter ran"); } })), undefined);
});

test("transient unacted control requires every dispatched attempt proven unacted", () => {
  const unacted = { status: "failed", failure: webAutomationFailureRecord(C.RATE_LIMITED) };
  assert.equal(webHostAttemptFailure([unacted, unacted], unacted, undefined)?.transient, true);
  const ambiguous = { status: "failed", failure: original };
  const preannotated = { status: "failed", failure: { ...unacted.failure, transient: true as const } };
  assert.equal(webHostAttemptFailure([ambiguous, preannotated], preannotated, undefined)?.effect, "ambiguous");
  assert.equal(preannotated.failure.effect, "unacted");
  assert.equal(webHostAttemptFailure([ambiguous, unacted], unacted, undefined)?.effect, "ambiguous");
  for (const previous of [{ status: "unknown" }, { status: "succeeded" }, { status: "failed" }, { status: "failed", failure: { code: C.RATE_LIMITED } }]) {
    assert.equal(webHostAttemptFailure([previous, unacted], unacted, undefined), undefined);
  }
  assert.equal(webHostAttemptFailure([unacted], unacted, "landed"), undefined);
  assert.equal(webHostAttemptFailure([unacted], unacted, "uncertain"), undefined);
  const policy = { status: "failed", failure: { category: "blocked_by_capability_or_policy", code: C.TARGET_NOT_ACTIONABLE, retryable: false } };
  assert.deepEqual(webHostAttemptFailure([policy, unacted], unacted, undefined), policy.failure);
});

test("an unreadable thrown descriptor remains an ambiguous nonretryable failure", () => {
  const unreadable = new Proxy(new Error("private original throw"), {
    getOwnPropertyDescriptor() { throw new Error("private descriptor failure"); }
  });
  const failure = webHostThrownFailure(unreadable);
  assert.deepEqual(failure, {
    category: "ambiguous_or_unknown", code: C.UNKNOWN, retryable: false, stage: "execution", effect: "ambiguous"
  });
  assert.equal(failure?.transient, undefined);
  assert.doesNotMatch(JSON.stringify(failure), /private/u);
});
