import assert from "node:assert/strict";
import test from "node:test";
import type { RunEvaluation, RunManifest } from "@fluxiq-web-extension/test-contracts";
import { evaluateRecordingRun, type RecordingRunInput } from "../../bench/index.js";
import { recordingLaneObservation, type RunLaneObservation } from "../../flow-lane/index.js";
import { singleRunEvaluation } from "../single-run-evaluation.js";

/**
 * Two producers of a `RunEvaluation` now exist: `lab bench`, per corpus run,
 * and `lab run`, once. Two evaluators drifting is this plan's most-repeated
 * defect, so this file states where they agree and where they do not, and
 * fails if either moves.
 *
 * They share one assembler (`evaluateObservedRun`) and one run-as-a-test half
 * (`runOutcome`). They differ only in the `RunLaneObservation` they hand it:
 * `lab run` passes the lane's own, and the bench's recording lane passes a
 * substitute derived from `run.json`, because eight bench reports on disk were
 * measured that way. `bench/evaluate-run.ts` documents why that stays.
 */

type ActionStatus = NonNullable<RunManifest["actions"]>[number]["status"];
const manifest = (fields: Partial<RunManifest> = {}): RunManifest => ({
  startedAt: "2026-09-12T10:00:00.000Z", finishedAt: "2026-09-12T10:00:42.500Z", automationFailure: null,
  actions: [{ actionType: "web.browser.navigate", startedAt: "2026-09-12T10:00:10.000Z", durationMs: 1_911, status: "succeeded" as ActionStatus }],
  ...fields,
}) as RunManifest;

const laneActions = [{ actionType: "web.browser.navigate", durationMs: 1_911 }];

/** One run, described once, then handed to each producer in the shape it takes. */
type Run = {
  verdict: "passed" | "failed";
  failureCategory: string | undefined;
  /** What the fixture oracle actually did, as only the lane knows. */
  oracleVerdict: "passed" | "failed" | null;
  facilityFailure?: RunEvaluation["facilityFailure"];
  manifest?: RunManifest | undefined;
};

function observationOf(run: Run): RunLaneObservation {
  return recordingLaneObservation({ oracleVerdict: run.oracleVerdict, reportedVerdict: run.facilityFailure ? null : "passed", automationFailureReported: null, automationFailureExpected: null, actions: run.facilityFailure ? [] : laneActions });
}

function fromBench(run: Run): RunEvaluation {
  const input: RecordingRunInput = {
    scenarioId: "basic-form", workflowId: null, variantId: null, repeatIndex: 0, expectedFailure: null,
    facilityFailure: run.facilityFailure ?? null,
    result: { runId: "run-a", verdict: run.verdict, ...(run.failureCategory === undefined ? {} : { failureCategory: run.failureCategory }) },
    manifest: "manifest" in run ? run.manifest : run.facilityFailure ? manifest({ actions: [] }) : manifest(),
    metrics: { steps: 5 }, finalSequence: 17, errorSequence: 18, wallClockMs: 50_000,
  };
  return evaluateRecordingRun(input);
}

function fromSingleRun(run: Run): RunEvaluation {
  return singleRunEvaluation({
    runId: "run-a", verdict: run.verdict, failureCategory: run.failureCategory, scenarioId: "basic-form",
    facilityFailure: run.facilityFailure ?? null,
    workflowId: undefined, variantId: undefined, observation: observationOf(run),
    manifest: "manifest" in run ? run.manifest : manifest(),
    metrics: { steps: 5 }, events: [{ sequence: 17, trigger: "final" }, { sequence: 18, trigger: "error" }], wallClockMs: 50_000,
  });
}

const differences = (left: RunEvaluation, right: RunEvaluation): string[] =>
  [...new Set([...Object.keys(left), ...Object.keys(right)])]
    .filter((key) => JSON.stringify(left[key as keyof RunEvaluation]) !== JSON.stringify(right[key as keyof RunEvaluation]))
    .sort();

test("a passing run: the bench and a single lab run produce the identical evaluation", () => {
  const run: Run = { verdict: "passed", failureCategory: undefined, oracleVerdict: "passed" };
  assert.deepEqual(differences(fromBench(run), fromSingleRun(run)), []);
  assert.deepEqual(fromSingleRun(run), fromBench(run));
});

