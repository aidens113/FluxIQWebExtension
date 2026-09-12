import {
  BENCH_REPORT_SCHEMA_VERSION, assertBenchReport, benchRateMetrics,
  type BenchCorpusMetrics, type BenchRate, type BenchRateMetric, type BenchReport, type BenchTarget, type BenchWorkflowResult, type LlmUsage, type RunEvaluation,
} from "@fluxiq-web-extension/test-contracts";
import { benchDistribution } from "./distribution.js";

/** One bench result, a corpus row's workflow unarmed or one of its variants, with the evaluations of its runs. */
export type BenchResultRuns = {
  corpusRowId: string;
  scenarioId: string;
  workflowId: string | null;
  variantId: string | null;
  /** Ordered by `repeatIndex`. */
  evaluations: readonly RunEvaluation[];
};

export type AggregateBenchInput = {
  reportId: string;
  generatedAt: string;
  corpusId: string;
  repeatCount: number;
  target: BenchTarget;
  results: readonly BenchResultRuns[];
};

/**
 * How one Metrics-table rate is counted. `applies` selects the rate's
 * population; `first` is whether the run is its result's earliest repeat, its
 * initial execution. `hit` is what the rate counts within that population.
 */
export type BenchRateDefinition = {
  unit: "workflows" | "runs";
  definition: string;
  applies: (evaluation: RunEvaluation, first: boolean) => boolean;
  hit: (evaluation: RunEvaluation) => boolean;
};

/** A positive run expects success; a negative run carries `expected.failure` and is judged by classification. */
const positive = (evaluation: RunEvaluation): boolean => evaluation.automationFailureExpected === null;
/**
 * The runner passed the run, the fixture oracle passed, and **FluxIQ executed
 * and reported success**.
 *
 * `reportedVerdict === "passed"`, not `!== "failed"`. A run in which FluxIQ
 * executed no action reports `null`, and the earlier `!== "failed"` counted
 * that as an execution success: on the week1 corpus 16 of 23 runnable rows
 * execute nothing through FluxIQ, so `initialExecutionSuccess` read 1.000 for
 * a corpus two thirds of which measured only that Playwright drove a fixture
 * and the fixture ended in the right state.
 *
 * Such a run is counted as a **miss**, not excluded from the population.
 * Excluding it would shrink the denominator silently, which is the same
 * untruth one step further from the reader; a miss moves the headline number
 * itself. `benchExecutionCoverage` reports how many of each rate's population
 * executed nothing, so the conditional rate over the rows that did execute is
 * still recoverable — from stated numbers rather than from a hidden one.
 */
const executed = (evaluation: RunEvaluation): boolean => evaluation.verdict === "passed" && evaluation.oracleVerdict === "passed" && evaluation.reportedVerdict === "passed";

/**
 * Whether FluxIQ executed nothing in a run. `reportedVerdict` is `null`
 * exactly when FluxIQ ran no action, so there is no execution to judge: on the
 * recording lane because the Core round-trip probe was not applicable to the
 * workflow, and on the Flow lane because no runnable Flow was produced.
 *
 * It lives here, beside the rate definitions, because it is the counting rule
 * the rates and the report's `notExecutedRuns` must share; stating it twice is
 * how the two would come to disagree. `execution-coverage.ts` builds the
 * per-rate breakdown on top of it and so depends on this module, not the
 * reverse.
 */
export const executedNothing = (evaluation: RunEvaluation): boolean => evaluation.reportedVerdict === null;

/**
 * How many actions FluxIQ executed in a run. `RunEvaluation.actions` is every
 * executed action the run manifest timed, so an action that was dispatched and
 * never finished is not counted; a run with a dispatched action still reports a
 * verdict, so `executedNothing` and a zero count are not the same statement.
 */
export const actionsExecuted = (evaluation: RunEvaluation): number => evaluation.actions.length;

