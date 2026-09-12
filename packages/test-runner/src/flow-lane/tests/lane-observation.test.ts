import assert from "node:assert/strict";
import test from "node:test";
import { assertRunEvaluation, EVALUATION_SCHEMA_VERSION, type RunEvaluation } from "@fluxiq-web-extension/test-contracts";
import { flowLaneObservation, recordingLaneObservation, type RunLaneObservation } from "../lane-observation.js";
import type { PersistedFlowRunOutcome } from "../persisted-flow-run.js";

const run = (overrides: Partial<PersistedFlowRunOutcome> = {}): PersistedFlowRunOutcome => ({
  runId: "run.one", status: "succeeded", harnessActivations: 0, failure: null, extracted: [],
  actions: [{ actionType: "web.dom.type", status: "succeeded", startedAt: new Date(0).toISOString(), durationMs: 12, failure: null }],
  ...overrides,
});

/** The observation must satisfy the contract that consumes it, not merely typecheck. */
function evaluationFrom(observation: RunLaneObservation): RunEvaluation {
  return {
    schemaVersion: EVALUATION_SCHEMA_VERSION, runId: "run.one", verdict: "passed", invariants: [], metrics: {},
    scenarioId: "auth-gate", workflowId: null, variantId: null, repeatIndex: 0, durationMs: 10,
    evidence: { sanitizedPacketBytes: [], rawSnapshotBytes: [], truncationCount: 0 },
    llm: { mode: "disabled", profileId: null, calls: 0 },
    harnessRecovery: null, adaptationCost: null, adaptationValidation: null, adaptationPersistence: null, adaptationReuse: null,
    ...observation,
  };
}

test("the recording lane creates no Flow and runs no harness", () => {
  const observation = recordingLaneObservation({ oracleVerdict: "passed", reportedVerdict: "passed", automationFailureReported: null, automationFailureExpected: null, actions: [{ actionType: "web.dom.type", durationMs: 12 }] });
  assert.equal(observation.lane, "recording");
  assert.equal(observation.flowCreated, null);
  assert.equal(observation.harnessActivations, 0);
  assertRunEvaluation(evaluationFrom(observation));
});

test("a Flow that ran clean reports passed with no failure", () => {
  const observation = flowLaneObservation({ flowCreated: true, oracleVerdict: "passed", run: run(), automationFailureExpected: null });
  assert.equal(observation.lane, "flow");
  assert.equal(observation.flowCreated, true);
  assert.equal(observation.reportedVerdict, "passed");
  assert.equal(observation.automationFailureReported, null);
  assert.deepEqual(observation.actions, [{ actionType: "web.dom.type", durationMs: 12 }]);
  assertRunEvaluation(evaluationFrom(observation));
});

test("a failed Flow carries Core's structured category, and an uncategorised one is ambiguous_or_unknown", () => {
  const structured = flowLaneObservation({
    flowCreated: true, oracleVerdict: "passed", automationFailureExpected: { category: "auth_required" },
    run: run({ status: "failed", failure: { category: "auth_required", code: "web.auth.session_expired", retryable: false }, actions: [{ actionType: "web.dom.click", status: "failed", startedAt: new Date(0).toISOString(), durationMs: 5, failure: { category: "auth_required", code: "web.auth.session_expired", retryable: false } }] }),
  });
  assert.equal(structured.reportedVerdict, "failed");
  // The producer-owned code travels with the category; only an absent record falls back to a bare one.
  assert.deepEqual(structured.automationFailureReported, { category: "auth_required", code: "web.auth.session_expired" });
  assertRunEvaluation(evaluationFrom(structured));

  const uncategorised = flowLaneObservation({ flowCreated: true, oracleVerdict: "failed", automationFailureExpected: null, run: run({ status: "failed" }) });
  assert.deepEqual(uncategorised.automationFailureReported, { category: "ambiguous_or_unknown" });
});

test("no Flow was created, so FluxIQ reported no verdict", () => {
  const observation = flowLaneObservation({ flowCreated: false, oracleVerdict: null, run: run(), automationFailureExpected: null });
  assert.equal(observation.flowCreated, false);
  assert.equal(observation.reportedVerdict, null);
  assert.equal(observation.automationFailureReported, null);
  assert.equal(observation.harnessActivations, 0);
  assertRunEvaluation(evaluationFrom(observation));
});

test("harness activations come from Core's run detail", () => {
  assert.equal(flowLaneObservation({ flowCreated: true, oracleVerdict: "passed", run: run({ harnessActivations: 2 }), automationFailureExpected: null }).harnessActivations, 2);
});
