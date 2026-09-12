import { benchRateMetrics, type BenchRateMetric } from "@fluxiq-web-extension/test-contracts";
// `executedNothing` and `actionsExecuted` are the per-run counting rules, and
// they live in `aggregate-report.ts` because `BenchCorpusMetrics` states their
// totals: one rule, so the report and this breakdown cannot disagree.
import { BENCH_RATE_DEFINITIONS, actionsExecuted, benchRatePopulation, executedNothing, type BenchResultRuns } from "./aggregate-report.js";

/**
 * What the bench's rates do not say on their own: how much of the corpus
 * FluxIQ actually executed.
 *
 * A recording-lane pass says the Testing Lab drove the fixture and the fixture
 * ended in the right state. It says nothing about FluxIQ executing the
 * workflow, and on that lane FluxIQ executes at most a two-action Core
 * round-trip probe, never the workflow itself. Reporting the action count per
 * run and in the aggregate is what stops a pass being read as evidence that
 * FluxIQ drove anything.
 */
export type BenchExecutionCoverage = {
  /** Runs evaluated. */
  runs: number;
  /** Runs in which FluxIQ executed at least one action and so reported a verdict. */
  executedRuns: number;
  /** Runs in which FluxIQ executed nothing. Each is a miss in every execution rate, never excluded from one. */
  notExecutedRuns: number;
  /** Actions FluxIQ executed across every evaluated run. */
  actions: number;
  /** Per rate metric: how many runs of that rate's own population executed nothing. */
  notExecutedByMetric: Readonly<Record<BenchRateMetric, number>>;
};

/** Measures execution coverage over the same results `aggregateBenchReport` aggregates. */
export function benchExecutionCoverage(results: readonly BenchResultRuns[]): BenchExecutionCoverage {
  const runs = results.flatMap((result) => result.evaluations);
  return {
    runs: runs.length,
    executedRuns: runs.filter((run) => !executedNothing(run)).length,
    notExecutedRuns: runs.filter(executedNothing).length,
    actions: runs.reduce((sum, run) => sum + actionsExecuted(run), 0),
    notExecutedByMetric: Object.fromEntries(benchRateMetrics.map((metric) => [
      metric,
      benchRatePopulation(results, BENCH_RATE_DEFINITIONS[metric]).filter(({ evaluation }) => executedNothing(evaluation)).length,
    ])) as Record<BenchRateMetric, number>,
  };
}
