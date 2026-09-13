import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { BenchReport, RunEvaluation } from "@fluxiq-web-extension/test-contracts";
import { aggregateBenchReport, groupBenchResults } from "../aggregate-report.js";
import { benchHalves, compareBenchCommand, summarizeBenchComparison } from "../compare-reports.js";
import { benchDirectory, writeBenchReport, writeBenchRuns, writeRunEvaluation, type BenchRunsFile } from "../report-store.js";

type CorpusRun = { corpusRowId: string; evaluation: RunEvaluation };
const run = (scenarioId: string, repeatIndex: number, fields: Partial<RunEvaluation> = {}): RunEvaluation => ({
  schemaVersion: "0.1", runId: `run-${scenarioId}-${repeatIndex}`, verdict: "passed", invariants: [], metrics: {},
  scenarioId, workflowId: null, variantId: null, repeatIndex, lane: "recording", flowCreated: null,
  oracleVerdict: "passed", reportedVerdict: "passed", automationFailureReported: null, automationFailureExpected: null,
  harnessActivations: 0, durationMs: 40_000, actions: [], evidence: { sanitizedPacketBytes: [], rawSnapshotBytes: [], truncationCount: 0 },
  llm: { mode: "disabled", profileId: null, calls: 0 },
  harnessRecovery: null, adaptationCost: null, adaptationValidation: null, adaptationPersistence: null, adaptationReuse: null,
  ...fields,
});
const failedFields: Partial<RunEvaluation> = { verdict: "failed", failureCategory: "runtime.behavior", oracleVerdict: "failed", invariants: [{ id: "runner-verdict", passed: false, expected: "passed", actual: "failed: runtime.behavior", evidenceSequences: [] }] };
const scenarios = ["basic-form", "iframe-checkout", "navigation", "dynamic-list"];
const corpusRuns = (repeatCount: number, fields: (scenarioId: string, repeatIndex: number) => Partial<RunEvaluation> = () => ({})): CorpusRun[] =>
  scenarios.flatMap((scenarioId, index) => Array.from({ length: repeatCount }, (_, repeatIndex) => ({ corpusRowId: `W0${index + 1}`, evaluation: run(scenarioId, repeatIndex, fields(scenarioId, repeatIndex)) })));
const bench = (reportId: string, repeatCount: number, runs: CorpusRun[]): BenchReport => aggregateBenchReport({ reportId, generatedAt: "2026-09-11T10:00:00.000Z", corpusId: "smoke", repeatCount, target: "isolated", results: groupBenchResults(runs) });

async function writeBench(runsDirectory: string, benchId: string, repeatCount: number, runs: CorpusRun[]): Promise<BenchReport> {
  const directory = benchDirectory(runsDirectory, benchId);
  const file: BenchRunsFile = { schemaVersion: "0.1", benchId, corpusId: "smoke", repeatCount, target: "isolated", lanes: ["recording"], startedAt: "2026-09-11T10:00:00.000Z", sources: {}, runs: [] };
  for (const { corpusRowId, evaluation } of runs) {
    file.runs.push({ corpusRowId, scenarioId: evaluation.scenarioId, workflowId: evaluation.workflowId, variantId: evaluation.variantId, repeatIndex: evaluation.repeatIndex, lane: evaluation.lane, status: "evaluated", runId: evaluation.runId, evaluation: await writeRunEvaluation(directory, evaluation), verdict: evaluation.verdict });
  }
  await writeBenchRuns(directory, file);
  const report = bench(benchId, repeatCount, runs);
  await writeBenchReport(directory, report);
  return report;
}

test("matching reports are equivalent; a rate off by more than one workflow regresses; run duration is measured but does not set the verdict at four samples", () => {
  const baseline = bench("bench-base", 1, corpusRuns(1));
  const same = summarizeBenchComparison(baseline, bench("bench-same", 1, corpusRuns(1)));
  assert.deepEqual([same.baselineReportId, same.candidateReportId, same.outcome], ["bench-base", "bench-same", "equivalent"]);
  assert.ok(same.metrics.length > 0 && same.metrics.every((metric) => metric.outcome === "equivalent"));
  const oneFailed = summarizeBenchComparison(baseline, bench("bench-one-worse", 1, corpusRuns(1, (scenarioId) => scenarioId === "basic-form" ? failedFields : {})));
  assert.equal(oneFailed.metrics.find((metric) => metric.metric === "rate:recording:initialExecutionSuccess")?.outcome, "equivalent");
  const twoFailed = summarizeBenchComparison(baseline, bench("bench-two-worse", 1, corpusRuns(1, (scenarioId) => scenarioId === "basic-form" || scenarioId === "navigation" ? failedFields : {})));
  assert.equal(twoFailed.outcome, "regressed");
  assert.deepEqual(twoFailed.metrics.find((metric) => metric.metric === "rate:recording:initialExecutionSuccess"), { metric: "rate:recording:initialExecutionSuccess", baseline: 1, candidate: 0.5, tolerance: 0.25, outcome: "regressed" });
  // Four run-duration samples: still compared and still reported as improved,
  // but advisory, so it does not move the comparison's own verdict.
  const faster = summarizeBenchComparison(baseline, bench("bench-fast", 1, corpusRuns(1, () => ({ durationMs: 28_000 }))));
  assert.deepEqual(faster.metrics.find((metric) => metric.metric === "run-duration-p95"), { metric: "run-duration-p95", baseline: 40_000, candidate: 28_000, tolerance: 10_000, outcome: "improved" });
  assert.deepEqual([faster.outcome, faster.advisory], ["equivalent", ["run-duration-p95"]]);
});

