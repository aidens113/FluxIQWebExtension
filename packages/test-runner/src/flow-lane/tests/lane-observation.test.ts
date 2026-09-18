import assert from "node:assert/strict";
import test from "node:test";
import { assertRunEvaluation, EVALUATION_SCHEMA_VERSION, type RunEvaluation, type RunExtractionMeasurement, type RunHarnessRecovery } from "@fluxiq-web-extension/test-contracts";
import { flowLaneObservation, recordingLaneObservation, recordingLaneProbeObservation, selectLaneObservation, type RunLaneObservation } from "../lane-observation.js";
import type { PersistedFlowRunOutcome } from "../persisted-flow-run.js";

const NO_RECOVERY: RunHarnessRecovery = { attempted: false, interventions: [], runtimePatchAttempts: [], adaptationIds: [], changeProposalIds: [] };

const run = (overrides: Partial<PersistedFlowRunOutcome> = {}): PersistedFlowRunOutcome => ({
  runId: "run.one", status: "succeeded", harnessActivations: 0, harnessRecovery: NO_RECOVERY, failure: null, resultVerification: "confirmed", extracted: [], extractedNonStringValues: 0, extractionDurationsByNode: new Map(), route: null,
  actions: [{ actionType: "web.dom.type", status: "succeeded", startedAt: new Date(0).toISOString(), durationMs: 12, failure: null }],
  ...overrides,
});

