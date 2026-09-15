import assert from "node:assert/strict";
import test from "node:test";
import { RunnerFailure } from "../../failure.js";
import { assertFlowActions, assertFlowExtraction, assertFlowFailure, flowExtractionExpectation } from "../expectations.js";
import type { PersistedFlowAction } from "../persisted-flow-run.js";

const action = (actionType: string, status: PersistedFlowAction["status"]): PersistedFlowAction => ({ actionType, status, startedAt: new Date(0).toISOString(), durationMs: 1, failure: null });

/** Approved Flows' node output ids, as `flowActionTypes` maps them: one that can extract, and one that cannot. */
const extractingFlow = new Map([["node.open", "web.dom.click"], ["node.extract", "web.dom.extract_list"]]);
const clickOnlyFlow = new Map([["node.open", "web.dom.click"]]);

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

/**
 * Lab Stage 2's W15 `popup-blocked` and W26 `no-context`: each negative variant
 * pins `{ action: "web.dom.click" }` with no outcome, Core failed the click with
 * the variant's expected failure, and a missing outcome read as `succeeded`
 * failed both rows.
 */
test("an expected action with no outcome is judged on its presence only, never as succeeded", () => {
  const failedClick = [action("web.dom.type", "succeeded"), action("web.dom.click", "failed")];
  assertFlowActions([{ action: "web.dom.click" }], failedClick);
  // A declared outcome is still judged.
  assert.throws(() => assertFlowActions([{ action: "web.dom.click", outcome: "succeeded" }], failedClick), /with outcome succeeded; it produced web\.dom\.type:succeeded, web\.dom\.click:failed$/);
  // Absence still fails, and neither the message nor the details claim an outcome the entry did not declare.
  assert.throws(
    () => assertFlowActions([{ action: "web.dom.click" }], [action("web.dom.type", "succeeded")]),
    (error: unknown) => error instanceof RunnerFailure && error.category === "action.dispatch"
      && error.message === "The Flow did not produce a web.dom.click action; it produced web.dom.type:succeeded"
      && error.details !== undefined && !("expectedOutcome" in error.details),
  );
  assert.throws(() => assertFlowActions([{ action: "web.dom.click" }], []), /action; it produced no attempts$/);
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
  assertFlowExtraction([{ step: "read-catalog", count: 2, records: page }], [page], extractingFlow, 0);
  assertFlowExtraction(undefined, [], extractingFlow, 0);
  assertFlowExtraction([], [page], extractingFlow, 0);
  assert.throws(() => assertFlowExtraction([{ step: "read-catalog", count: 2 }], [], extractingFlow, 0), /expected 1/);
  assert.throws(() => assertFlowExtraction([{ step: "read-catalog", count: 3 }], [page], extractingFlow, 0), /expected 3/);
  assert.throws(() => assertFlowExtraction([{ step: "read-catalog", records: [{ name: "Beta" }, { name: "Alpha" }] }], [page], extractingFlow, 0), /record 0 does not match/);
});

/** X0.7: a value the Flow's reader leaves out of a record can make that record match, so the count is judged before the records. */
test("a judged extraction whose attempts carried a value that is not a string fails as that, even when the records match", () => {
  const page = [{ name: "Alpha" }, { name: "Beta" }];
  assert.throws(() => assertFlowExtraction([{ step: "read-catalog", count: 2, records: page }], [page], extractingFlow, 1), (error: unknown) => {
    assert.ok(error instanceof RunnerFailure);
    assert.equal(error.category, "runtime.behavior");
    assert.equal(error.message, "The Flow's extract attempts carried 1 field value(s) that are not strings");
    assert.deepEqual(error.details, { nonStringValues: 1 });
    return true;
  });
  // An extraction that is not judged is not failed on the count either.
  assertFlowExtraction([{ step: "read-catalog", count: 2, records: page }], [page], clickOnlyFlow, 1);
});

/**
 * Lab Stage 2: a recording's `extract` step is the runner's own check, not a
 * user action, so W18's and W09's generated Flows held no extract node, and
 * every Flow-lane run failed with `0 extraction result(s), expected 1`.
 */
test("a Flow with no extract node is not judged on the workflow's extraction, and the expectation is named as not applying", () => {
  const expected = [{ step: "read-account", count: 1 }];
  assert.equal(flowExtractionExpectation(expected, clickOnlyFlow), "not_applicable");
  assertFlowExtraction(expected, [], clickOnlyFlow, 0);
  // Either extract output makes the expectation apply, and it is then judged.
  assert.equal(flowExtractionExpectation(expected, extractingFlow), "judged");
  assert.equal(flowExtractionExpectation(expected, new Map([["node.extract", "web.dom.extract"]])), "judged");
  assert.throws(() => assertFlowExtraction(expected, [], new Map([["node.extract", "web.dom.extract"]]), 0), /produced 0 extraction result\(s\), expected 1/);
  // A workflow that declares no extraction has nothing to apply, whatever the Flow holds.
  assert.equal(flowExtractionExpectation(undefined, extractingFlow), "not_expected");
  assert.equal(flowExtractionExpectation([], clickOnlyFlow), "not_expected");
});
