import { evaluationLanes, type EvaluationLane, type LlmUsage } from "./evaluation.js";
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

/**
 * The extraction rates of one lane. Each is a `BenchRate` whose `count` and
 * `total` are in the unit its metric defines (records for record accuracy,
 * fields for field completeness, steps or runs for the rest), over the lane's
 * extraction steps. `extractionFalseSuccess` is lower-better. Each rate's unit
 * and population are published beside it in `report.md`
 * (`BENCH_EXTRACTION_RATE_DEFINITIONS`), because no two of them are counted
 * over the same steps.
 *
 * A rate whose population is empty reports `rate: null` -- a refusal to
 * publish a number, never a flattering one. `extractionRecordAccuracy` is
 * pooled over the lane's **compared** steps alone (Σ matched ÷ Σ max(expected,
 * observed)), and `extractionCountAccuracy` over its count-only steps alone;
 * a bench whose extraction steps all stated counts therefore states no record
 * accuracy at all, which is the truth about what it measured.
 */
export const benchExtractionRateMetrics = [
  "extractionRecordAccuracy", "extractionCountAccuracy", "extractionExactSuccess",
  "extractionFieldCompleteness", "paginationAccuracy", "extractionFalseSuccess",
] as const;
export type BenchExtractionRateMetric = (typeof benchExtractionRateMetrics)[number];

/** The plan's repeatability tolerance: rates within one workflow of each other, latency p95 within 25%. */
export const BENCH_TOLERANCE: Readonly<{ rateWorkflows: number; latencyP95Ratio: number }> = Object.freeze({ rateWorkflows: 1, latencyP95Ratio: 0.25 });

export type BenchComparisonOutcome = "improved" | "regressed" | "equivalent";