test("a failure before the oracle: both record an unconsulted oracle, and agree", () => {
  const run: Run = { verdict: "failed", failureCategory: "gateway.pairing", oracleVerdict: null };
  assert.deepEqual(differences(fromBench(run), fromSingleRun(run)), []);
  assert.equal(fromBench(run).oracleVerdict, null);
});

test("a fixture that disagreed: both record an oracle failure, and agree", () => {
  const run: Run = { verdict: "failed", failureCategory: "runtime.behavior", oracleVerdict: "failed" };
  assert.deepEqual(differences(fromBench(run), fromSingleRun(run)), []);
  assert.equal(fromBench(run).oracleVerdict, "failed");
});

test("a finalized facility failure is identical across both producers", () => {
  const facilityFailure = { boundary: "finalized-bundle", stage: "scenario.execute", reason: "unclassified" } as const;
  const run: Run = { verdict: "failed", failureCategory: "gateway.pairing", oracleVerdict: null, facilityFailure };
  assert.deepEqual(differences(fromBench(run), fromSingleRun(run)), []);
  assert.deepEqual(fromBench(run).facilityFailure, facilityFailure);
});

test("a rig that broke after the oracle passed: they differ, in oracleVerdict and in nothing else", () => {
  // A disallowed console error, a network-policy violation, and the Core
  // probe's page-state check all raise `runtime.behavior` after
  // `assertFinalState` has already succeeded. The bench infers an oracle
  // failure from the category; the lane says the oracle passed, because it
  // did. This is the whole of the divergence, and widening it is the drift
  // this test exists to catch.
  const run: Run = { verdict: "failed", failureCategory: "runtime.behavior", oracleVerdict: "passed" };
  assert.deepEqual(differences(fromBench(run), fromSingleRun(run)), ["oracleVerdict"]);
  assert.equal(fromBench(run).oracleVerdict, "failed", "the bench's inference, kept so its eight reports stay comparable");
  assert.equal(fromSingleRun(run).oracleVerdict, "passed", "the lane's observation, which is what actually happened");
});

test("the recording lane's own extraction measurements reach a single run and no bench row", () => {
  // The lane measures its extraction now (`runExtractionMeasurements`): it ran
  // the script, so it knows which extract steps ran, and FluxIQ's own read
  // reports the pages it covered. The bench's substitute observation is built
  // from `run.json`, which carries no measurement, so it still states `null`
  // -- unmeasured, not "measured none". Closing this means taking the
  // published observation's `extraction` in `bench/evaluate-run.ts`, and this
  // row is what says it has not been closed yet.
  const run: Run = { verdict: "passed", failureCategory: undefined, oracleVerdict: "passed" };
  const measured = { ...fromSingleRun(run), extraction: MEASURED };
  assert.deepEqual(differences(fromBench(run), measured), ["extraction"]);
  assert.equal(fromBench(run).extraction, null, "a bench row on this lane measures no extraction yet");
  assert.deepEqual(measured.extraction, MEASURED, "a single run publishes one measurement per extract step");
});

/** One judged extract step, as `runExtractionMeasurements` publishes it: counts and flags only. */
const MEASURED: RunEvaluation["extraction"] = [{
  stepIndex: 1, status: "judged", expectedRecords: 23, observedRecords: 23, recordsListed: true, countStated: true,
  comparedRecords: 23, matchedRecords: 23, expectedFields: 92, presentFields: 92, unexpectedFields: 0,
  expectedPages: 3, pagesFollowed: 3, truncated: false, durationMs: 1_400, nonStringValues: 0,
}];

test("an unreadable run.json costs the bench the automation fields a single run still has", () => {
  // The bench reads the automation back out of `run.json`; the lane never lost
  // it. This is not a divergence in judgement, it is the round trip, and it
  // is the second reason a single run's evaluation is worth having.
  const run: Run = { verdict: "passed", failureCategory: undefined, oracleVerdict: "passed", manifest: undefined };
  assert.deepEqual(differences(fromBench(run), fromSingleRun(run)), ["actions", "reportedVerdict"]);
  assert.deepEqual([fromBench(run).reportedVerdict, fromBench(run).actions], [null, []]);
  assert.deepEqual([fromSingleRun(run).reportedVerdict, fromSingleRun(run).actions], ["passed", laneActions]);
});
