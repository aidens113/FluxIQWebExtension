import { compareBenchReports, type BenchComparison, type BenchComparisonOutcome, type BenchReport } from "@fluxiq-web-extension/test-contracts";
import { aggregateBenchReport, type BenchResultRuns } from "./aggregate-report.js";
import { loadBenchReport, loadBenchResults } from "./load-report.js";

/**
 * A candidate report against a baseline. `outcome` is `regressed` if any
 * **gating** metric regressed, else `improved` if any improved, else
 * `equivalent`; `advisory` names the compared metrics that were left out of
 * that verdict and must be read rather than gated on.
 */
export type BenchCompareOutput = BenchComparison & { candidateReportId: string; outcome: BenchComparisonOutcome; advisory: string[] };

const RUN_DURATION_P95 = "run-duration-p95";

/**
 * Nearest-rank p95 (`benchDistribution`) returns the **maximum** observation
 * until a distribution has 20 samples: its index is `ceil(0.95n) - 1`, and
 * `ceil(0.95n) < n` first holds at `n = 20`. Below that, "p95" is one worst
 * run, not a percentile.
 */
const P95_MINIMUM_SAMPLES = 20;

/**
 * Metrics this comparison measured, reported, and refused to gate on.
 *
 * Only `run-duration-p95`, and only below `P95_MINIMUM_SAMPLES`. The eight
 * historical `smoke` reports on disk, four runs each, settle it: their
 * `run-duration-p95` values are 44364, 56431, 57213, 61395, 62678, 67894,
 * 73898 and 91457 ms -- a 2.06x range, in which **24 of the 56 ordered
 * baseline pairs (43%) breach the contract's own +/-25% tolerance against each
 * other**, before any candidate exists. A gate that calls 43% of its own
 * history a regression fires on machine load, and a gate that fires on noise
 * teaches people to ignore gates.
 *
 * The same tolerance on the same eight reports discriminates perfectly for the
 * per-action latencies, which stay gating: `web.browser.navigate` spans
 * 1654-1798 ms (1.09x) and `web.dom.type` 1397-1626 ms (1.16x), and **0 of 56
 * pairs breach for either**. The difference is what each number contains. A
 * run's duration is browser launch, Turbopack compile, Core boot, the scenario
 * and teardown on a machine shared with other Lab instances; one action's
 * latency is dispatch to settle. Only the second is about the product.
 *
 * This narrows the verdict, never the measurement: the metric is still
 * compared, still carries its own `outcome`, and still appears in `metrics`,
 * so a reader who wants it has it and the eight baselines stay comparable.
 */
function advisoryMetrics(baseline: BenchReport, candidate: BenchReport): Set<string> {
  const samples = Math.min(baseline.metrics.runDurationMs.samples, candidate.metrics.runDurationMs.samples);
  return samples >= P95_MINIMUM_SAMPLES ? new Set() : new Set([RUN_DURATION_P95]);
}

/** Two report references, or one whose repeats are split into halves. */
export type CompareBenchRequest = { runsDirectory: string; cwd: string } & ({ baseline: string; candidate: string } | { halvesOf: string });

/** Compares every metric both reports measured under the contract's tolerances (`compareBenchReports`). */
export function summarizeBenchComparison(baseline: BenchReport, candidate: BenchReport): BenchCompareOutput {
  const comparison = compareBenchReports(baseline, candidate);
  if (comparison.metrics.length === 0) throw new Error(`Bench reports ${baseline.reportId} and ${candidate.reportId} share no measured metric`);
  const excluded = advisoryMetrics(baseline, candidate);
  const advisory = comparison.metrics.filter((metric) => excluded.has(metric.metric)).map((metric) => metric.metric);
  const outcomes = new Set(comparison.metrics.filter((metric) => !excluded.has(metric.metric)).map((metric) => metric.outcome));
  const outcome: BenchComparisonOutcome = outcomes.has("regressed") ? "regressed" : outcomes.has("improved") ? "improved" : "equivalent";
  return { baselineReportId: comparison.baselineReportId, candidateReportId: candidate.reportId, outcome, advisory, metrics: comparison.metrics };
}

/**
 * Splits a bench's repeats into halves, the first ceil(N/2) and the rest, and
 * aggregates each as a bench of its own, so a report's repeats can be compared
 * with each other. Each half's earliest repeat counts as its initial execution.
 */
export function benchHalves(report: BenchReport, results: readonly BenchResultRuns[]): [BenchReport, BenchReport] {
  if (report.repeatCount < 2) throw new Error(`Bench ${report.reportId} ran ${report.repeatCount} repeat; comparing halves needs at least 2`);
  if (results.length !== report.workflows.length) throw new Error(`Bench ${report.reportId} lists ${report.workflows.length} results, but its runs group into ${results.length}`);
  const split = Math.ceil(report.repeatCount / 2);
  const half = (suffix: string, from: number, to: number): BenchReport => aggregateBenchReport({
    reportId: `${report.reportId}-${suffix}`,
    generatedAt: report.generatedAt,
    corpusId: report.corpusId,
    repeatCount: to - from,
    target: report.target,
    results: results.map((result) => ({ ...result, evaluations: result.evaluations.filter((evaluation) => evaluation.repeatIndex >= from && evaluation.repeatIndex < to) })),
  });
  return [half("first-half", 0, split), half("second-half", split, report.repeatCount)];
}

/** `lab compare`: a candidate report against a baseline, or one report's second half against its first. */
export async function compareBenchCommand(request: CompareBenchRequest): Promise<BenchCompareOutput> {
  if ("halvesOf" in request) {
    const { report, directory } = await loadBenchReport(request.halvesOf, request.runsDirectory, request.cwd);
    const [first, second] = benchHalves(report, await loadBenchResults(directory));
    return summarizeBenchComparison(first, second);
  }
  const baseline = await loadBenchReport(request.baseline, request.runsDirectory, request.cwd);
  const candidate = await loadBenchReport(request.candidate, request.runsDirectory, request.cwd);
  return summarizeBenchComparison(baseline.report, candidate.report);
}
