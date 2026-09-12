import assert from "node:assert/strict";
import test from "node:test";
import type { RunEvaluation } from "@fluxiq-web-extension/test-contracts";
import { actionsExecuted, aggregateBenchReport, executedNothing, groupBenchResults, type BenchResultRuns } from "../aggregate-report.js";
import { benchDistribution } from "../distribution.js";
import { benchExecutionCoverage } from "../execution-coverage.js";

const run = (repeatIndex: number, fields: Partial<RunEvaluation> = {}): RunEvaluation => ({
  schemaVersion: "0.1", runId: `run-${repeatIndex}`, verdict: "passed", invariants: [], metrics: {},
  scenarioId: "basic-form", workflowId: null, variantId: null, repeatIndex, lane: "recording", flowCreated: null,
  oracleVerdict: "passed", reportedVerdict: "passed", automationFailureReported: null, automationFailureExpected: null,
  harnessActivations: 0, durationMs: 40_000, actions: [], evidence: { sanitizedPacketBytes: [], rawSnapshotBytes: [], truncationCount: 0 },
  llm: { mode: "disabled", profileId: null, calls: 0 },
  harnessRecovery: null, adaptationCost: null, adaptationValidation: null, adaptationPersistence: null, adaptationReuse: null,
  ...fields,
});
const failed = (repeatIndex: number, fields: Partial<RunEvaluation> = {}): RunEvaluation => run(repeatIndex, {
  verdict: "failed", failureCategory: "runtime.behavior", oracleVerdict: "failed",
  invariants: [{ id: "runner-verdict", passed: false, expected: "passed", actual: "failed: runtime.behavior", evidenceSequences: [] }], ...fields,
});
const result = (corpusRowId: string, evaluations: RunEvaluation[]): BenchResultRuns => ({ corpusRowId, scenarioId: evaluations[0]!.scenarioId, workflowId: evaluations[0]!.workflowId, variantId: evaluations[0]!.variantId, evaluations });
const aggregate = (repeatCount: number, results: BenchResultRuns[]) => aggregateBenchReport({ reportId: "bench-unit", generatedAt: "2026-09-11T10:00:00.000Z", corpusId: "smoke", repeatCount, target: "isolated", results });

test("pass rate and flake class per result; initial execution per workflow, replay per run; nearest-rank latency", () => {
  const report = aggregate(2, [
    result("W01", [run(0, { actions: [{ actionType: "web.dom.type", durationMs: 100 }] }), failed(1, { reportedVerdict: "passed", durationMs: 44_000, actions: [{ actionType: "web.dom.type", durationMs: 150 }] })]),
    result("W28", [run(0, { scenarioId: "iframe-checkout", durationMs: 30_000, actions: [{ actionType: "web.browser.navigate", durationMs: 2_000 }] }), run(1, { scenarioId: "iframe-checkout", durationMs: 31_000 })]),
  ]);
  assert.deepEqual(report.workflows.map((workflow) => [workflow.corpusRowId, workflow.runs, workflow.passRate, workflow.flakeClass]), [["W01", 2, 0.5, "flaky"], ["W28", 2, 1, "stable-pass"]]);
  const { rates } = report.metrics;
  assert.deepEqual(rates.initialExecutionSuccess, { count: 2, total: 2, workflows: 2, rate: 1 });
  assert.deepEqual(rates.deterministicReplaySuccess, { count: 1, total: 2, workflows: 2, rate: 0.5 });
  assert.deepEqual(rates.falseSuccess, { count: 1, total: 1, workflows: 1, rate: 1 });
  assert.deepEqual(rates.falseFailure, { count: 0, total: 3, workflows: 2, rate: 0 });
  assert.deepEqual(rates.harnessActivation, { count: 0, total: 4, workflows: 2, rate: 0 });
  for (const unmeasured of [rates.flowCreationSuccess, rates.fuzzyRecovery, rates.failureClassificationAccuracy]) assert.deepEqual(unmeasured, { count: 0, total: 0, workflows: 0, rate: null });
  assert.deepEqual(report.metrics.actionLatencyMs, { "web.browser.navigate": { samples: 1, p50: 2_000, p95: 2_000 }, "web.dom.type": { samples: 2, p50: 100, p95: 150 } });
  assert.deepEqual(report.metrics.runDurationMs, { samples: 4, p50: 31_000, p95: 44_000 });
  assert.deepEqual(report.metrics.sanitizedPacketBytes, { samples: 0, p50: null, p95: null });
  assert.deepEqual([report.metrics.truncationCount, report.llm, report.comparison], [0, { mode: "disabled", profileId: null, calls: 0 }, null]);
});

