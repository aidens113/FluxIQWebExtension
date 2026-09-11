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
/** The runner passed the run, the fixture oracle passed, and FluxIQ reported no failure, or ran nothing to report on. */
const executed = (evaluation: RunEvaluation): boolean => evaluation.verdict === "passed" && evaluation.oracleVerdict === "passed" && evaluation.reportedVerdict !== "failed";

/** The Week 1 Metrics table's rates, each with its unit and population. */
export const BENCH_RATE_DEFINITIONS: Readonly<Record<BenchRateMetric, BenchRateDefinition>> = {
  flowCreationSuccess: {
    unit: "workflows", definition: "each result's first run on the flow lane: recording, proposal, and approval produced a runnable Flow",
    applies: (evaluation, first) => first && evaluation.lane === "flow", hit: (evaluation) => evaluation.flowCreated === true,
  },
  initialExecutionSuccess: {
    unit: "workflows", definition: "each positive result's first run: the runner passed, the oracle passed, and FluxIQ reported no failure",
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
    unit: "runs", definition: "negative runs (expected.failure set) whose reported category equals the expected category",
    applies: (evaluation) => !positive(evaluation), hit: (evaluation) => evaluation.automationFailureReported?.category === evaluation.automationFailureExpected?.category,
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

function rate(results: readonly BenchResultRuns[], definition: BenchRateDefinition): BenchRate {
  let count = 0;
  let total = 0;
  const workflows = new Set<number>();
  results.forEach((result, index) => {
    const first = Math.min(...result.evaluations.map((evaluation) => evaluation.repeatIndex));
    for (const evaluation of result.evaluations) {
      if (!definition.applies(evaluation, evaluation.repeatIndex === first)) continue;
      total += 1;
      workflows.add(index);
      if (definition.hit(evaluation)) count += 1;
    }
  });
  return { count, total, workflows: workflows.size, rate: total === 0 ? null : count / total };
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