/** One corpus row's workflow, primary or a variant, on one lane, across the bench's repeats. */
export type BenchWorkflowResult = {
  /** The corpus row, such as `W05`. A row's workflow and each of its variants are separate results sharing it. */
  corpusRowId: string;
  scenarioId: string;
  /** `null` for the manifest's primary workflow. */
  workflowId: string | null;
  /** `null` for the unarmed workflow. */
  variantId: string | null;
  /**
   * The lane every run of this result ran on. An unarmed workflow runs on the
   * recording lane and on the Flow lane, and is one result on each, sharing
   * its row, scenario, workflow, and variant. Absent only in a report written
   * before lanes, where no result states one.
   */
  lane?: EvaluationLane;
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

/** Every rate of the Week 1 Metrics table, over one population of runs. */
export type BenchRates = Record<BenchRateMetric, BenchRate>;

/** p50 and p95 over `samples` values, both `null` when there are none. */
export type BenchDistribution = { samples: number; p50: number | null; p95: number | null };

/**
 * One lane's extraction measurements, aggregated from its runs'
 * `RunEvaluation.extraction`. Counts only (D6): no field name or value.
 */
export type BenchExtractionMetrics = {
  /** Extraction steps judged against the workflow's expectation. Always `comparedSteps + countOnlySteps + unjudgeableSteps`. */
  judgedSteps: number;
  /** Extraction steps measured without a judgement: not run, or run with no expectation. */
  unjudgedSteps: number;
  /**
   * Judged steps whose expectation listed the records, so their values were
   * compared. These are the **only** steps `extractionRecordAccuracy` pools,
   * and stating the number is what lets a reader see the basis of that rate
   * instead of trusting it.
   */
  comparedSteps: number;
  /**
   * Judged steps that stated a count and listed no records. Not one of their
   * values was compared, so pooling them into `extractionRecordAccuracy` would
   * score a perfect match for a step that judged nothing: they are excluded
   * from it and are the population of `extractionCountAccuracy` instead.
   */
  countOnlySteps: number;
  /**
   * Judged steps that listed no records and stated no count, so nothing in
   * them can be judged and they enter no rate. Stated rather than absorbed:
   * an expectation nothing can judge is a gap to see, not a silent pass
   * (the refusal `assertExtraction` raises for a `pages` or `truncated`
   * expectation nothing reported).
   */
  unjudgeableSteps: number;
  /** Each step's extraction duration. */
  extractionDurationMs: BenchDistribution;
  /** Each step's extraction duration over the pages it followed. */
  extractionMsPerPage: BenchDistribution;
} & Record<BenchExtractionRateMetric, BenchRate>;

/**
 * The Week 1 Metrics table over the whole corpus. Units are in the field
 * names. The rates are per lane; the distributions and counts cover every
 * evaluated run.
 */
export type BenchCorpusMetrics = {
  /**
   * The rates, **per lane and never combined**. An unarmed row runs on both
   * lanes, and the recording lane executes at most a two-action Core
   * round-trip probe, never the workflow: a rate over both lanes would count
   * each unarmed row twice and blend a measurement of the Testing Lab into one
   * of FluxIQ. A lane is present exactly when the report lists a result on it,
   * so a bench with no Flow-lane row states `recording` alone.
   *
   * Absent only in a report written before lanes, which states `rates`.
   */
  ratesByLane?: Partial<Record<EvaluationLane, BenchRates>>;
  /**
   * One set of rates over every result, as a report written before lanes
   * states them; never written now. Such a report that lists no variant ran
   * the recording lane alone, as all eight `smoke` benches on disk did, and its
   * rates compare as that lane's. One that lists a variant ran the Flow lane as
   * well, so its rates combine both lanes and compare as neither.
   */
  rates?: BenchRates;
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
  /**
   * Extraction, **per lane and never combined**, like `ratesByLane`; a lane is
   * stated only when the report lists results on it. Optional because it is
   * absent, not zero, in a report written before extraction was measured
   * (D7): read it as unmeasured. The schema version stays 0.1 because the block
   * is optional, as `notExecutedRuns` is.
   */
  extractionByLane?: Partial<Record<EvaluationLane, BenchExtractionMetrics>>;
  /**
   * Week 2 aggregates, still reserved: always `null`, and refused otherwise,
   * because no bench aggregates them yet. The per-run measurements they will
   * aggregate are typed on `RunEvaluation` (`harnessRecovery`, including each
   * patch attempt's verdict, and the four adaptation measurements in
   * `adaptation-reuse.ts`), and a bench keeps each run's evaluation beside
   * `runs.json`: read those, and never read a `null` here as a measurement of
   * zero. Defining an aggregate means defining it here, in its validator, in
   * the bench's comparison rows and in its rendering together.
   */
  harnessRecovery: null;
  adaptationCost: null;
  adaptationValidation: null;
  adaptationPersistence: null;
  adaptationReuse: null;
};

/**
 * One metric against a baseline report. `metric` is
 * `rate:<EvaluationLane>:<BenchRateMetric>`,
 * `extraction:<EvaluationLane>:<BenchExtractionRateMetric>`,
 * `action-latency-p95:<action type>`, or `run-duration-p95`. `candidate` is
 * this report's value; `tolerance` is the largest |candidate - baseline| still
 * `equivalent`: one workflow of this report's rate population on that lane,
 * which extraction's success rates share; one unit of an extraction accuracy
 * or completeness rate's population (one record, for record accuracy); or 25%
 * of the baseline p95. Extraction's distributions are reported, not compared.
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

/** What a comparison reads of a report: its metrics, and its results, which say which lane a report written before lanes ran. */
type ComparedReport = Pick<BenchReport, "metrics" | "workflows">;

const RATE_METRIC = /^rate:([a-z]+):([A-Za-z]+)$/u;
const EXTRACTION_METRIC = /^extraction:([a-z]+):([A-Za-z]+)$/u;
const ACTION_LATENCY_PREFIX = "action-latency-p95:";
const RUN_DURATION = "run-duration-p95";
const EPSILON = 1e-9;
/** An extraction accuracy or completeness rate is equivalent within one unit of its population: one record, for record accuracy. */
const EXTRACTION_ACCURACY_UNITS = 1;
const lowerIsBetterRates: ReadonlySet<BenchRateMetric> = new Set<BenchRateMetric>(["falseFailure", "falseSuccess", "harnessActivation"]);
/** Extraction rates judged per workflow, like the Metrics table's; the others are accuracies judged per unit. */
const extractionSuccessRates: ReadonlySet<BenchExtractionRateMetric> = new Set<BenchExtractionRateMetric>(["extractionExactSuccess", "extractionFalseSuccess"]);
const lowerIsBetterExtractionRates: ReadonlySet<BenchExtractionRateMetric> = new Set<BenchExtractionRateMetric>(["extractionFalseSuccess"]);

type MeasuredMetric = { value: number; lowerIsBetter: boolean; tolerance: (baseline: number) => number };

/**
 * Judges one metric of `candidate` against a baseline value under the plan's
 * tolerance. `undefined` when `candidate` did not measure `metric`.
 */
export function compareBenchMetric(metric: string, baseline: number, candidate: ComparedReport): BenchMetricComparison | undefined {
  const measured = measure(metric, candidate);
  if (!measured) return undefined;
  const tolerance = measured.tolerance(baseline);
  const delta = measured.value - baseline;
  const outcome: BenchComparisonOutcome = Math.abs(delta) <= tolerance + EPSILON ? "equivalent" : (delta < 0) === measured.lowerIsBetter ? "improved" : "regressed";
  return { metric, baseline, candidate: measured.value, tolerance, outcome };
}

/** Compares every metric both reports measured: each lane's rates in table order, each lane's extraction rates, action types by name, then run duration. */
export function compareBenchReports(baseline: BenchReport, candidate: BenchReport): BenchComparison {
  if (baseline.corpusId !== candidate.corpusId) throw new Error(`Bench reports of different corpora cannot be compared: ${baseline.corpusId}, ${candidate.corpusId}`);
  if (baseline.reportId === candidate.reportId) throw new Error(`A bench report cannot be compared with itself: ${candidate.reportId}`);
  const metrics: BenchMetricComparison[] = [];
  const rates = evaluationLanes.flatMap((lane) => benchRateMetrics.map((name) => `rate:${lane}:${name}`));
  const extraction = evaluationLanes.flatMap((lane) => benchExtractionRateMetrics.map((name) => `extraction:${lane}:${name}`));
  const ids = [...rates, ...extraction, ...Object.keys(candidate.metrics.actionLatencyMs).sort().map((type) => ACTION_LATENCY_PREFIX + type), RUN_DURATION];
  for (const metric of ids) {
    const base = measure(metric, baseline);
    const compared = base && compareBenchMetric(metric, base.value, candidate);
    if (compared) metrics.push(compared);
  }
  return { baselineReportId: baseline.reportId, metrics };
}

function measure(metric: string, report: ComparedReport): MeasuredMetric | undefined {
  const { metrics } = report;
  const latency = (p95: number | null | undefined): MeasuredMetric | undefined =>
    p95 === null || p95 === undefined ? undefined : { value: p95, lowerIsBetter: true, tolerance: (baseline) => BENCH_TOLERANCE.latencyP95Ratio * baseline };
  if (metric === RUN_DURATION) return latency(metrics.runDurationMs.p95);
  if (metric.startsWith(ACTION_LATENCY_PREFIX)) {
    const actionType = metric.slice(ACTION_LATENCY_PREFIX.length);
    return Object.hasOwn(metrics.actionLatencyMs, actionType) ? latency(metrics.actionLatencyMs[actionType]?.p95) : undefined;
  }
  const extraction = EXTRACTION_METRIC.exec(metric);
  if (extraction) return measureExtraction(report, extraction[1], extraction[2]);
  const match = RATE_METRIC.exec(metric);
  const lane = match?.[1];
  const name = match?.[2];
  if (!isLane(lane) || !isRateMetric(name)) return undefined;
  const measured = laneRates(report, lane)?.[name];
  if (!measured || measured.rate === null) return undefined;
  const { rate, workflows } = measured;
  return { value: rate, lowerIsBetter: lowerIsBetterRates.has(name), tolerance: () => BENCH_TOLERANCE.rateWorkflows / workflows };
}

/**
 * One extraction rate on one lane, or `undefined` when the report did not
 * measure it: no `extractionByLane`, as in a report written before extraction
 * was measured, no block for the lane, or an empty population.
 */
function measureExtraction(report: ComparedReport, lane: string | undefined, name: string | undefined): MeasuredMetric | undefined {
  const byLane = report.metrics.extractionByLane;
  if (!byLane || !isLane(lane) || !isExtractionRateMetric(name) || !Object.hasOwn(byLane, lane)) return undefined;
  const measured = byLane[lane]?.[name];
  if (!measured || measured.rate === null) return undefined;
  const { rate, total, workflows } = measured;
  const tolerance = extractionSuccessRates.has(name) ? () => BENCH_TOLERANCE.rateWorkflows / workflows : () => EXTRACTION_ACCURACY_UNITS / total;
  return { value: rate, lowerIsBetter: lowerIsBetterExtractionRates.has(name), tolerance };
}

/**
 * A report's rates on one lane, or `undefined` when it measured none there. A
 * report written before lanes states one set of rates and no lane: listing no
 * variant, it ran the recording lane alone and those rates are that lane's;
 * listing a variant, it ran the Flow lane as well, and rates combined over
 * both are neither lane's.
 */
function laneRates(report: ComparedReport, lane: EvaluationLane): BenchRates | undefined {
  const { ratesByLane, rates } = report.metrics;
  if (ratesByLane) return Object.hasOwn(ratesByLane, lane) ? ratesByLane[lane] : undefined;
  const recordingAlone = report.workflows.every((result) => result.lane === undefined && result.variantId === null);
  return lane === "recording" && recordingAlone ? rates : undefined;
}
const isRateMetric = (name: string | undefined): name is BenchRateMetric => name !== undefined && (benchRateMetrics as readonly string[]).includes(name);
const isExtractionRateMetric = (name: string | undefined): name is BenchExtractionRateMetric => name !== undefined && (benchExtractionRateMetrics as readonly string[]).includes(name);
const isLane = (name: string | undefined): name is EvaluationLane => name !== undefined && (evaluationLanes as readonly string[]).includes(name);
