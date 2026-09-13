import assert from "node:assert/strict";
import test from "node:test";
import { parseRunEvaluationJson, type RunManifest } from "@fluxiq-web-extension/test-contracts";
import { flowLaneObservation, recordingLaneObservation } from "../../flow-lane/index.js";
import { singleRunEvaluation, type SingleRunInput } from "../single-run-evaluation.js";

type ActionStatus = NonNullable<RunManifest["actions"]>[number]["status"];
/** Only the fields an evaluation reads; a real run writes a full, validated manifest. */
const manifest = (fields: Partial<RunManifest> = {}): RunManifest => ({ startedAt: "2026-09-12T10:00:00.000Z", finishedAt: "2026-09-12T10:00:42.500Z", automationFailure: null, actions: [], ...fields }) as RunManifest;
const action = (actionType: string, durationMs: number | undefined, status: ActionStatus = "succeeded") => ({ actionType, startedAt: "2026-09-12T10:00:10.000Z", ...(durationMs === undefined ? {} : { durationMs }), status });

const probe = recordingLaneObservation({
  oracleVerdict: "passed", reportedVerdict: "passed", automationFailureReported: null, automationFailureExpected: null,
  actions: [{ actionType: "web.browser.navigate", durationMs: 1_911 }, { actionType: "web.dom.type", durationMs: 1_553 }],
});

const input = (fields: Partial<SingleRunInput> = {}): SingleRunInput => ({
  runId: "run-a", verdict: "passed", failureCategory: undefined, scenarioId: "basic-form",
  workflowId: undefined, variantId: undefined, observation: probe,
  manifest: manifest({ actions: [action("web.browser.navigate", 1_911), action("web.dom.type", 1_553)] }),
  metrics: { steps: 5 }, events: [{ sequence: 17, trigger: "final" }], wallClockMs: 50_000,
  ...fields,
});

test("a single scenario run produces a contract-valid RunEvaluation, with no corpus around it", () => {
  const evaluation = singleRunEvaluation(input());
  // The whole point: one run, judged, without a bench. It must satisfy the
  // same contract `lab bench` writes per corpus row, not merely typecheck.
  assert.deepEqual(parseRunEvaluationJson(JSON.stringify(evaluation)), evaluation);
  assert.deepEqual([evaluation.runId, evaluation.verdict, evaluation.scenarioId], ["run-a", "passed", "basic-form"]);
  // A single run is nobody's replay and has no corpus row selecting a workflow.
  assert.deepEqual([evaluation.repeatIndex, evaluation.workflowId, evaluation.variantId], [0, null, null]);
  assert.deepEqual(evaluation.invariants, [{ id: "runner-verdict", passed: true, expected: "passed", actual: "passed", evidenceSequences: [17] }]);
  assert.equal("failureCategory" in evaluation, false);
  assert.deepEqual(evaluation.metrics, { steps: 5 });
  assert.equal(evaluation.durationMs, 42_500);
  assert.deepEqual(evaluation.llm, { mode: "disabled", profileId: null, calls: 0 });
  assert.deepEqual(evaluation.evidence, { sanitizedPacketBytes: [], rawSnapshotBytes: [], truncationCount: 0 });
});

test("every automation field comes from the lane observation, which until now nothing read", () => {
  const evaluation = singleRunEvaluation(input());
  assert.deepEqual([evaluation.lane, evaluation.flowCreated, evaluation.oracleVerdict, evaluation.reportedVerdict], ["recording", null, "passed", "passed"]);
  assert.equal(evaluation.harnessActivations, 0);
  assert.deepEqual(evaluation.actions, [{ actionType: "web.browser.navigate", durationMs: 1_911 }, { actionType: "web.dom.type", durationMs: 1_553 }]);

  // The oracle is the lane's own, not an inference: a run that failed after
  // the fixture's final state had already held still reports a passing oracle,
  // which is what makes it a false failure rather than an oracle failure.
  const afterOracle = singleRunEvaluation(input({
    verdict: "failed", failureCategory: "runtime.behavior", events: [{ sequence: 17, trigger: "final" }, { sequence: 18, trigger: "error" }],
    observation: recordingLaneObservation({ oracleVerdict: "passed", reportedVerdict: "failed", automationFailureReported: { category: "target_not_found", code: "web.target.not_found" }, automationFailureExpected: null, actions: [] }),
  }));
  assert.deepEqual([afterOracle.oracleVerdict, afterOracle.reportedVerdict], ["passed", "failed"]);
  assert.deepEqual(afterOracle.automationFailureReported, { category: "target_not_found", code: "web.target.not_found" });
  assert.deepEqual(afterOracle.invariants[0]?.evidenceSequences, [18], "a failure closes on the last error event");
  assert.equal(afterOracle.failureCategory, "runtime.behavior");
});

test("a run is scored against the workflow the lane resolved, variant expectations included", () => {
  const evaluation = singleRunEvaluation(input({
    workflowId: "interstitial", variantId: "armed",
    observation: recordingLaneObservation({ oracleVerdict: "passed", reportedVerdict: null, automationFailureReported: null, automationFailureExpected: { category: "user_intervention_required" }, actions: [] }),
  }));
  assert.deepEqual([evaluation.workflowId, evaluation.variantId], ["interstitial", "armed"]);
  assert.deepEqual(evaluation.automationFailureExpected, { category: "user_intervention_required" });
  assert.equal(evaluation.reportedVerdict, null, "FluxIQ executed nothing, so it reported no verdict");
});

test("a Flow-lane run reports the persisted Core run, not the recording lane's probe", () => {
  const observation = flowLaneObservation({
    flowCreated: true, oracleVerdict: "passed", automationFailureExpected: null,
    run: {
      runId: "core-run.1", status: "succeeded", harnessActivations: 2, failure: null, extracted: [],
      actions: [{ actionType: "web.dom.click", status: "succeeded", startedAt: "2026-09-12T10:00:11.000Z", durationMs: 210, failure: null }],
    },
  });
  // The manifest still holds the recording lane's probe action; reading it
  // instead of the observation would be visible here.
  const evaluation = singleRunEvaluation(input({ observation, variantId: "selector-only" }));
  assert.deepEqual([evaluation.lane, evaluation.flowCreated, evaluation.harnessActivations], ["flow", true, 2]);
  assert.deepEqual(evaluation.actions, [{ actionType: "web.dom.click", durationMs: 210 }]);
  assert.equal(evaluation.actions.some((item) => item.actionType === "web.browser.navigate"), false);
});

test("the runner's wall clock covers a run whose manifest has no usable finish time", () => {
  assert.equal(singleRunEvaluation(input({ manifest: undefined })).durationMs, 50_000);
  const unfinished0 = manifest();
  delete (unfinished0 as { finishedAt?: unknown }).finishedAt;
  assert.equal(singleRunEvaluation(input({ manifest: unfinished0 })).durationMs, 50_000);
  const unfinished = singleRunEvaluation(input({ manifest: manifest({ actions: [action("web.dom.click", undefined, "running")] }) }));
  assert.deepEqual(unfinished.actions, [{ actionType: "web.browser.navigate", durationMs: 1_911 }, { actionType: "web.dom.type", durationMs: 1_553 }], "action latency is the lane's, so an unfinished manifest action changes nothing");
});

test("a category the evaluation contract does not carry reads as unknown, never as an automation failure", () => {
  for (const foreign of ["target_not_found", "web.target.not_found", "not-a-category"]) {
    assert.equal(singleRunEvaluation(input({ verdict: "failed", failureCategory: foreign })).failureCategory, "unknown");
  }
});
