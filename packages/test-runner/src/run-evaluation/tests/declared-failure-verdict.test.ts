import assert from "node:assert/strict";
import test from "node:test";
import { parseRunEvaluationJson, type ExpectedFailure, type RunEvaluation } from "@fluxiq-web-extension/test-contracts";
import type { RunLaneObservation } from "../../flow-lane/index.js";
import { evaluateObservedRun, type ObservedRun } from "../observed-run-evaluation.js";

/** `member-directory`'s `member-left`: the row the click was recorded against has gone, and 239 identical buttons remain. */
const DECLARED: ExpectedFailure = { category: "target_not_found", code: "web.target.not_found" };
const REPORTED: RunEvaluation["automationFailureReported"] = { category: "target_not_found", code: "web.target.not_found" };

const identity = (expectedFailure: ExpectedFailure | null): ObservedRun["identity"] => ({
  scenarioId: "member-directory", workflowId: null, variantId: expectedFailure === null ? null : "member-left", repeatIndex: 0, expectedFailure,
});

/** The run as the runner judged it: `assertFlowActions` failed the inherited `{ web.dom.click, succeeded }`. */
const refusedOutcome: ObservedRun["outcome"] = {
  runId: "run-a", verdict: "failed", failureCategory: "action.dispatch",
  invariants: [{ id: "runner-verdict", passed: false, expected: "passed", actual: "failed: action.dispatch", evidenceSequences: [19] }],
  metrics: { steps: 7 }, durationMs: 158_857,
};
const passedOutcome: ObservedRun["outcome"] = {
  runId: "run-a", verdict: "passed",
  invariants: [{ id: "runner-verdict", passed: true, expected: "passed", actual: "passed", evidenceSequences: [17] }],
  metrics: { steps: 7 }, durationMs: 40_000,
};

const flowLane = (fields: Partial<RunLaneObservation> = {}): RunLaneObservation => ({
  lane: "flow", flowCreated: true, oracleVerdict: "passed", reportedVerdict: "failed",
  automationFailureReported: REPORTED, automationFailureExpected: DECLARED,
  harnessActivations: 0, actions: [{ actionType: "web.dom.click", durationMs: 120 }], extraction: null, ...fields,
});

const evaluate = (expected: ExpectedFailure | null, outcome: ObservedRun["outcome"], observation: RunLaneObservation, facilityFailure: RunEvaluation["facilityFailure"] = null): RunEvaluation =>
  evaluateObservedRun({ identity: identity(expected), facilityFailure, outcome, observation });

// run-mu5vfd6o-d98abd77: the wrong-row fix made the refusal correct, and the
// run record, the campaign summary and the dashboard all still read `failed`.
test("a variant that declares a failure passes by reporting exactly that failure, whatever the runner made of it", () => {
  const evaluation = evaluate(DECLARED, refusedOutcome, flowLane());
  assert.equal(evaluation.verdict, "passed");
  assert.equal("failureCategory" in evaluation, false);
  // The judgement invariant says which rule judged the run, keeps its id, and
  // keeps the runner's own category -- the only record of why it had failed.
  assert.deepEqual(evaluation.invariants, [{
    id: "runner-verdict", passed: true,
    expected: "the declared failure target_not_found/web.target.not_found",
    actual: "reported target_not_found/web.target.not_found; the runner failed the run: action.dispatch",
    evidenceSequences: [19],
  }]);
  // A passed evaluation with a failed invariant, or with a category, is refused by the contract.
  assert.deepEqual(parseRunEvaluationJson(JSON.stringify(evaluation)), evaluation);
});

test("a declaration with no code is met by the category alone, and a declared code must match", () => {
  const categoryOnly = evaluate({ category: "target_not_found" }, refusedOutcome, flowLane());
  assert.equal(categoryOnly.verdict, "passed");
  assert.equal(categoryOnly.invariants[0]?.expected, "the declared failure target_not_found");

  const otherCode = evaluate(DECLARED, refusedOutcome, flowLane({ automationFailureReported: { category: "target_not_found", code: "web.target.detached" } }));
  assert.deepEqual([otherCode.verdict, otherCode.failureCategory], ["failed", "action.dispatch"]);
  assert.equal(otherCode.invariants[0]?.actual, "reported target_not_found/web.target.detached; the runner failed the run: action.dispatch");
});

test("a run that fails differently from the failure it declares still fails", () => {
  const different = evaluate(DECLARED, refusedOutcome, flowLane({ automationFailureReported: { category: "timeout", code: "web.action.timeout" } }));
  assert.deepEqual([different.verdict, different.failureCategory], ["failed", "action.dispatch"]);
  assert.equal(different.invariants[0]?.passed, false);
  assert.deepEqual(parseRunEvaluationJson(JSON.stringify(different)), different);
});

