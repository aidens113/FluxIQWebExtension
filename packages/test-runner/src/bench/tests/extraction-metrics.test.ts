import assert from "node:assert/strict";
import test from "node:test";
import type { RunEvaluation, RunExtractionMeasurement } from "@fluxiq-web-extension/test-contracts";
import { aggregateBenchReport, type BenchResultRuns } from "../aggregate-report.js";
import { benchExtractionMetrics } from "../extraction-metrics.js";

const measurement = (fields: Partial<RunExtractionMeasurement> = {}): RunExtractionMeasurement => ({
  stepIndex: 1, status: "judged", expectedRecords: 0, observedRecords: 0, recordsListed: false, countStated: false,
  comparedRecords: 0, matchedRecords: 0, expectedFields: 0, presentFields: 0, unexpectedFields: 0,
  matchedInAnyOrder: 0, unjudged: [], expectedPages: null, pagesFollowed: null, truncated: null, durationMs: null, nonStringValues: 0, ...fields,
});

/** A step whose expectation listed its records, so its values were compared. */
const compared = (expected: number, matched: number, fields: Partial<RunExtractionMeasurement> = {}): RunExtractionMeasurement =>
  measurement({ recordsListed: true, expectedRecords: expected, observedRecords: expected, comparedRecords: expected, matchedRecords: matched, expectedFields: expected, presentFields: matched, ...fields });

/** A step whose expectation stated a count and listed nothing, so not one value was compared (x5f). */
const countOnly = (expected: number, observed: number): RunExtractionMeasurement =>
  measurement({ countStated: true, expectedRecords: expected, observedRecords: observed });

const run = (repeatIndex: number, fields: Partial<RunEvaluation> = {}): RunEvaluation => ({
  schemaVersion: "0.3", runId: `run-${repeatIndex}`, verdict: "passed", facilityFailure: null, invariants: [], metrics: {},
  scenarioId: "product-catalog", workflowId: null, variantId: null, repeatIndex, lane: "flow", flowCreated: true,
  oracleVerdict: "passed", reportedVerdict: "passed", automationFailureReported: null, automationFailureExpected: null,
  harnessActivations: 0, durationMs: 40_000, actions: [], evidence: { sanitizedPacketBytes: [], rawSnapshotBytes: [], truncationCount: 0 },
  llm: { mode: "disabled", profileId: null, calls: 0 },
  extraction: null,
  harnessRecovery: null, adaptationCost: null, adaptationValidation: null, adaptationPersistence: null, adaptationReuse: null,
  ...fields,
});

const result = (corpusRowId: string, evaluations: RunEvaluation[]): BenchResultRuns => ({
  corpusRowId, scenarioId: evaluations[0]!.scenarioId, workflowId: evaluations[0]!.workflowId, variantId: evaluations[0]!.variantId, lane: evaluations[0]!.lane, evaluations,
});

/**
 * The x5f defect at report level. `large-table`'s count-only step observes the
 * 1,000 records it expected without comparing one value; the other step lists
 * two records and gets one right. Pooling both gave 1,001 of 1,002 — 0.999 for
 * a bench whose only real comparison was half wrong.
 */
test("a count-only step is pooled into the count accuracy alone, so a step that compared nothing cannot lift the record accuracy", () => {
  const metrics = benchExtractionMetrics([result("W08", [run(0, { extraction: [countOnly(1_000, 1_000), compared(2, 1)] })])]);
  assert.deepEqual(metrics?.extractionRecordAccuracy, { count: 1, total: 2, workflows: 1, rate: 0.5 });
  assert.deepEqual(metrics?.extractionCountAccuracy, { count: 1, total: 1, workflows: 1, rate: 1 });
  assert.deepEqual([metrics?.judgedSteps, metrics?.comparedSteps, metrics?.countOnlySteps, metrics?.unjudgeableSteps], [2, 1, 1, 0]);
});

/** A lane whose every extraction step stated a count states no record accuracy at all, rather than a flattering one. */
test("a population with nothing in it publishes rate null, never a number", () => {
  const metrics = benchExtractionMetrics([result("W08", [run(0, { extraction: [countOnly(3, 3)] })])]);
  assert.deepEqual(metrics?.extractionRecordAccuracy, { count: 0, total: 0, workflows: 0, rate: null });
  assert.deepEqual(metrics?.extractionFieldCompleteness, { count: 0, total: 0, workflows: 0, rate: null });
  assert.deepEqual(metrics?.paginationAccuracy, { count: 0, total: 0, workflows: 0, rate: null });
  assert.deepEqual(metrics?.extractionMsPerPage, { samples: 0, p50: null, p95: null });
});

/**
 * The Flow lane cannot observe the pages an extraction followed: Core's run
 * detail and its run datasets record none. Such a step enters no pagination
 * accuracy, which therefore publishes `rate: null` rather than counting a
 * comparison nobody made.
 */
