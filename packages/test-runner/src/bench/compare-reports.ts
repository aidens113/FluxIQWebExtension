import { compareBenchReports, type BenchComparison, type BenchComparisonOutcome, type BenchReport } from "@fluxiq-web-extension/test-contracts";
import { aggregateBenchReport, type BenchResultRuns } from "./aggregate-report.js";
import { loadBenchReport, loadBenchResults } from "./load-report.js";

/** A candidate report against a baseline, with an overall outcome: `regressed` if any metric regressed, else `improved` if any improved, else `equivalent`. */
export type BenchCompareOutput = BenchComparison & { candidateReportId: string; outcome: BenchComparisonOutcome };

/** Two report references, or one whose repeats are split into halves. */
export type CompareBenchRequest = { runsDirectory: string; cwd: string } & ({ baseline: string; candidate: string } | { halvesOf: string });

/** Compares every metric both reports measured under the contract's tolerances (`compareBenchReports`). */
export function summarizeBenchComparison(baseline: BenchReport, candidate: BenchReport): BenchCompareOutput {
  const comparison = compareBenchReports(baseline, candidate);
  if (comparison.metrics.length === 0) throw new Error(`Bench reports ${baseline.reportId} and ${candidate.reportId} share no measured metric`);
  const outcomes = new Set(comparison.metrics.map((metric) => metric.outcome));
  const outcome: BenchComparisonOutcome = outcomes.has("regressed") ? "regressed" : outcomes.has("improved") ? "improved" : "equivalent";
  return { baselineReportId: comparison.baselineReportId, candidateReportId: candidate.reportId, outcome, metrics: comparison.metrics };
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
