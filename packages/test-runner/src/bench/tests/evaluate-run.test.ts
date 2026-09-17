import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import type { RunManifest } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../../failure.js";
import type { RunLaneObservation } from "../../flow-lane/index.js";
import { evaluateFailedAttempt, evaluateFlowRun, evaluateRecordingRun, type FlowRunInput, type RecordingRunInput } from "../evaluate-run.js";

type ActionStatus = NonNullable<RunManifest["actions"]>[number]["status"];
const identity = { scenarioId: "basic-form", workflowId: null, variantId: null, repeatIndex: 0, expectedFailure: null };
// Only the fields an evaluation reads; the bench reads real manifests through parseRunManifestJson.
const manifest = (fields: Partial<RunManifest> = {}): RunManifest => ({ startedAt: "2026-09-11T10:00:00.000Z", finishedAt: "2026-09-11T10:00:42.500Z", automationFailure: null, actions: [], ...fields }) as RunManifest;
const action = (actionType: string, durationMs: number | undefined, status: ActionStatus = "succeeded") => ({ actionType, startedAt: "2026-09-11T10:00:10.000Z", ...(durationMs === undefined ? {} : { durationMs }), status });
const input = (fields: Partial<RecordingRunInput> = {}): RecordingRunInput => ({ ...identity, result: { runId: "run-a", verdict: "passed" }, facilityFailure: null, manifest: manifest(), metrics: { steps: 5 }, finalSequence: 17, errorSequence: undefined, wallClockMs: 50_000, ...fields });
/** A bundle directory that does not exist, so a Flow-lane evaluation that reads it finds no snapshot. */
const NO_BUNDLE = path.join(tmpdir(), `fluxbench-no-bundle-${process.pid}-${Date.now()}`);
/** The manifest holds the recording lane's probe action, so a Flow-lane evaluation reading it instead of the observation would be visible. */
const flowInput = (fields: Partial<FlowRunInput> = {}): FlowRunInput => ({ ...input(), result: { runId: "run-a", verdict: "passed", path: NO_BUNDLE }, manifest: manifest({ actions: [action("web.browser.navigate", 1_911)] }), ...fields });
const createdFlow: RunLaneObservation = {
  lane: "flow", flowCreated: true, oracleVerdict: "passed", reportedVerdict: "passed",
  automationFailureReported: null, automationFailureExpected: null, harnessActivations: 0, actions: [{ actionType: "web.dom.click", durationMs: 120 }], extraction: null,
};