/** The Week 1 Metrics table's rates, each with its unit and population. */
export const BENCH_RATE_DEFINITIONS: Readonly<Record<BenchRateMetric, BenchRateDefinition>> = {
  flowCreationSuccess: {
    unit: "workflows", definition: "each result's first run on the flow lane: recording, proposal, and approval produced a runnable Flow",
    applies: (evaluation, first) => first && evaluation.lane === "flow", hit: (evaluation) => evaluation.flowCreated === true,
  },
  initialExecutionSuccess: {
    unit: "workflows", definition: "each positive result's first run: the runner passed, the oracle passed, and FluxIQ executed and reported success. A run in which FluxIQ executed nothing is a miss, not an exclusion",
    applies: (evaluation, first) => first && positive(evaluation), hit: executed,
  },
  deterministicReplaySuccess: {
    unit: "runs", definition: "each positive result's later runs, provider-free, succeeding as a first run must",
    applies: (evaluation, first) => !first && positive(evaluation), hit: executed,
  },
  fuzzyRecovery: {
    unit: "runs", definition: "runs of armed variants that expect success, succeeding with no harness activation",
    applies: (evaluation) => evaluation.variantId !== null && positive(evaluation), hit: (evaluation) => executed(evaluation) && evaluation.harnessActivations === 0,
  },
  falseFailure: {
    unit: "runs", definition: "positive runs whose oracle passed and FluxIQ gave a verdict, where FluxIQ reported failure",
    applies: (evaluation) => positive(evaluation) && evaluation.oracleVerdict === "passed" && evaluation.reportedVerdict !== null, hit: (evaluation) => evaluation.reportedVerdict === "failed",
  },
  falseSuccess: {
    unit: "runs", definition: "positive runs whose oracle failed and FluxIQ gave a verdict, where FluxIQ reported success",
    applies: (evaluation) => positive(evaluation) && evaluation.oracleVerdict === "failed" && evaluation.reportedVerdict !== null, hit: (evaluation) => evaluation.reportedVerdict === "passed",
  },
  failureClassificationAccuracy: {
    // Both sides are required to be present, rather than compared through
    // optional chaining: over this population `automationFailureExpected` is
    // never null, but `undefined === undefined` would score a hit if the
    // population were ever widened, and a run in which FluxIQ reported nothing
    // must miss for the same reason `executed` requires a reported pass.
    unit: "runs", definition: "negative runs (expected.failure set) whose reported category equals the expected category; a run that reported no failure at all is a miss",
    applies: (evaluation) => !positive(evaluation),
    hit: (evaluation) => evaluation.automationFailureReported !== null && evaluation.automationFailureExpected !== null && evaluation.automationFailureReported.category === evaluation.automationFailureExpected.category,
  },
  harnessActivation: {
    unit: "runs", definition: "runs that requested an LLM intervention; Week 1 requires none with the provider disabled",
    applies: () => true, hit: (evaluation) => evaluation.harnessActivations > 0,
  },
};

/** Aggregates per-run evaluations into a `BenchReport` and validates it. */
export function aggregateBenchReport(input: AggregateBenchInput): BenchReport {
  for (const result of input.results) checkRuns(result, input.repeatCount);
  const report: BenchReport = {
    schemaVersion: BENCH_REPORT_SCHEMA_VERSION,
    reportId: input.reportId,
    generatedAt: input.generatedAt,
    corpusId: input.corpusId,
    repeatCount: input.repeatCount,
    target: input.target,
    workflows: input.results.map(workflowResult),
    metrics: corpusMetrics(input.results),
    llm: benchLlm(input.results),
    comparison: null,
  };
  assertBenchReport(report);
  return report;
}

/** Groups evaluated runs into results by corpus row, scenario, workflow, and variant, in first-run order, each result's runs by repeat. */
export function groupBenchResults(runs: ReadonlyArray<{ corpusRowId: string; evaluation: RunEvaluation }>): BenchResultRuns[] {
  const results = new Map<string, Omit<BenchResultRuns, "evaluations"> & { evaluations: RunEvaluation[] }>();
  for (const { corpusRowId, evaluation } of runs) {
    const key = JSON.stringify([corpusRowId, evaluation.scenarioId, evaluation.workflowId, evaluation.variantId]);
    const result = results.get(key) ?? { corpusRowId, scenarioId: evaluation.scenarioId, workflowId: evaluation.workflowId, variantId: evaluation.variantId, evaluations: [] };
    result.evaluations.push(evaluation);
    results.set(key, result);
  }
  return [...results.values()].map((result) => ({ ...result, evaluations: [...result.evaluations].sort((left, right) => left.repeatIndex - right.repeatIndex) }));
}

