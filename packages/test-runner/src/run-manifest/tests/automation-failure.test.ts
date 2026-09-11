import assert from "node:assert/strict";
import test from "node:test";
import { parseAutomationStudioFailureRecord } from "@fluxiq-web-extension/test-contracts";
import { automationFailureFromActionResult } from "../automation-failure.js";

// The record the extension reports for an action type it does not implement.
const rejection = { category: "blocked_by_capability_or_policy", code: "web.action.unsupported_type", retryable: false, stage: "dispatch" };

test("a succeeded action reports no automation failure", () => {
  assert.equal(automationFailureFromActionResult({ status: "succeeded", commandId: "c1" }), null);
});

test("a failure record Core's parser accepts is taken whole, category and code", () => {
  const targetMissing = { category: "target_not_found", code: "web.dom.target_missing", retryable: true, stage: "target_resolution" };
  assert.deepEqual(parseAutomationStudioFailureRecord(targetMissing), targetMissing, "Core keeps the record");
  assert.deepEqual(automationFailureFromActionResult({ status: "failed", failure: targetMissing }), { category: "target_not_found", code: "web.dom.target_missing" });
  assert.deepEqual(parseAutomationStudioFailureRecord(rejection), rejection, "Core keeps the rejection record the extension sends");
  assert.deepEqual(automationFailureFromActionResult({ status: "failed", failure: rejection }), { category: "blocked_by_capability_or_policy", code: "web.action.unsupported_type" });
});

test("a record Core's parser refuses falls back to the looser fields", () => {
  // auth_required can never be retryable, so Core drops this record whole rather than repairing it.
  const contradictory = { category: "auth_required", code: "session_expired", retryable: true };
  assert.equal(parseAutomationStudioFailureRecord(contradictory), null);
  assert.deepEqual(automationFailureFromActionResult({ status: "failed", failure: contradictory }), { category: "auth_required", code: "session_expired" });
});

test("without a record, the category is read from the looser fields", () => {
  assert.deepEqual(automationFailureFromActionResult({ status: "failed", failureCategory: "expected_state_missing" }), { category: "expected_state_missing" });
  assert.deepEqual(automationFailureFromActionResult({ status: "failed", error: { category: "auth_required", code: "session_expired" } }), { category: "auth_required", code: "session_expired" });
});

test("without a category, a timeout is timeout and anything else ambiguous_or_unknown", () => {
  assert.deepEqual(automationFailureFromActionResult({ status: "timed_out" }), { category: "timeout" });
  assert.deepEqual(automationFailureFromActionResult({ status: "failed", errorCode: "E_WIDGET" }), { category: "ambiguous_or_unknown", code: "E_WIDGET" });
  assert.deepEqual(automationFailureFromActionResult(undefined), { category: "ambiguous_or_unknown" });
});

test("free-text messages and unknown category names never reach the manifest", () => {
  assert.deepEqual(automationFailureFromActionResult({ status: "failed", error: "Element #secret-field was not found", category: "not-a-category" }), { category: "ambiguous_or_unknown" });
});