test("armed variants that expect success feed fuzzy recovery; negative runs feed classification accuracy only", () => {
  const report = aggregate(1, [
    result("W20", [run(0, { scenarioId: "identity-drift", variantId: "selector-only" })]),
    result("W19", [run(0, { scenarioId: "auth-gate", variantId: "expired", automationFailureExpected: { category: "auth_required" }, reportedVerdict: "failed", automationFailureReported: { category: "auth_required" } })]),
    result("W25", [run(0, { scenarioId: "delayed-ui", variantId: "too-slow", automationFailureExpected: { category: "timeout" }, reportedVerdict: "failed", automationFailureReported: { category: "ambiguous_or_unknown" } })]),
  ]);
  const { rates } = report.metrics;
  assert.deepEqual(rates.fuzzyRecovery, { count: 1, total: 1, workflows: 1, rate: 1 });
  assert.deepEqual(rates.failureClassificationAccuracy, { count: 1, total: 2, workflows: 2, rate: 0.5 });
  assert.deepEqual(rates.initialExecutionSuccess, { count: 1, total: 1, workflows: 1, rate: 1 });
  assert.deepEqual(rates.falseFailure, { count: 0, total: 1, workflows: 1, rate: 0 });
});

test("a run in which FluxIQ executed nothing is an execution-success miss, not a success and not an exclusion", () => {
  // The defect: reportedVerdict null with the runner and the oracle both
  // passing. Playwright drove the fixture and the fixture ended in the right
  // state; FluxIQ executed no action. On the week1 corpus this is 16 of 23
  // runnable rows, and initialExecutionSuccess read 1.000 for all of them.
  const nothingRan = { reportedVerdict: null, automationFailureReported: null } as const;
  const report = aggregate(2, [
    result("W01", [run(0), run(1)]),
    result("W04", [run(0, { scenarioId: "product-catalog", ...nothingRan }), run(1, { scenarioId: "product-catalog", ...nothingRan })]),
    result("W07", [run(0, { scenarioId: "data-table", ...nothingRan }), run(1, { scenarioId: "data-table", ...nothingRan })]),
  ]);
  const { rates } = report.metrics;
  // One of three first runs executed and reported success. The denominator is
  // still three: the two rows that executed nothing are counted, not dropped.
  assert.deepEqual(rates.initialExecutionSuccess, { count: 1, total: 3, workflows: 3, rate: 1 / 3 });
  assert.deepEqual(rates.deterministicReplaySuccess, { count: 1, total: 3, workflows: 3, rate: 1 / 3 });
  // Every row still passes as a test, which is exactly why the rate must not follow the verdict.
  assert.deepEqual(report.workflows.map((workflow) => workflow.flakeClass), ["stable-pass", "stable-pass", "stable-pass"]);
  // falseFailure and falseSuccess already required a verdict, and still exclude these runs from their populations.
  assert.deepEqual([rates.falseFailure.total, rates.falseSuccess.total], [2, 0]);
});