/** The observation must satisfy the contract that consumes it, not merely typecheck. */
function evaluationFrom(observation: RunLaneObservation): RunEvaluation {
  return {
    schemaVersion: EVALUATION_SCHEMA_VERSION, runId: "run.one", verdict: "passed", facilityFailure: null, invariants: [], metrics: {},
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

test("the recording lane's probe observation reads FluxIQ's verdict from the actions it ran, and never passes on silence", () => {
  const timing = (status: "succeeded" | "failed", durationMs?: number) => ({ actionType: "web.dom.type", startedAt: new Date(0).toISOString(), status, ...(durationMs === undefined ? {} : { durationMs }) });
  const probe = (actions: ReturnType<typeof timing>[], automationFailure: { category: "target_not_found"; code?: string } | null | undefined, extraction: RunExtractionMeasurement[] | null = null) =>
    recordingLaneProbeObservation({ oracleVerdict: "passed", actions, automationFailure, automationFailureExpected: null, extraction });
  const clean = probe([timing("succeeded", 7), timing("succeeded")], null, []);
  assert.equal(clean.lane, "recording");
  assert.equal(clean.reportedVerdict, "passed");
  assert.deepEqual(clean.actions, [{ actionType: "web.dom.type", durationMs: 7 }], "an action with no duration is not a latency");
  assert.deepEqual(clean.extraction, [], "a lane that ran a script with no extract step measured none");
  assertRunEvaluation(evaluationFrom(clean));
  assert.deepEqual([probe([timing("failed", 1)], { category: "target_not_found", code: "web.target.not_found" }).automationFailureReported, probe([timing("failed", 1)], { category: "target_not_found", code: "web.target.not_found" }).reportedVerdict], [{ category: "target_not_found", code: "web.target.not_found" }, "failed"]);
  assert.deepEqual(probe([timing("failed", 1)], null).automationFailureReported, { category: "ambiguous_or_unknown" });
  // No action, or a failure the lane could not observe, is no verdict at all.
  for (const unknown of [probe([], null), probe([timing("succeeded", 1)], undefined)]) {
    assert.equal(unknown.reportedVerdict, null);
    assert.equal(unknown.automationFailureReported, null);
    assert.equal(unknown.extraction, null, "a lane that ran no script measured nothing");
  }
});

test("a Flow whose result nobody judged reports neither passed nor failed", () => {
  // Measured live on 2026-09-18: a created Flow returned ten rows of which not
  // one was right, every step succeeded, the playback carried no grant so no
  // model was ever asked, and the run read `passed`. Core now says which of
  // those happened, and the lane reports it rather than a pass.
  const unjudged = flowLaneObservation({ flowCreated: true, oracleVerdict: "failed", run: run({ resultVerification: "unverified" }), automationFailureExpected: null });
  assert.equal(unjudged.reportedVerdict, "unverified");
  assert.equal(unjudged.automationFailureReported, null, "nobody judged the result, so there is no failure to categorize");
  assertRunEvaluation(evaluationFrom(unjudged));

  // A Flow that stored no record set had nothing to judge; its steps are the
  // whole account, and calling that unverified would report a missing
  // judgement of a thing there was nothing to judge.
  assert.equal(flowLaneObservation({ flowCreated: true, oracleVerdict: "passed", run: run({ resultVerification: "no_result" }), automationFailureExpected: null }).reportedVerdict, "passed");
  // A Core that records nothing at all is not Core saying nobody judged it.
  assert.equal(flowLaneObservation({ flowCreated: true, oracleVerdict: "passed", run: run({ resultVerification: null }), automationFailureExpected: null }).reportedVerdict, "passed");
  // Core fails the session it refutes, so this is belt and braces.
  const refuted = flowLaneObservation({ flowCreated: true, oracleVerdict: "failed", run: run({ resultVerification: "refuted" }), automationFailureExpected: null });
  assert.equal(refuted.reportedVerdict, "failed");
  assert.deepEqual(refuted.automationFailureReported, { category: "ambiguous_or_unknown" });
  assertRunEvaluation(evaluationFrom(refuted));
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

/**
 * `null` is unmeasured and `attempted: false` is measured with nothing to
 * recover, as with extraction: a run that recovered nothing says so, and only
 * a run that never happened, or a lane that runs no Flow, says nothing.
 */
test("the run's recovery record travels on the observation; no recovery is stated, and a run that never happened states none", () => {
  const recovered: RunHarnessRecovery = {
    attempted: true,
    interventions: [{ kind: "diagnosis", validationOk: true, validationCodes: [] }, { kind: "runtime_patch", validationOk: true, validationCodes: [] }],
    runtimePatchAttempts: [{ kind: "temporary_wait_retry", proposalOnly: false, executed: true, preflightOk: true, issueCodes: [], adaptationCreated: true, changeProposalCreated: false }],
    adaptationIds: ["adaptation.run.one.temporary_wait_retry.1700"],
    changeProposalIds: [],
  };
  const adapted = flowLaneObservation({ flowCreated: true, oracleVerdict: "passed", run: run({ harnessActivations: 2, harnessRecovery: recovered }), automationFailureExpected: null });
  assert.deepEqual(adapted.harnessRecovery, recovered);
  assertRunEvaluation(evaluationFrom(adapted));

  const quiet = flowLaneObservation({ flowCreated: true, oracleVerdict: "passed", run: run(), automationFailureExpected: null });
  assert.deepEqual(quiet.harnessRecovery, NO_RECOVERY);
  assert.equal(quiet.reportedVerdict, "passed", "a run that needed no recovery is not a failed one");
  assertRunEvaluation(evaluationFrom(quiet));

  assert.equal(flowLaneObservation({ flowCreated: false, oracleVerdict: null, run: run({ harnessRecovery: recovered }), automationFailureExpected: null }).harnessRecovery, null);
  const recording = recordingLaneObservation({ oracleVerdict: "passed", reportedVerdict: "passed", automationFailureReported: null, automationFailureExpected: null, actions: [] });
  assert.equal(recording.harnessRecovery, null);
  // The contract refuses a recovery record on a run where no Flow ran.
  assert.throws(() => assertRunEvaluation(evaluationFrom({ ...recording, harnessRecovery: NO_RECOVERY })), /\$\.harnessRecovery/u);
});

/**
 * The lane's own per-step measurements are what the bench's extraction numbers
 * are pooled from, so they travel on the observation rather than being
 * re-derived from the bundle. `null` is unmeasured and `[]` is measured with no
 * extraction step: a run that never created a Flow measured nothing, and
 * publishing `[]` for it would state that its extraction was fine.
 */
test("the Flow lane's extraction measurements travel on the observation, and a run that created no Flow measures none", () => {
  const measurement: RunExtractionMeasurement = {
    stepIndex: 1, status: "judged", expectedRecords: 2, observedRecords: 2, recordsListed: true, countStated: false,
    comparedRecords: 2, matchedRecords: 2, expectedFields: 2, presentFields: 2, unexpectedFields: 0,
    matchedInAnyOrder: 2, unjudged: ["pages"], expectedPages: 3, pagesFollowed: null, truncated: null, durationMs: 40, nonStringValues: 0,
  };
  const judged = flowLaneObservation({ flowCreated: true, oracleVerdict: "passed", run: run(), automationFailureExpected: null, extraction: [measurement] });
  assert.deepEqual(judged.extraction, [measurement]);
  assertRunEvaluation(evaluationFrom(judged));

  assert.deepEqual(flowLaneObservation({ flowCreated: true, oracleVerdict: "passed", run: run(), automationFailureExpected: null, extraction: [] }).extraction, []);
  assert.equal(flowLaneObservation({ flowCreated: true, oracleVerdict: "passed", run: run(), automationFailureExpected: null }).extraction, null);
  assert.equal(flowLaneObservation({ flowCreated: false, oracleVerdict: null, run: run(), automationFailureExpected: null, extraction: [measurement] }).extraction, null);
  // The recording lane asserts each extract step as it runs and keeps no measurement, so it states unmeasured.
  assert.equal(recordingLaneObservation({ oracleVerdict: "passed", reportedVerdict: "passed", automationFailureReported: null, automationFailureExpected: null, actions: [] }).extraction, null);
});

/**
 * `selectLaneObservation` is what `run-scenario.ts` publishes as the run's
 * observation. A Flow-lane run whose lane never published used to be filed
 * under the recording lane's observation, `lane: "recording"`, so neither the
 * run's own `evaluation.json` nor a corpus reading of it could see that the
 * Flow was never created.
 */
const recordingFallback = (): RunLaneObservation => recordingLaneObservation({ oracleVerdict: "passed", reportedVerdict: "passed", automationFailureReported: null, automationFailureExpected: null, actions: [{ actionType: "web.browser.navigate", durationMs: 3 }] });

test("a Flow-lane run whose lane never published is a Flow run that created no Flow, never a recording-lane run", () => {
  let recordingLaneBuilt = false;
  const expected = { category: "target_ambiguous" as const, code: "web.target.ambiguous" };
  const observation = selectLaneObservation({
    evaluated: true, flowLane: true, published: undefined, automationFailureExpected: expected,
    recordingLane: () => { recordingLaneBuilt = true; return recordingFallback(); },
  });
  assert.equal(observation?.lane, "flow");
  assert.equal(observation?.flowCreated, false);
  assert.equal(observation?.oracleVerdict, null, "the recording lane's oracle judged the recording, not a Flow");
  assert.equal(observation?.reportedVerdict, null);
  assert.equal(observation?.automationFailureReported, null);
  assert.deepEqual(observation?.automationFailureExpected, expected);
  assert.deepEqual(observation?.actions, []);
  assert.equal(recordingLaneBuilt, false);
  assertRunEvaluation(evaluationFrom(observation!));
});

test("what the Flow lane published is the observation, whatever happened after it", () => {
  const published = flowLaneObservation({ flowCreated: true, oracleVerdict: "failed", run: run({ status: "failed", failure: { category: "target_not_found", code: "web.target.not_found", retryable: true } }), automationFailureExpected: { category: "target_ambiguous" } });
  assert.equal(selectLaneObservation({ evaluated: true, flowLane: true, published, automationFailureExpected: null, recordingLane: recordingFallback }), published);
});

test("a recording-lane run publishes the recording lane's observation, and an unevaluated target publishes none", () => {
  const recording = selectLaneObservation({ evaluated: true, flowLane: false, published: undefined, automationFailureExpected: null, recordingLane: recordingFallback });
  assert.equal(recording?.lane, "recording");
  assert.deepEqual(recording?.actions, [{ actionType: "web.browser.navigate", durationMs: 3 }]);
  assert.equal(selectLaneObservation({ evaluated: false, flowLane: false, published: undefined, automationFailureExpected: null, recordingLane: recordingFallback }), undefined);
  assert.equal(selectLaneObservation({ evaluated: false, flowLane: true, published: undefined, automationFailureExpected: null, recordingLane: recordingFallback }), undefined);
});