function checkRuns(result: BenchResultRuns, repeatCount: number): void {
  const label = `${result.corpusRowId} ${result.scenarioId}/${result.workflowId ?? "primary"}/${result.variantId ?? "unarmed"}`;
  if (result.evaluations.length !== repeatCount) throw new Error(`${label} has ${result.evaluations.length} runs, not the bench's ${repeatCount}`);
  if (new Set(result.evaluations.map((evaluation) => evaluation.repeatIndex)).size !== repeatCount) throw new Error(`${label} repeats a repeat index`);
}

function workflowResult(result: BenchResultRuns): BenchWorkflowResult {
  const runs = result.evaluations.length;
  const passRate = result.evaluations.filter((evaluation) => evaluation.verdict === "passed").length / runs;
  return {
    corpusRowId: result.corpusRowId, scenarioId: result.scenarioId, workflowId: result.workflowId, variantId: result.variantId,
    runs, passRate, flakeClass: passRate === 1 ? "stable-pass" : passRate === 0 ? "stable-fail" : "flaky",
  };
}

/**
 * Every run in a rate's population, each with the index of the result it
 * belongs to. `rate` counts over exactly this, and so does
 * `benchExecutionCoverage`, so the not-executed count a report prints beside a
 * rate is over the same runs the rate was computed from.
 */
export function benchRatePopulation(results: readonly BenchResultRuns[], definition: BenchRateDefinition): Array<{ evaluation: RunEvaluation; resultIndex: number }> {
  return results.flatMap((result, resultIndex) => {
    const first = Math.min(...result.evaluations.map((evaluation) => evaluation.repeatIndex));
    return result.evaluations.flatMap((evaluation) => (definition.applies(evaluation, evaluation.repeatIndex === first) ? [{ evaluation, resultIndex }] : []));
  });
}

function rate(results: readonly BenchResultRuns[], definition: BenchRateDefinition): BenchRate {
  const population = benchRatePopulation(results, definition);
  const count = population.filter(({ evaluation }) => definition.hit(evaluation)).length;
  const total = population.length;
  const workflows = new Set(population.map(({ resultIndex }) => resultIndex)).size;
  return { count, total, workflows, rate: total === 0 ? null : count / total };
}

function corpusMetrics(results: readonly BenchResultRuns[]): BenchCorpusMetrics {
  const runs = results.flatMap((result) => result.evaluations);
  const latency = new Map<string, number[]>();
  for (const action of runs.flatMap((run) => run.actions)) latency.set(action.actionType, [...(latency.get(action.actionType) ?? []), action.durationMs]);
  return {
    rates: Object.fromEntries(benchRateMetrics.map((metric) => [metric, rate(results, BENCH_RATE_DEFINITIONS[metric])])) as Record<BenchRateMetric, BenchRate>,
    actionLatencyMs: Object.fromEntries([...latency.keys()].sort().map((actionType) => [actionType, benchDistribution(latency.get(actionType) ?? [])])),
    runDurationMs: benchDistribution(runs.map((run) => run.durationMs)),
    sanitizedPacketBytes: benchDistribution(runs.flatMap((run) => run.evidence.sanitizedPacketBytes)),
    rawSnapshotBytes: benchDistribution(runs.flatMap((run) => run.evidence.rawSnapshotBytes)),
    truncationCount: runs.reduce((sum, run) => sum + run.evidence.truncationCount, 0),
    // Always stated, so `report.json` never leaves a rate standing on its own.
    // The eight benches written before these fields existed omit them, which
    // the contract reads as unmeasured rather than as zero.
    notExecutedRuns: runs.filter(executedNothing).length,
    actionsExecuted: runs.reduce((sum, run) => sum + actionsExecuted(run), 0),
    harnessRecovery: null,
    adaptationCost: null,
    adaptationValidation: null,
    adaptationPersistence: null,
    adaptationReuse: null,
  };
}

/** The LLM configuration every run shared, with their calls summed. Runs under different configurations are not one bench. */
function benchLlm(results: readonly BenchResultRuns[]): LlmUsage {
  const runs = results.flatMap((result) => result.evaluations);
  const [first] = runs;
  if (!first) return { mode: "disabled", profileId: null, calls: 0 };
  if (runs.some((run) => run.llm.mode !== first.llm.mode || run.llm.profileId !== first.llm.profileId)) throw new Error("Bench runs used different LLM configurations");
  return { mode: first.llm.mode, profileId: first.llm.profileId, calls: runs.reduce((sum, run) => sum + run.llm.calls, 0) };
}