test("the not-executed count is reported: in total, per run, and per rate population", () => {
  const nothingRan = { reportedVerdict: null, automationFailureReported: null } as const;
  const results = [
    result("W01", [run(0, { actions: [{ actionType: "web.dom.type", durationMs: 100 }, { actionType: "web.browser.navigate", durationMs: 90 }] }), run(1, { actions: [{ actionType: "web.dom.type", durationMs: 120 }] })]),
    result("W04", [run(0, { scenarioId: "product-catalog", ...nothingRan }), run(1, { scenarioId: "product-catalog", ...nothingRan })]),
  ];
  const coverage = benchExecutionCoverage(results);
  assert.deepEqual([coverage.runs, coverage.executedRuns, coverage.notExecutedRuns, coverage.actions], [4, 2, 2, 3]);
  // Each rate's own population, so a reader can recover the conditional rate over the runs that executed.
  assert.equal(coverage.notExecutedByMetric.initialExecutionSuccess, 1);
  assert.equal(coverage.notExecutedByMetric.deterministicReplaySuccess, 1);
  assert.equal(coverage.notExecutedByMetric.harnessActivation, 2);
  assert.equal(coverage.notExecutedByMetric.falseFailure, 0);
  assert.deepEqual([executedNothing(results[1]!.evaluations[0]!), actionsExecuted(results[0]!.evaluations[0]!)], [true, 2]);
  // report.json states the same two totals, so the disclosure survives the
  // terminal scrolling away and a later bench can be compared against it.
  // Both are read from the one counting rule, so they cannot drift apart.
  const { metrics } = aggregate(2, results);
  assert.deepEqual([metrics.notExecutedRuns, metrics.actionsExecuted], [coverage.notExecutedRuns, coverage.actions]);
  assert.deepEqual([metrics.notExecutedRuns, metrics.actionsExecuted], [2, 3]);
  assert.equal(Object.values(metrics.actionLatencyMs).reduce((sum, distribution) => sum + distribution.samples, 0), metrics.actionsExecuted);
});

test("classification accuracy misses when FluxIQ reported no failure, and never scores absent against absent", () => {
  const expected = { automationFailureExpected: { category: "auth_required" } } as const;
  const report = aggregate(1, [
    result("W19", [run(0, { scenarioId: "auth-gate", variantId: "expired", lane: "flow", flowCreated: true, ...expected, reportedVerdict: "failed", automationFailureReported: { category: "auth_required" } })]),
    // The Flow ran but reported nothing: expected a category, reported none.
    result("W14", [run(0, { scenarioId: "modal-flows", variantId: "armed", lane: "flow", flowCreated: true, ...expected, reportedVerdict: null, automationFailureReported: null })]),
  ]);
  assert.deepEqual(report.metrics.rates.failureClassificationAccuracy, { count: 1, total: 2, workflows: 2, rate: 0.5 });
});

test("distributions use the nearest rank", () => {
  assert.deepEqual(benchDistribution([]), { samples: 0, p50: null, p95: null });
  assert.deepEqual(benchDistribution([7]), { samples: 1, p50: 7, p95: 7 });
  assert.deepEqual(benchDistribution([40, 10, 30, 20]), { samples: 4, p50: 20, p95: 40 });
  assert.deepEqual(benchDistribution(Array.from({ length: 20 }, (_, index) => index + 1)), { samples: 20, p50: 10, p95: 19 });
});

test("a result needs one run per repeat; runs group by row and identity in first-run order", () => {
  assert.throws(() => aggregate(2, [result("W01", [run(0)])]), /1 runs, not the bench's 2/);
  assert.throws(() => aggregate(2, [result("W01", [run(0), run(0)])]), /repeats a repeat index/);
  const grouped = groupBenchResults([
    { corpusRowId: "W28", evaluation: run(1, { scenarioId: "iframe-checkout" }) },
    { corpusRowId: "W01", evaluation: run(0) },
    { corpusRowId: "W28", evaluation: run(0, { scenarioId: "iframe-checkout" }) },
  ]);
  assert.deepEqual(grouped.map((group) => [group.corpusRowId, group.evaluations.map((evaluation) => evaluation.repeatIndex)]), [["W28", [0, 1]], ["W01", [0]]]);
});