/**
 * The gate that fired on noise. `run-duration-p95` is nearest-rank p95, which
 * is the maximum observation until 20 samples, and the eight historical smoke
 * reports (four runs each) breach the contract's +/-25% tolerance against each
 * other in 24 of their 56 ordered pairs. Below 20 samples it is measured and
 * reported; it gates nothing. At 20 it gates again, and the per-action
 * latencies -- 0 of those same 56 pairs breach -- gate throughout.
 */
test("run duration gates only from 20 samples up, and never silences the action latencies", () => {
  const slow = (): Partial<RunEvaluation> => ({ durationMs: 90_000 });
  const fourSamples = summarizeBenchComparison(bench("bench-base", 1, corpusRuns(1)), bench("bench-slow", 1, corpusRuns(1, slow)));
  assert.equal(fourSamples.metrics.find((metric) => metric.metric === "run-duration-p95")?.outcome, "regressed");
  assert.deepEqual([fourSamples.outcome, fourSamples.advisory], ["equivalent", ["run-duration-p95"]]);

  // 4 scenarios x 5 repeats = 20 run-duration samples on each side.
  const twentySamples = summarizeBenchComparison(bench("bench-base-20", 5, corpusRuns(5)), bench("bench-slow-20", 5, corpusRuns(5, slow)));
  assert.deepEqual([twentySamples.outcome, twentySamples.advisory], ["regressed", []]);

  // One side short of 20 is still not enough to gate on.
  const mixed = summarizeBenchComparison(bench("bench-base-20b", 5, corpusRuns(5)), bench("bench-slow-4", 1, corpusRuns(1, slow)));
  assert.deepEqual([mixed.outcome, mixed.advisory], ["equivalent", ["run-duration-p95"]]);

  // An action that got slower still regresses at four samples: only run
  // duration was set aside, and only because it cannot discriminate there.
  const slowAction = (): Partial<RunEvaluation> => ({ actions: [{ actionType: "web.dom.type", durationMs: 9_000 }] });
  const baseAction = (): Partial<RunEvaluation> => ({ actions: [{ actionType: "web.dom.type", durationMs: 1_500 }] });
  const latency = summarizeBenchComparison(bench("bench-base-a", 1, corpusRuns(1, baseAction)), bench("bench-slow-a", 1, corpusRuns(1, slowAction)));
  assert.equal(latency.metrics.find((metric) => metric.metric === "action-latency-p95:web.dom.type")?.outcome, "regressed");
  assert.deepEqual([latency.outcome, latency.advisory], ["regressed", ["run-duration-p95"]]);
});

test("a two-repeat bench's halves compare as equivalent; reports load by bench id, report path, or bench directory", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-bench-compare-"));
  try {
    const runsDirectory = path.join(root, "runs");
    const first = await writeBench(runsDirectory, "bench-mtx00001-0123abcd", 2, corpusRuns(2, (_, repeatIndex) => ({ durationMs: repeatIndex === 0 ? 40_000 : 42_000 })));
    const halves = await compareBenchCommand({ runsDirectory, cwd: root, halvesOf: first.reportId });
    assert.deepEqual([halves.baselineReportId, halves.candidateReportId, halves.outcome], ["bench-mtx00001-0123abcd-first-half", "bench-mtx00001-0123abcd-second-half", "equivalent"]);
    assert.ok(halves.metrics.some((metric) => metric.metric === "rate:recording:initialExecutionSuccess"));
    assert.ok(halves.metrics.some((metric) => metric.metric === "run-duration-p95"));
    await writeBench(runsDirectory, "bench-mtx00002-4567cdef", 2, corpusRuns(2));
    const byPath = await compareBenchCommand({ runsDirectory, cwd: root, baseline: path.join("runs", "bench", first.reportId, "report.json"), candidate: "bench-mtx00002-4567cdef" });
    assert.deepEqual([byPath.baselineReportId, byPath.outcome], [first.reportId, "equivalent"]);
    const byDirectory = await compareBenchCommand({ runsDirectory, cwd: root, baseline: path.join(runsDirectory, "bench", first.reportId), candidate: "bench-mtx00002-4567cdef" });
    assert.equal(byDirectory.outcome, "equivalent");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("halves need two repeats; an unknown report and a report compared with itself are refused", async () => {
  const one = bench("bench-one", 1, corpusRuns(1));
  assert.throws(() => benchHalves(one, groupBenchResults(corpusRuns(1))), /at least 2/);
  assert.throws(() => summarizeBenchComparison(one, one), /itself/);
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-bench-compare-"));
  try {
    await assert.rejects(compareBenchCommand({ runsDirectory: root, cwd: root, baseline: "bench-zzz00000-00000000", candidate: "bench-zzz00001-00000000" }), /Bench report not found/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
