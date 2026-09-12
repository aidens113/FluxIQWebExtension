import type { LlmUsage } from "./evaluation.js";
import type { FluxIQExecutionMetadata } from "./run.js";

export const BENCH_REPORT_SCHEMA_VERSION = "0.1" as const;

/** The Testing Lab targets a bench runs against (the runner's `--target`). */
export const benchTargets = ["isolated", "persistent-isolated", "existing", "clone"] as const satisfies readonly FluxIQExecutionMetadata["targetMode"][];
export type BenchTarget = (typeof benchTargets)[number];

/** How a workflow behaved across its repeats: every run passed, every run failed, or both happened. */
export const benchFlakeClasses = ["stable-pass", "stable-fail", "flaky"] as const;
export type BenchFlakeClass = (typeof benchFlakeClasses)[number];

/**
 * One rate per rate row of the Week 1 Metrics table. `falseSuccess` is the
 * inverse of `falseFailure`, reported separately.
 */
export const benchRateMetrics = [
  "flowCreationSuccess", "initialExecutionSuccess", "deterministicReplaySuccess", "fuzzyRecovery",
  "falseFailure", "falseSuccess", "failureClassificationAccuracy", "harnessActivation",
] as const;
export type BenchRateMetric = (typeof benchRateMetrics)[number];

/** The plan's repeatability tolerance: rates within one workflow of each other, latency p95 within 25%. */
export const BENCH_TOLERANCE: Readonly<{ rateWorkflows: number; latencyP95Ratio: number }> = Object.freeze({ rateWorkflows: 1, latencyP95Ratio: 0.25 });

export type BenchComparisonOutcome = "improved" | "regressed" | "equivalent";

/** One corpus row's workflow, primary or a variant, across the bench's repeats. */
export type BenchWorkflowResult = {
  /** The corpus row, such as `W05`. A row's workflow and each of its variants are separate results sharing it. */
  corpusRowId: string;
  scenarioId: string;
  /** `null` for the manifest's primary workflow. */
  workflowId: string | null;
  /** `null` for the unarmed workflow. */
  variantId: string | null;
  /** Always the report's `repeatCount`. */
  runs: number;
  /** Passing runs over `runs`. */
  passRate: number;
  /** `stable-pass` exactly when `passRate` is 1, `stable-fail` when it is 0, otherwise `flaky`. */
  flakeClass: BenchFlakeClass;
};

/**
 * `count` of `total`, in the unit its metric defines (workflows or runs), over
 * a population spanning `workflows` workflow results. `rate` is
 * `count / total`, or `null` when `total` is 0. The ±1-workflow tolerance is
 * `1 / workflows`.
 */
export type BenchRate = { count: number; total: number; workflows: number; rate: number | null };

/** p50 and p95 over `samples` values, both `null` when there are none. */
export type BenchDistribution = { samples: number; p50: number | null; p95: number | null };

/** The Week 1 Metrics table over the whole corpus. Units are in the field names. */
export type BenchCorpusMetrics = {
  rates: Record<BenchRateMetric, BenchRate>;
  /** Keyed by FluxIQ action type. */
  actionLatencyMs: Record<string, BenchDistribution>;
  runDurationMs: BenchDistribution;
  sanitizedPacketBytes: BenchDistribution;
  rawSnapshotBytes: BenchDistribution;
  truncationCount: number;
  /**
   * Evaluated runs in which FluxIQ executed no action at all.
   *
   * Every rate above counts such a run as a **miss**, never as an exclusion,
   * so a rate is only interpretable beside this number: a corpus whose
   * `notExecutedRuns` approaches its evaluated runs has measured the Testing
   * Lab driving a fixture and the fixture ending in the right state, not
   * FluxIQ executing a workflow. It is the one figure a later reader cannot
   * recover from anything else the report states.
   *
   * **Optional because it is absent, not zero, in a report written before the
   * field existed.** Zero says FluxIQ executed nothing anywhere; absent says
   * this bench did not measure it. Read it as `number | undefined` and say
   * "unmeasured"; never `?? 0`, which is the same class of untruth as the
   * predicate that counted an empty run as a success.
   */
  notExecutedRuns?: number;
  /**
   * Actions FluxIQ executed across every evaluated run — the only figure in
   * the report that says what FluxIQ itself did. Equals the sum of
   * `actionLatencyMs[*].samples`, which carry one sample per executed action.
   * Absent, not zero, in a report written before the field existed; see
   * `notExecutedRuns`.
   */
  actionsExecuted?: number;
  /** Week 2 measurements: `null` in Week 1, reserved so the schema is already present. */
  harnessRecovery: null;
  adaptationCost: null;
  adaptationValidation: null;
  adaptationPersistence: null;
  adaptationReuse: null;
};

