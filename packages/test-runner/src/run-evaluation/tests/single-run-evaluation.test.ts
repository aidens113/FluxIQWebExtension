import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { parseRunEvaluationJson, type RunEvaluation, type RunManifest } from "@fluxiq-web-extension/test-contracts";
import { evaluateFlowRun } from "../../bench/index.js";
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
  facilityFailure: null,
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

test("a campaign run preserves its exact repeat identity while standalone runs default to zero", () => {
  assert.equal(singleRunEvaluation(input()).repeatIndex, 0);
  assert.equal(singleRunEvaluation(input({ repeatIndex: 2 })).repeatIndex, 2);
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

/** A bundle directory holding only `snapshots/flow-lane.json`: `snapshot` as `flowLaneSnapshot` writes it, or raw text. */
function bundleWith(t: TestContext, snapshot: unknown): string {
  const directory = mkdtempSync(path.join(tmpdir(), "fluxiq-single-run-evidence-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  mkdirSync(path.join(directory, "snapshots"));
  writeFileSync(path.join(directory, "snapshots", "flow-lane.json"), typeof snapshot === "string" ? snapshot : `${JSON.stringify(snapshot, null, 2)}\n`);
  return directory;
}
const NO_EVIDENCE = { sanitizedPacketBytes: [], rawSnapshotBytes: [], truncationCount: 0 };

/** Two measured packets on two actions, one of them trimmed, and an action Core captured nothing around. */
const TWO_PACKETS = {
  flowId: "flow.basic", runtimeRunId: "core-run.1", status: "succeeded", harnessActivations: 0, failure: null, extractionCount: 0,
  actions: [
    { actionType: "web.dom.type", status: "succeeded", evidencePackets: [{ point: "beforeAction", bytes: 2_048, truncated: false }] },
    { actionType: "web.browser.wait", status: "succeeded" },
    { actionType: "web.dom.click", status: "succeeded", evidencePackets: [{ point: "afterAction", bytes: 4_096, truncated: true }] },
  ],
};

const createdFlow = flowLaneObservation({
  flowCreated: true, oracleVerdict: "passed", automationFailureExpected: null,
  run: { runId: "core-run.1", status: "succeeded", harnessActivations: 0, failure: null, extracted: [], actions: [{ actionType: "web.dom.click", status: "succeeded", startedAt: "2026-09-12T10:00:11.000Z", durationMs: 210, failure: null }] },
});

/** The same run as the bench's Flow lane evaluates it, from the finalized bundle at `bundlePath`. `input()` closes on its `final` event, sequence 17. */
function benchRowOf(run: SingleRunInput, bundlePath: string): RunEvaluation {
  return evaluateFlowRun({
    scenarioId: run.scenarioId, workflowId: run.workflowId ?? null, variantId: run.variantId ?? null, repeatIndex: run.repeatIndex ?? 0, expectedFailure: run.observation.automationFailureExpected,
    result: { runId: run.runId, verdict: run.verdict, ...(run.failureCategory === undefined ? {} : { failureCategory: run.failureCategory }), path: bundlePath, observation: run.observation },
    facilityFailure: run.facilityFailure, manifest: run.manifest, metrics: run.metrics, finalSequence: 17, errorSequence: undefined, wallClockMs: run.wallClockMs,
  });
}

test("a finalized facility diagnostic survives serialization, while invalid pass pairing is rejected", () => {
  const facilityFailure = {
    boundary: "finalized-bundle", stage: "scenario.execute", reason: "readiness.timeout",
    operationStage: "core.health", timeoutMs: 30_000,
  } as const;
  const failed = singleRunEvaluation(input({
    verdict: "failed", failureCategory: "process.startup", facilityFailure,
    observation: recordingLaneObservation({ oracleVerdict: null, reportedVerdict: null, automationFailureReported: null, automationFailureExpected: null, actions: [] }),
    events: [{ sequence: 9, trigger: "error" }],
  }));
  assert.deepEqual(failed.facilityFailure, facilityFailure);
  assert.deepEqual(parseRunEvaluationJson(JSON.stringify(failed)), failed);
  assert.throws(() => singleRunEvaluation(input({ facilityFailure })), /facilityFailure/u);
});

test("a Flow-lane single run records the packets its bundle measured, and agrees with its bench row field for field", (t) => {
  const bundlePath = bundleWith(t, TWO_PACKETS);
  const run = input({ observation: createdFlow, bundlePath });
  const evaluation = singleRunEvaluation(run);
  assert.deepEqual(evaluation.evidence, { sanitizedPacketBytes: [2_048, 4_096], rawSnapshotBytes: [], truncationCount: 1 });
  assert.deepEqual(parseRunEvaluationJson(JSON.stringify(evaluation)), evaluation);
  // Until this read existed, `evaluation.json` recorded no packets for the run
  // whose bench row recorded two. One file, one judgement.
  assert.deepEqual(evaluation, benchRowOf(run, bundlePath));
});

test("a recording-lane single run reads no evidence sizes, even from a directory holding Flow-lane packets", (t) => {
  const evaluation = singleRunEvaluation(input({ bundlePath: bundleWith(t, TWO_PACKETS) }));
  assert.equal(evaluation.lane, "recording");
  assert.deepEqual(evaluation.evidence, NO_EVIDENCE);
});

test("lab run hands its evaluation the bundle the Flow lane wrote its snapshot into, before the bundle is sealed", async () => {
  // A read nothing passes a path to would leave `evaluation.json` empty while
  // every row above stayed green, so the call site is checked too.
  const root = path.resolve(import.meta.dirname, "..", "..", "..", "..", "..");
  const source = await readFile(path.join(root, "packages", "test-runner", "src", "run-scenario.ts"), "utf8");
  const at = {
    snapshot: source.indexOf('await bundle.writeStructured("snapshots/flow-lane.json", flowLaneSnapshot(evidence));'),
    evaluated: source.indexOf("? singleRunEvaluation({"),
    finalized: source.indexOf("await bundle.finalize("),
  };
  for (const [name, index] of Object.entries(at)) assert.ok(index > 0, `${name} is in the runner`);
  assert.ok(at.snapshot < at.evaluated, "the Flow lane's snapshot is written before the run is evaluated");
  assert.ok(at.evaluated < at.finalized, "the staging directory still exists: finalize renames it");
  assert.match(source, /\? singleRunEvaluation\(\{[^}]*\bbundlePath: bundle\.stagingPath\b[^}]*\}\)/u, "the evaluation reads the bundle this run is writing");
});