/** A finalized bundle holding only `snapshots/flow-lane.json`: `snapshot` as written by `flowLaneSnapshot`, or raw text. */
function bundleWith(t: TestContext, snapshot: unknown): string {
  const directory = mkdtempSync(path.join(tmpdir(), "fluxbench-evidence-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  mkdirSync(path.join(directory, "snapshots"));
  writeFileSync(path.join(directory, "snapshots", "flow-lane.json"), typeof snapshot === "string" ? snapshot : `${JSON.stringify(snapshot, null, 2)}\n`);
  return directory;
}

/** Two measured packets on two actions, one of them trimmed, and an action Core captured nothing around. */
const TWO_PACKETS = {
  flowId: "flow.basic", runtimeRunId: "runtime-1", status: "succeeded", harnessActivations: 0, failure: null, extractionCount: 0,
  actions: [
    { actionType: "web.dom.type", status: "succeeded", evidencePackets: [{ point: "beforeAction", bytes: 2_048, truncated: false }] },
    { actionType: "web.browser.wait", status: "succeeded" },
    { actionType: "web.dom.click", status: "succeeded", evidencePackets: [{ point: "afterAction", bytes: 4_096, truncated: true }] },
  ],
};

test("a passing recording-lane run: oracle passed, FluxIQ's probe succeeded, finished actions timed, provider-free", () => {
  const evaluation = evaluateRecordingRun(input({ manifest: manifest({ actions: [action("web.browser.navigate", 1911), action("web.dom.type", 1553), action("web.dom.click", undefined, "running")] }) }));
  assert.equal(evaluation.verdict, "passed");
  assert.equal("failureCategory" in evaluation, false);
  assert.deepEqual(evaluation.invariants, [{ id: "runner-verdict", passed: true, expected: "passed", actual: "passed", evidenceSequences: [17] }]);
  assert.deepEqual([evaluation.lane, evaluation.flowCreated, evaluation.oracleVerdict], ["recording", null, "passed"]);
  assert.equal(evaluation.durationMs, 42_500);
  assert.deepEqual(evaluation.actions, [{ actionType: "web.browser.navigate", durationMs: 1911 }, { actionType: "web.dom.type", durationMs: 1553 }]);
  assert.deepEqual(evaluation.llm, { mode: "disabled", profileId: null, calls: 0 });
  assert.equal(evaluation.harnessActivations, 0);
  assert.deepEqual(evaluation.evidence, { sanitizedPacketBytes: [], rawSnapshotBytes: [], truncationCount: 0 });
  assert.deepEqual(evaluation.metrics, { steps: 5 });
  assert.deepEqual([evaluation.harnessRecovery, evaluation.adaptationCost, evaluation.adaptationValidation, evaluation.adaptationPersistence, evaluation.adaptationReuse], [null, null, null, null, null]);
  // Unmeasured, never an empty measurement: this lane asserts each extract step as it runs and keeps no per-step measurement, and `[]` here would put a lane that measured nothing into the bench's extraction block.
  assert.equal(evaluation.extraction, null);
});

test("an assertion failure is an oracle failure; a failure before the oracle leaves it unconsulted", () => {
  const oracle = evaluateRecordingRun(input({ result: { runId: "run-b", verdict: "failed", failureCategory: "runtime.behavior" }, errorSequence: 9 }));
  assert.deepEqual([oracle.verdict, oracle.failureCategory, oracle.oracleVerdict], ["failed", "runtime.behavior", "failed"]);
  assert.deepEqual(oracle.invariants, [{ id: "runner-verdict", passed: false, expected: "passed", actual: "failed: runtime.behavior", evidenceSequences: [9] }]);
  const rig = evaluateRecordingRun(input({ result: { runId: "run-c", verdict: "failed", failureCategory: "gateway.pairing" } }));
  assert.deepEqual([rig.failureCategory, rig.oracleVerdict], ["gateway.pairing", null]);
  const unclassified = evaluateRecordingRun(input({ result: { runId: "run-d", verdict: "failed", failureCategory: "not-a-category" } }));
  assert.equal(unclassified.failureCategory, "unknown");
});

test("the test-rig category and the automation's own failure stay on separate axes", () => {
  // `failureCategory` says why the facility could not produce a trustworthy run. Core's adaptive
  // failure classes and the domain's `web.*` codes describe the automation instead, and reach the
  // evaluation only through `automationFailureReported`; arriving here, either reads as `unknown`.
  for (const foreign of ["target_not_found", "web.target.not_found", "ambiguous_or_unknown"]) {
    assert.equal(evaluateRecordingRun(input({ result: { runId: "run-e", verdict: "failed", failureCategory: foreign } })).failureCategory, "unknown");
  }
  const both = evaluateRecordingRun(input({
    result: { runId: "run-f", verdict: "failed", failureCategory: "runtime.behavior" },
    manifest: manifest({ actions: [action("web.dom.click", 12, "failed")], automationFailure: { category: "target_not_found", code: "web.target.not_found" } }),
  }));
  assert.deepEqual([both.failureCategory, both.automationFailureReported], ["runtime.behavior", { category: "target_not_found", code: "web.target.not_found" }]);
});

test("FluxIQ's reported verdict comes from the probe's actions and automation failure", () => {
  const categorised = evaluateRecordingRun(input({ manifest: manifest({ actions: [action("web.dom.type", 10, "failed")], automationFailure: { category: "target_not_found", code: "web.target.not_found" } }) }));
  assert.deepEqual([categorised.reportedVerdict, categorised.automationFailureReported], ["failed", { category: "target_not_found", code: "web.target.not_found" }]);
  const uncategorised = evaluateRecordingRun(input({ manifest: manifest({ actions: [action("web.dom.type", 10, "timed_out")] }) }));
  assert.deepEqual([uncategorised.reportedVerdict, uncategorised.automationFailureReported], ["failed", { category: "ambiguous_or_unknown" }]);
  const succeeded = evaluateRecordingRun(input({ manifest: manifest({ actions: [action("web.dom.type", 10)] }) }));
  assert.deepEqual([succeeded.reportedVerdict, succeeded.automationFailureReported], ["passed", null]);
  const nothingRan = evaluateRecordingRun(input({ manifest: manifest({ actions: [] }) }));
  assert.deepEqual([nothingRan.reportedVerdict, nothingRan.automationFailureReported], [null, null]);
  const unobserved = manifest({ actions: [action("web.dom.type", 10)] });
  delete (unobserved as { automationFailure?: unknown }).automationFailure;
  assert.equal(evaluateRecordingRun(input({ manifest: unobserved })).reportedVerdict, null);
});

test("without run.json the bench's wall clock is the duration and FluxIQ's verdict is unknown", () => {
  const evaluation = evaluateRecordingRun(input({ manifest: undefined }));
  assert.deepEqual([evaluation.durationMs, evaluation.reportedVerdict, evaluation.actions], [50_000, null, []]);
});

test("an expected failure travels with the run; a runner that throws is inconclusive, never a pass", () => {
  const negative = evaluateRecordingRun(input({ variantId: "expired", expectedFailure: { category: "auth_required" } }));
  assert.deepEqual([negative.variantId, negative.automationFailureExpected], ["expired", { category: "auth_required" }]);
  assert.equal(negative.facilityFailure, null, "an expected automation result is not a facility failure");
  const facilityFailure = { boundary: "no-final-bundle", stage: "scenario.load", reason: "module.missing", causeCode: "ERR_MODULE_NOT_FOUND" } as const;
  const thrown = evaluateFailedAttempt({ ...identity, lane: "recording", repeatIndex: 1, attemptId: "bench-x-r1-0", error: new RunnerFailure("environment.missing", "Scenario Lab build is missing"), facilityFailure, wallClockMs: 12 });
  assert.deepEqual([thrown.runId, thrown.verdict, thrown.failureCategory, thrown.oracleVerdict, thrown.reportedVerdict, thrown.durationMs, thrown.repeatIndex], ["bench-x-r1-0", "inconclusive", "environment.missing", null, null, 12, 1]);
  assert.equal(thrown.invariants[0]?.passed, false);
  assert.deepEqual(thrown.facilityFailure, facilityFailure);
  assert.deepEqual([thrown.actions, thrown.evidence.sanitizedPacketBytes, thrown.automationFailureReported], [[], [], null]);
  const thrownOnFlow = evaluateFailedAttempt({ ...identity, lane: "flow", attemptId: "bench-x-r0-1", error: new RunnerFailure("environment.missing", "Scenario Lab build is missing"), facilityFailure, wallClockMs: 9 });
  assert.deepEqual([thrownOnFlow.lane, thrownOnFlow.flowCreated, thrownOnFlow.reportedVerdict], ["flow", false, null]);
});

test("facility diagnostics are explicit and cannot accompany a passing automation result", () => {
  const facilityFailure = { boundary: "finalized-bundle", stage: "scenario.execute", reason: "http.transport", operationStage: "control.request", causeCode: "ECONNRESET" } as const;
  const failed = evaluateRecordingRun(input({
    result: { runId: "run-facility", verdict: "failed", failureCategory: "gateway.connection" }, facilityFailure,
    manifest: manifest({ actions: [] }), errorSequence: 8,
  }));
  assert.deepEqual(failed.facilityFailure, facilityFailure);
  assert.throws(() => evaluateRecordingRun(input({ facilityFailure })), /facilityFailure/u);
});

test("a Flow-lane run reports the lane's own observation, not an inference over the manifest", () => {
  const evaluation = evaluateFlowRun(flowInput({
    variantId: "selector-only", result: {
      runId: "run-flow", verdict: "passed", path: NO_BUNDLE,
      observation: {
        lane: "flow", flowCreated: true, oracleVerdict: "passed", reportedVerdict: "passed",
        automationFailureReported: null, automationFailureExpected: null, harnessActivations: 2,
        actions: [{ actionType: "web.dom.click", durationMs: 210 }, { actionType: "web.dom.type", durationMs: 340 }],
        extraction: [{ stepIndex: 1, status: "judged", expectedRecords: 2, observedRecords: 2, recordsListed: true, countStated: true, comparedRecords: 2, matchedRecords: 2, expectedFields: 2, presentFields: 2, unexpectedFields: 0, expectedPages: null, pagesFollowed: null, truncated: null, durationMs: 40, nonStringValues: 0 }],
      },
    },
  }));
  assert.deepEqual([evaluation.lane, evaluation.flowCreated, evaluation.oracleVerdict, evaluation.reportedVerdict, evaluation.harnessActivations], ["flow", true, "passed", "passed", 2]);
  assert.deepEqual(evaluation.actions, [{ actionType: "web.dom.click", durationMs: 210 }, { actionType: "web.dom.type", durationMs: 340 }]);
  // The manifest carries the recording lane's probe action; the Flow lane does not read it.
  assert.equal(evaluation.actions.some((action) => action.actionType === "web.browser.navigate"), false);
  // The lane's own per-step extraction measurements reach the evaluation, which is the only way a bench can state an extraction block at all.
  assert.deepEqual(evaluation.extraction?.map((measurement) => [measurement.stepIndex, measurement.status, measurement.comparedRecords, measurement.matchedRecords]), [[1, "judged", 2, 2]]);
});

/**
 * The bench's Flow lane copies the lane's recovery record member for member, as
 * a single `lab run` does, so the two producers write the same row. Only the
 * lane can tell "recovered nothing" from "never measured", so a run that never
 * reached it states no recovery at all.
 */
test("a Flow-lane run records Core's recovery as the lane observed it, each attempt's verdict included", () => {
  const harnessRecovery: NonNullable<RunLaneObservation["harnessRecovery"]> = {
    attempted: true,
    interventions: [{ kind: "runtime_patch", validationOk: true, validationCodes: [] }],
    runtimePatchAttempts: [
      { kind: "temporary_target_override", proposalOnly: false, executed: null, preflightOk: true, issueCodes: [], adaptationCreated: true, changeProposalCreated: false, verdict: { outcome: "verified", basis: ["downstream_assertion"] } },
      { kind: "temporary_target_override", proposalOnly: true, executed: false, preflightOk: true, issueCodes: [], adaptationCreated: false, changeProposalCreated: true, verdict: null },
    ],
    adaptationIds: ["adaptation.run-flow.temporary_target_override.1789000000000"],
    changeProposalIds: ["proposal.adaptation.run-flow.temporary_target_override.1789000000001"],
  };
  const evaluation = evaluateFlowRun(flowInput({ result: { runId: "run-flow", verdict: "passed", path: NO_BUNDLE, observation: { ...createdFlow, harnessActivations: 1, harnessRecovery } } }));
  assert.deepEqual(evaluation.harnessRecovery, harnessRecovery);
  assert.notEqual(evaluation.harnessRecovery, harnessRecovery, "the row holds a copy, not the lane's own record");
  assert.equal(evaluateFlowRun(flowInput({ result: { runId: "run-none", verdict: "failed", failureCategory: "gateway.pairing", path: NO_BUNDLE } })).harnessRecovery, null);
  // No lane reports the four adaptation measurements yet, so a bench row states them unmeasured, never as zeros.
  assert.deepEqual([evaluation.adaptationCost, evaluation.adaptationValidation, evaluation.adaptationPersistence, evaluation.adaptationReuse], [null, null, null, null]);
});

/**
 * A run that never reached the Flow lane measured no extraction. `[]` would
 * say the run measured extraction and found no extract step, which is what the
 * bench's per-lane block is built on, so the two cannot be spelled the same.
 */
test("a Flow-lane run whose lane published nothing states extraction as unmeasured, not as an empty measurement", () => {
  const evaluation = evaluateFlowRun(flowInput({ result: { runId: "run-none", verdict: "failed", failureCategory: "gateway.pairing", path: NO_BUNDLE } }));
  assert.equal(evaluation.extraction, null);
});

test("a Flow-lane run that never reached the Flow lane is flowCreated false with nothing executed", () => {
  const recorded = evaluateFlowRun(flowInput({
    result: {
      runId: "run-early", verdict: "failed", failureCategory: "recording.persistence", path: NO_BUNDLE,
      // What runScenario publishes when a --flow run fails before the Flow lane: the recording lane's observation.
      observation: { lane: "recording", flowCreated: null, oracleVerdict: null, reportedVerdict: null, automationFailureReported: null, automationFailureExpected: null, harnessActivations: 0, actions: [], extraction: null },
    },
    errorSequence: 4,
  }));
  assert.deepEqual([recorded.lane, recorded.flowCreated, recorded.oracleVerdict, recorded.reportedVerdict, recorded.actions.length], ["flow", false, null, null, 0]);
  const none = evaluateFlowRun(flowInput({ result: { runId: "run-none", verdict: "failed", failureCategory: "gateway.pairing", path: NO_BUNDLE }, errorSequence: 2 }));
  assert.deepEqual([none.lane, none.flowCreated, none.reportedVerdict], ["flow", false, null]);
});

test("a Flow that was created but failed carries the reported category and the corpus's expected one", () => {
  const evaluation = evaluateFlowRun(flowInput({
    variantId: "expired", expectedFailure: { category: "auth_required" },
    result: {
      runId: "run-neg", verdict: "passed", path: NO_BUNDLE,
      observation: {
        lane: "flow", flowCreated: true, oracleVerdict: "passed", reportedVerdict: "failed",
        automationFailureReported: { category: "auth_required", code: "web.auth.required" },
        automationFailureExpected: null, harnessActivations: 0, actions: [{ actionType: "web.browser.navigate", durationMs: 90 }], extraction: null,
      },
    },
  }));
  assert.deepEqual([evaluation.reportedVerdict, evaluation.automationFailureReported], ["failed", { category: "auth_required", code: "web.auth.required" }]);
  assert.deepEqual(evaluation.automationFailureExpected, { category: "auth_required" });
});

test("a Flow-lane bundle's measured packets are its evidence sizes: every packet's bytes, and a count of the trimmed ones", (t) => {
  const evaluation = evaluateFlowRun(flowInput({ result: { runId: "run-evidence", verdict: "passed", path: bundleWith(t, TWO_PACKETS), observation: createdFlow } }));
  assert.deepEqual(evaluation.evidence, { sanitizedPacketBytes: [2_048, 4_096], rawSnapshotBytes: [], truncationCount: 1 });
});

test("a recording-lane bundle adds no evidence sizes, even when its directory holds Flow-lane packets", (t) => {
  // runScenario's result carries the bundle path on either lane; only the Flow lane's evaluation reads it.
  const result = { runId: "run-recording", verdict: "passed" as const, path: bundleWith(t, TWO_PACKETS) };
  assert.deepEqual(evaluateRecordingRun(input({ result })).evidence, { sanitizedPacketBytes: [], rawSnapshotBytes: [], truncationCount: 0 });
});