test("pagination accuracy needs both sides: a declared page count with nothing observed enters no rate", () => {
  const unobserved = benchExtractionMetrics([result("W05", [run(0, { extraction: [compared(3, 3, { expectedPages: 3 })] })])]);
  assert.deepEqual(unobserved?.paginationAccuracy, { count: 0, total: 0, workflows: 0, rate: null });

  const observed = benchExtractionMetrics([result("W05", [run(0, { extraction: [compared(3, 3, { expectedPages: 3, pagesFollowed: 3 }), compared(2, 2, { expectedPages: 2, pagesFollowed: 1 })] })])]);
  assert.deepEqual(observed?.paginationAccuracy, { count: 1, total: 2, workflows: 1, rate: 0.5 });
  // A step that never declared a page count is not in the population either, so it cannot be a free hit.
  const undeclared = benchExtractionMetrics([result("W05", [run(0, { extraction: [compared(3, 3, { pagesFollowed: 1 })] })])]);
  assert.deepEqual(undeclared?.paginationAccuracy, { count: 0, total: 0, workflows: 0, rate: null });
});

/**
 * The two claims differ, and neither may be made without a comparison. "Every
 * step matched" cannot be claimed for a run holding a step that judged
 * nothing, so such a run is a **miss** for exact success — the rule
 * `initialExecutionSuccess` applies to a run in which FluxIQ executed nothing.
 * "FluxIQ said fine while the extraction was wrong" needs a comparison that
 * actually failed, so the same step is no evidence of a false success.
 */
test("a step that judged nothing misses exact success and is never counted as a false success", () => {
  const unjudgeable = measurement();
  const metrics = benchExtractionMetrics([
    result("W04", [run(0, { extraction: [compared(2, 2)] })]),
    result("W08", [run(0, { runId: "run-gap", extraction: [compared(2, 2), unjudgeable] })]),
  ]);
  assert.deepEqual(metrics?.extractionExactSuccess, { count: 1, total: 2, workflows: 2, rate: 0.5 });
  assert.deepEqual(metrics?.extractionFalseSuccess, { count: 0, total: 2, workflows: 2, rate: 0 });
  assert.equal(metrics?.unjudgeableSteps, 1);

  // A real mismatch under a reported success is the false success this rate exists for.
  const wrong = benchExtractionMetrics([result("W04", [run(0, { extraction: [compared(2, 1)] })])]);
  assert.deepEqual(wrong?.extractionFalseSuccess, { count: 1, total: 1, workflows: 1, rate: 1 });
  assert.deepEqual(wrong?.extractionExactSuccess, { count: 0, total: 1, workflows: 1, rate: 0 });
});

test("a run that measured no extraction is not a measurement of zero: the lane states nothing at all", () => {
  assert.equal(benchExtractionMetrics([result("W01", [run(0)])]), undefined);
  // A run that measured extraction and had no extract step states a block with nothing judged.
  const empty = benchExtractionMetrics([result("W01", [run(0, { extraction: [] })])]);
  assert.deepEqual([empty?.judgedSteps, empty?.unjudgedSteps], [0, 0]);
  assert.equal(empty?.extractionExactSuccess.rate, null);
});

test("durations are distributed over the steps that reported one", () => {
  const metrics = benchExtractionMetrics([result("W04", [run(0, { extraction: [compared(1, 1, { durationMs: 400, pagesFollowed: 2, expectedPages: 2 }), compared(1, 1, { durationMs: 100 })] })])]);
  assert.deepEqual(metrics?.extractionDurationMs, { samples: 2, p50: 100, p95: 400 });
  assert.deepEqual(metrics?.extractionMsPerPage, { samples: 1, p50: 200, p95: 200 });
});

test("the report states extraction per lane, and only for a lane whose runs measured it", () => {
  const report = aggregateBenchReport({
    reportId: "bench-extraction", generatedAt: "2026-09-15T10:00:00.000Z", corpusId: "smoke", repeatCount: 1, target: "isolated",
    results: [
      result("W04", [run(0, { extraction: [compared(2, 2)] })]),
      result("W05", [run(0, { lane: "recording", flowCreated: null, scenarioId: "product-catalog" })]),
    ],
  });
  assert.deepEqual(Object.keys(report.metrics.extractionByLane ?? {}), ["flow"]);
  assert.deepEqual(report.metrics.extractionByLane?.flow?.extractionRecordAccuracy, { count: 2, total: 2, workflows: 1, rate: 1 });
  // A bench no run of which measured extraction omits the block, which the contract reads as unmeasured rather than as zero.
  const none = aggregateBenchReport({
    reportId: "bench-plain", generatedAt: "2026-09-15T10:00:00.000Z", corpusId: "smoke", repeatCount: 1, target: "isolated",
    results: [result("W01", [run(0)])],
  });
  assert.equal(none.metrics.extractionByLane, undefined);
});
