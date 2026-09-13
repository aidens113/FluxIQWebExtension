import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { BenchReport, RunEvaluation } from "@fluxiq-web-extension/test-contracts";
import { aggregateBenchReport, groupBenchResults } from "../aggregate-report.js";
import { benchHalves, compareBenchCommand, summarizeBenchComparison } from "../compare-reports.js";
import { compareBenchCloseoutCommand } from "../closeout-comparison.js";
import { comparisonExitCriteria } from "../comparison-details.js";
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
    file.runs.push({ corpusRowId, scenarioId: evaluation.scenarioId, workflowId: evaluation.workflowId, variantId: evaluation.variantId, repeatIndex: evaluation.repeatIndex, lane: evaluation.lane, status: "evaluated", runId: evaluation.runId, evaluation: await writeRunEvaluation(directory, evaluation), verdict: evaluation.verdict, ...(evaluation.failureCategory ? { failureCategory: evaluation.failureCategory } : {}) });
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

test("closeout comparison renders metrics, six criteria, changed rows, gaps, and count-only discard diagnostics", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-bench-closeout-"));
  try {
    const runsDirectory = path.join(root, "runs");
    await writeBench(runsDirectory, "bench-mtx00001-0123abcd", 1, corpusRuns(1));
    const unchanged = await writeBench(runsDirectory, "bench-mtx00002-4567cdef", 1, corpusRuns(1, (scenarioId, repeatIndex) => ({ runId: `run-candidate-${scenarioId}-${repeatIndex}` })));
    const equal = await compareBenchCloseoutCommand({ runsDirectory, cwd: root, baseline: "bench-mtx00001-0123abcd", candidate: unchanged.reportId, sharedLoad: true });
    assert.equal(equal.outcome, "equivalent");
    assert.equal(equal.comparisonPassed, true);
    assert.deepEqual([equal.differingVerdicts.results.length, equal.differingVerdicts.runs.length], [0, 0]);
    assert.deepEqual(equal.exitCriteria.map(item => item.criterion), [1, 2, 3, 4, 5, 6]);
    assert.equal(equal.exitCriteria[0]?.status, "partially-measured");
    assert.match(equal.exitCriteria[4]?.note ?? "", /shared load/);
    assert.equal(equal.metrics.filter(item => item.metric.startsWith("rate:")).length, 16);
    assert.ok(equal.metrics.some(item => item.metric === "evidence-sanitizedPacketBytes-p95" && item.verdict === "no-tolerance-stated"));
    assert.ok(equal.gaps.some(item => item.includes("no tolerance stated")));

    const changedRuns = corpusRuns(1, (scenarioId, repeatIndex) => scenarioId === "basic-form" ? { ...failedFields, failureCategory: "recording.persistence", runId: "run-persistence-0" } : { runId: `run-changed-${scenarioId}-${repeatIndex}` });
    const changed = await writeBench(runsDirectory, "bench-mtx00003-89abcdef", 1, changedRuns);
    const runDirectory = path.join(runsDirectory, "run-persistence-0");
    await mkdir(runDirectory, { recursive: true });
    const discardEvent = JSON.stringify({ message: "SECRET PAGE TEXT", details: { recordingDiscards: [{ type: "recording.action_discarded", recordingId: "recording-secret-id", discardedActions: 2, discardedEvents: 3, sinceFinalizedMs: 4 }], recordingDiscardWindow: { excluded: { "recording.action_discarded": { thisRunsRecording: 1, noRecording: 0, anotherRecording: 0 } } } } });
    await writeFile(path.join(runDirectory, "events.ndjson"), `${discardEvent}\n${discardEvent}\n`, "utf8");
    const output = await compareBenchCloseoutCommand({ runsDirectory, cwd: root, baseline: "bench-mtx00001-0123abcd", candidate: changed.reportId, sharedLoad: false });
    assert.equal(output.comparisonPassed, false);
    assert.deepEqual([output.differingVerdicts.results.length, output.differingVerdicts.runs.length], [1, 1]);
    assert.deepEqual(output.persistenceDiscards.candidate, { persistenceFailures: 1, runsInspected: 1, actionDiscardEntries: 1, eventDiscardEntries: 0, maxDiscardedActions: 2, maxDiscardedEvents: 3, entriesNamingRecording: 1, entriesAfterFinalization: 1, excludedByWindow: 1, unreadableEventFiles: 0 });
    assert.doesNotMatch(JSON.stringify(output), /SECRET PAGE TEXT|recording-secret-id/);
    assert.match(output.exitCriteria[4]?.note ?? "", /sequentially/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("fallback criterion excludes W26 negative variants, requires zero harness use, and marks short repeats partial", () => {
  const rows: CorpusRun[] = [
    { corpusRowId: "W20", evaluation: run("identity-drift", 0, { variantId: "selector-only", lane: "flow", harnessActivations: 1 }) },
    { corpusRowId: "W20", evaluation: run("identity-drift", 0, { variantId: "selector-only", lane: "recording" }) },
    { corpusRowId: "W26", evaluation: run("ambiguous-targets", 0, { lane: "flow" }) },
    { corpusRowId: "W26", evaluation: run("ambiguous-targets", 0, { variantId: "no-context", lane: "flow", verdict: "failed", automationFailureExpected: { category: "target_ambiguous" }, reportedVerdict: "failed", automationFailureReported: { category: "target_ambiguous" } }) },
  ];
  const report = bench("bench-fallback-a", 1, rows);
  const figures = comparisonExitCriteria(report, bench("bench-fallback-b", 1, rows), groupBenchResults(rows), groupBenchResults(rows), [], { results: [], runs: [] }, false);
  assert.deepEqual(figures[2], { criterion: 3, name: "deterministic-fallback", baseline: { recoveredWithoutHarness: 1, total: 2, repeatCount: 1 }, candidate: { recoveredWithoutHarness: 1, total: 2, repeatCount: 1 }, status: "partially-measured", note: "W20-W23 drift variants and unarmed contextual W26 only; every repeat must pass with zero harness activations" });
});

test("comparison fails when one report lacks a comparable metric, while N/A and disclosure rows do not block a complete repeat-three comparison", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-bench-metric-coverage-"));
  try {
    const runsDirectory = path.join(root, "runs");
    const actionRuns = corpusRuns(3, () => ({ actions: [{ actionType: "web.dom.type", durationMs: 100 }] }));
    const noActionRuns = corpusRuns(3);
    await writeBench(runsDirectory, "bench-mtx00001-0123abcd", 3, actionRuns);
    await writeBench(runsDirectory, "bench-mtx00002-4567cdef", 3, noActionRuns);
    await writeBench(runsDirectory, "bench-mtx00003-89abcdef", 3, corpusRuns(3, (scenarioId, repeatIndex) => ({ runId: `run-equal-${scenarioId}-${repeatIndex}` })));
    const missing = await compareBenchCloseoutCommand({ runsDirectory, cwd: root, baseline: "bench-mtx00001-0123abcd", candidate: "bench-mtx00002-4567cdef", sharedLoad: false });
    assert.equal(missing.comparisonPassed, false);
    assert.deepEqual(missing.metrics.find(row => row.metric === "action-latency-p95:web.dom.type")?.verdict, "not-compared");
    assert.equal(missing.exitCriteria[4]?.status, "partially-measured");

    const complete = await compareBenchCloseoutCommand({ runsDirectory, cwd: root, baseline: "bench-mtx00002-4567cdef", candidate: "bench-mtx00003-89abcdef", sharedLoad: false });
    assert.equal(complete.comparisonPassed, true);
    assert.ok(complete.metrics.some(row => row.metric === "rate:flow:initialExecutionSuccess" && row.verdict === "not-applicable"));
    assert.ok(complete.metrics.some(row => row.metric === "evidence-sanitizedPacketBytes-p95" && row.verdict === "no-tolerance-stated"));
    assert.equal(complete.exitCriteria[4]?.status, "measured");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("closeout comparison rejects a report whose runs file omits an evaluated repeat", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-bench-incomplete-"));
  try {
    const runsDirectory = path.join(root, "runs");
    await writeBench(runsDirectory, "bench-mtx00001-0123abcd", 1, corpusRuns(1));
    await writeBench(runsDirectory, "bench-mtx00002-4567cdef", 1, corpusRuns(1));
    const runsFile = path.join(runsDirectory, "bench", "bench-mtx00002-4567cdef", "runs.json");
    const parsed = JSON.parse(await readFile(runsFile, "utf8")) as BenchRunsFile;
    const first = parsed.runs[0];
    if (!first) throw new Error("fixture has no run");
    first.status = "skipped"; delete first.evaluation;
    await writeFile(runsFile, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
    await assert.rejects(compareBenchCloseoutCommand({ runsDirectory, cwd: root, baseline: "bench-mtx00001-0123abcd", candidate: "bench-mtx00002-4567cdef", sharedLoad: true }), /report lists 4 results but runs\.json provides 3 evaluated result groups/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
