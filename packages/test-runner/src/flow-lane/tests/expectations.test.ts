import assert from "node:assert/strict";
import test from "node:test";
import { RunnerFailure } from "../../failure.js";
import { assertFlowActions, assertFlowExtraction, assertFlowFailure } from "../expectations.js";
import type { PersistedFlowAction } from "../persisted-flow-run.js";

const action = (actionType: string, status: PersistedFlowAction["status"]): PersistedFlowAction => ({ actionType, status, startedAt: new Date(0).toISOString(), durationMs: 1, failure: null });

test("every expected action must appear with its expected outcome", () => {
  const actions = [action("web.dom.type", "succeeded"), action("web.dom.click", "succeeded")];
  assertFlowActions([{ action: "web.dom.type" }, { action: "web.dom.click", outcome: "succeeded" }], actions);
  assertFlowActions(undefined, actions);
  assert.throws(
    () => assertFlowActions([{ action: "web.dom.select" }], actions),
    (error: unknown) => error instanceof RunnerFailure && error.category === "action.dispatch",
  );
  assert.throws(() => assertFlowActions([{ action: "web.dom.click", outcome: "failed" }], actions), /outcome failed/);
});

test("an expected failure is matched against Core's structured record, by category and declared code", () => {
  assertFlowFailure({ category: "auth_required" }, { category: "auth_required", code: "web.auth.session_expired", retryable: false });
  assertFlowFailure({ category: "auth_required", code: "session.expired" }, { category: "auth_required", code: "session.expired", retryable: false });
  assert.throws(() => assertFlowFailure({ category: "auth_required" }, null), /reported no structured failure/);
  assert.throws(() => assertFlowFailure({ category: "auth_required" }, { category: "timeout", code: "web.action.timeout", retryable: false }), /expected auth_required/);
  assert.throws(() => assertFlowFailure({ category: "auth_required", code: "session.expired" }, { category: "auth_required", code: "other", retryable: false }), /failure code/);
});

test("a workflow expecting no failure fails on any reported failure, so a differently broken run cannot pass", () => {
  assertFlowFailure(undefined, null);
  assert.throws(
    () => assertFlowFailure(undefined, { category: "target_not_found", code: "web.target.selector_miss", retryable: false }),
    (error: unknown) => error instanceof RunnerFailure && error.category === "runtime.behavior" && /unexpected target_not_found/.test(error.message),
  );
});

test("extraction is compared per extract attempt, in order, so pagination is proven not assumed", () => {
  const page = [{ name: "Alpha" }, { name: "Beta" }];
  assertFlowExtraction([{ step: "read-catalog", count: 2, records: page }], [page]);
  assertFlowExtraction(undefined, []);
  assertFlowExtraction([], [page]);
  assert.throws(() => assertFlowExtraction([{ step: "read-catalog", count: 2 }], []), /expected 1/);
  assert.throws(() => assertFlowExtraction([{ step: "read-catalog", count: 3 }], [page]), /expected 3/);
  assert.throws(() => assertFlowExtraction([{ step: "read-catalog", records: [{ name: "Beta" }, { name: "Alpha" }] }], [page]), /record 0 does not match/);
});