/**
 * One metric against a baseline report. `metric` is `rate:<BenchRateMetric>`,
 * `action-latency-p95:<action type>`, or `run-duration-p95`. `candidate` is
 * this report's value; `tolerance` is the largest |candidate - baseline| still
 * `equivalent`: one workflow of this report's rate population, or 25% of the
 * baseline p95.
 */
export type BenchMetricComparison = { metric: string; baseline: number; candidate: number; tolerance: number; outcome: BenchComparisonOutcome };

/**
 * This report against an earlier report of the same corpus. Only metrics both
 * reports measured are compared. Evidence sizes are reported, not compared:
 * the plan sets no tolerance for them.
 */
export type BenchComparison = { baselineReportId: string; metrics: BenchMetricComparison[] };

export type BenchReport = {
  schemaVersion: typeof BENCH_REPORT_SCHEMA_VERSION;
  reportId: string;
  generatedAt: string;
  /** The corpus, such as `fluxbench-week1`; its rows are the results' `corpusRowId`s. */
  corpusId: string;
  repeatCount: number;
  target: BenchTarget;
  workflows: BenchWorkflowResult[];
  metrics: BenchCorpusMetrics;
  llm: LlmUsage;
  /** `null` when there is no baseline. */
  comparison: BenchComparison | null;
};

const RATE_PREFIX = "rate:";
const ACTION_LATENCY_PREFIX = "action-latency-p95:";
const RUN_DURATION = "run-duration-p95";
const EPSILON = 1e-9;
const lowerIsBetterRates: ReadonlySet<BenchRateMetric> = new Set<BenchRateMetric>(["falseFailure", "falseSuccess", "harnessActivation"]);

type MeasuredMetric = { value: number; lowerIsBetter: boolean; tolerance: (baseline: number) => number };

/**
 * Judges one metric of `candidate` against a baseline value under the plan's
 * tolerance. `undefined` when `candidate` did not measure `metric`.
 */
export function compareBenchMetric(metric: string, baseline: number, candidate: Pick<BenchReport, "metrics">): BenchMetricComparison | undefined {
  const measured = measure(metric, candidate.metrics);
  if (!measured) return undefined;
  const tolerance = measured.tolerance(baseline);
  const delta = measured.value - baseline;
  const outcome: BenchComparisonOutcome = Math.abs(delta) <= tolerance + EPSILON ? "equivalent" : (delta < 0) === measured.lowerIsBetter ? "improved" : "regressed";
  return { metric, baseline, candidate: measured.value, tolerance, outcome };
}

/** Compares every metric both reports measured: rates in table order, action types by name, then run duration. */
export function compareBenchReports(baseline: BenchReport, candidate: BenchReport): BenchComparison {
  if (baseline.corpusId !== candidate.corpusId) throw new Error(`Bench reports of different corpora cannot be compared: ${baseline.corpusId}, ${candidate.corpusId}`);
  if (baseline.reportId === candidate.reportId) throw new Error(`A bench report cannot be compared with itself: ${candidate.reportId}`);
  const metrics: BenchMetricComparison[] = [];
  const ids = [...benchRateMetrics.map((name) => RATE_PREFIX + name), ...Object.keys(candidate.metrics.actionLatencyMs).sort().map((type) => ACTION_LATENCY_PREFIX + type), RUN_DURATION];
  for (const metric of ids) {
    const base = measure(metric, baseline.metrics);
    const compared = base && compareBenchMetric(metric, base.value, candidate);
    if (compared) metrics.push(compared);
  }
  return { baselineReportId: baseline.reportId, metrics };
}

function measure(metric: string, metrics: BenchCorpusMetrics): MeasuredMetric | undefined {
  const latency = (p95: number | null | undefined): MeasuredMetric | undefined =>
    p95 === null || p95 === undefined ? undefined : { value: p95, lowerIsBetter: true, tolerance: (baseline) => BENCH_TOLERANCE.latencyP95Ratio * baseline };
  if (metric === RUN_DURATION) return latency(metrics.runDurationMs.p95);
  if (metric.startsWith(ACTION_LATENCY_PREFIX)) {
    const actionType = metric.slice(ACTION_LATENCY_PREFIX.length);
    return Object.hasOwn(metrics.actionLatencyMs, actionType) ? latency(metrics.actionLatencyMs[actionType]?.p95) : undefined;
  }
  const name = metric.slice(RATE_PREFIX.length);
  if (!metric.startsWith(RATE_PREFIX) || !isRateMetric(name)) return undefined;
  const { rate, workflows } = metrics.rates[name];
  return rate === null ? undefined : { value: rate, lowerIsBetter: lowerIsBetterRates.has(name), tolerance: () => BENCH_TOLERANCE.rateWorkflows / workflows };
}
const isRateMetric = (name: string): name is BenchRateMetric => (benchRateMetrics as readonly string[]).includes(name);