test("a run that reports no failure at all, and one that succeeds, both fail a declared failure", () => {
  const silent = evaluate(DECLARED, refusedOutcome, flowLane({ automationFailureReported: null, reportedVerdict: null }));
  assert.deepEqual([silent.verdict, silent.failureCategory], ["failed", "action.dispatch"]);
  assert.equal(silent.invariants[0]?.actual, "reported no failure; the runner failed the run: action.dispatch");

  // The runner passed a run the scenario says must refuse: it has no category
  // of its own, and FluxIQ behaving other than declared is `runtime.behavior`.
  const succeeded = evaluate(DECLARED, passedOutcome, flowLane({ reportedVerdict: "passed", automationFailureReported: null }));
  assert.deepEqual([succeeded.verdict, succeeded.failureCategory], ["failed", "runtime.behavior"]);
  assert.deepEqual(succeeded.invariants, [{
    id: "runner-verdict", passed: false,
    expected: "the declared failure target_not_found/web.target.not_found",
    actual: "reported no failure", evidenceSequences: [17],
  }]);
  assert.deepEqual(parseRunEvaluationJson(JSON.stringify(succeeded)), succeeded);
});

// The point of `member-left`: nothing may be pressed on another member. A run
// that refuses correctly and mutates the page anyway must not pass.
test("a failed oracle is never overridden by the declaration", () => {
  const mutated = evaluate(DECLARED, refusedOutcome, flowLane({ oracleVerdict: "failed" }));
  assert.deepEqual([mutated.verdict, mutated.failureCategory], ["failed", "action.dispatch"]);
  assert.equal(mutated.invariants[0]?.actual, "reported target_not_found/web.target.not_found; the declared final state does not hold; the runner failed the run: action.dispatch");

  // An oracle that was never consulted is not a failing one.
  const unconsulted = evaluate(DECLARED, refusedOutcome, flowLane({ oracleVerdict: null }));
  assert.equal(unconsulted.verdict, "passed");
});

test("the declaration answers for an action that did not succeed, and for nothing else the run broke on", () => {
  for (const failureCategory of ["runtime.behavior", "security.redaction", "recording.contract", "environment.missing"] as const) {
    const evaluation = evaluate(DECLARED, { ...refusedOutcome, failureCategory }, flowLane());
    assert.deepEqual([evaluation.verdict, evaluation.failureCategory], ["failed", failureCategory], `${failureCategory} is not an action outcome`);
    // Untouched, not restated: the runner's verdict is still what judged it.
    assert.equal(evaluation.invariants[0]?.expected, "passed");
  }
  const targeting = evaluate(DECLARED, { ...refusedOutcome, failureCategory: "action.targeting" }, flowLane());
  assert.equal(targeting.verdict, "passed");
});

// A facility failure may carry no automation result at all (the contract
// refuses the pair), so the declaration has nothing to judge: the run says
// nothing about the refusal, and the runner's verdict stands as it was.
test("a run the facility broke says nothing about the refusal either way", () => {
  const facilityFailure = { boundary: "finalized-bundle", stage: "scenario.execute", reason: "http.timeout", operationStage: "control.request", timeoutMs: 30_000 } as const;
  const observation = flowLane({ flowCreated: false, oracleVerdict: null, reportedVerdict: null, automationFailureReported: null, actions: [] });
  const broken = evaluate(DECLARED, { ...refusedOutcome, failureCategory: "environment.missing" }, observation, facilityFailure);
  assert.deepEqual([broken.verdict, broken.failureCategory], ["failed", "environment.missing"]);
  assert.equal(broken.invariants[0]?.expected, "passed");
  assert.deepEqual(parseRunEvaluationJson(JSON.stringify(broken)), broken);

  // The same run without the diagnostic is judged by the declaration, which it fails: it reported no failure.
  const judged = evaluate(DECLARED, { ...refusedOutcome, failureCategory: "action.dispatch" }, observation);
  assert.equal(judged.invariants[0]?.expected, "the declared failure target_not_found/web.target.not_found");
  assert.deepEqual([judged.verdict, judged.failureCategory], ["failed", "action.dispatch"]);
});

test("an ordinary scenario, which declares no failure, is judged exactly as before", () => {
  const positive = flowLane({ reportedVerdict: "passed", automationFailureReported: null, automationFailureExpected: null });
  const passed = evaluate(null, passedOutcome, positive);
  assert.deepEqual([passed.verdict, "failureCategory" in passed], ["passed", false]);
  assert.deepEqual(passed.invariants, passedOutcome.invariants);

  // Including one that failed on an action: with nothing declared, a failed
  // action is still a failed run and the runner's verdict still judges it.
  const failed = evaluate(null, refusedOutcome, flowLane({ automationFailureExpected: null }));
  assert.deepEqual([failed.verdict, failed.failureCategory], ["failed", "action.dispatch"]);
  assert.deepEqual(failed.invariants, refusedOutcome.invariants);
});
