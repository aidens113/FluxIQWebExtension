import { randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";
import type { RunEvaluation, WebScenario } from "@fluxiq-web-extension/test-contracts";
import type { EvidenceMode } from "../commands.js";
import type { RunScenarioOptions, RunScenarioResult } from "../run-scenario.js";
import type { FluxIQTargetConfiguration } from "../target-config.js";
import { aggregateBenchReport, groupBenchResults } from "./aggregate-report.js";
import type { BenchCorpus } from "./corpus/index.js";
import { describeError } from "./describe-error.js";
import { RECORDING_LANE_SOURCES, evaluateFailedAttempt, evaluateRecordingRun, type RunEvaluationIdentity } from "./evaluate-run.js";
import { expandCorpus, type BenchPlanEntry } from "./expand-corpus.js";
import { readRunBundle } from "./read-run-bundle.js";
import { renderBenchMarkdown } from "./render-markdown.js";
import { benchDirectory, writeBenchMarkdown, writeBenchReport, writeBenchRuns, writeRunEvaluation, type BenchRunRecord, type BenchRunsFile } from "./report-store.js";

/** The runner's `--repeat` bound. */
const MAX_REPEAT = 100;

export type RunBenchOptions = {
  corpus: BenchCorpus;
  repeatCount: number;
  /** The resolved target. The recording lane runs on `isolated` and `persistent-isolated`. */
  target: FluxIQTargetConfiguration;
  /** The Scenario Lab registry the corpus resolves against. */
  manifests: readonly WebScenario[];
  repositoryRoot: string;
  fluxiqRepositoryRoot: string;
  runsDirectory: string;
  environment: NodeJS.ProcessEnv;
  /** Overrides every manifest's `evidencePolicy`, as `lab run --evidence` does. */
  evidence?: EvidenceMode;
  runScenario: (options: RunScenarioOptions) => Promise<RunScenarioResult>;
  /** Verifies a finished bundle's integrity; a failure is recorded as a problem of that run. */
  inspectRun: (runsDirectory: string, runId: string) => Promise<unknown>;
};

export type RunBenchOutcome = {
  /** `passed` only when at least one run was evaluated and every evaluated run passed. */
  status: "passed" | "failed";
  benchId: string;
  directory: string;
  /** `report.json`, or `null` when no result ran. */
  report: string | null;
  markdown: string;
  results: number;
  runs: number;
  passed: number;
  skipped: number;
};

type Attempt = { entry: BenchPlanEntry; repeatIndex: number; attemptId: string; directory: string };

/**
 * `lab bench`: runs every runnable corpus result `repeatCount` times on the
 * recording lane, one pass over the corpus per repeat, and writes a
 * `RunEvaluation` per run, `runs.json`, `report.json` (a `BenchReport`), and
 * `report.md` under `<runs directory>/bench/<bench id>/`. Variants and
 * unresolved rows are recorded as skipped with their reason, never as passes.
 */
export async function runBench(options: RunBenchOptions): Promise<RunBenchOutcome> {
  const { target, repeatCount } = options;
  if (target.mode !== "isolated" && target.mode !== "persistent-isolated") throw new Error(`bench runs the recording lane on isolated or persistent-isolated targets; a ${target.mode} target runs a pre-existing Flow, which the Flow lane (Wave 2) evaluates`);
  if (!Number.isSafeInteger(repeatCount) || repeatCount < 1 || repeatCount > MAX_REPEAT) throw new Error(`--repeat must be between 1 and ${MAX_REPEAT}`);
  const benchId = `bench-${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`;
  const directory = benchDirectory(options.runsDirectory, benchId);
  await mkdir(directory, { recursive: true });
  const plan = expandCorpus(options.corpus, options.manifests);
  const repeats = Array.from({ length: repeatCount }, (_, index) => index);
  const file: BenchRunsFile = {
    schemaVersion: "0.1", benchId, corpusId: options.corpus.id, repeatCount, target: target.mode, lane: "recording",
    startedAt: new Date().toISOString(), sources: RECORDING_LANE_SOURCES,
    runs: plan.flatMap((entry) => {
      const reason = entry.skipReason;
      return reason === undefined ? [] : repeats.map((repeatIndex): BenchRunRecord => ({ ...identityOf(entry), repeatIndex, status: "skipped", skipReason: reason }));
    }),
  };
  await writeBenchRuns(directory, file);
  const runnable = plan.filter((entry) => entry.skipReason === undefined);
  const evaluated: Array<{ corpusRowId: string; evaluation: RunEvaluation }> = [];
  for (const repeatIndex of repeats) {
    for (const [index, entry] of runnable.entries()) {
      const { evaluation, record } = await runOnce(options, { entry, repeatIndex, attemptId: `${benchId}-r${repeatIndex}-${index}`, directory });
      evaluated.push({ corpusRowId: entry.corpusRowId, evaluation });
      file.runs.push(record);
      await writeBenchRuns(directory, file);
    }
  }
  const order = new Map(plan.map((entry, index) => [resultKey(entry), index]));
  file.runs.sort((left, right) => (order.get(resultKey(left)) ?? 0) - (order.get(resultKey(right)) ?? 0) || left.repeatIndex - right.repeatIndex);
  file.finishedAt = new Date().toISOString();
  const results = groupBenchResults(evaluated);
  const report = results.length === 0 ? undefined : aggregateBenchReport({ reportId: benchId, generatedAt: file.finishedAt, corpusId: options.corpus.id, repeatCount, target: target.mode, results });
  const reportPath = report ? await writeBenchReport(directory, report) : null;
  await writeBenchRuns(directory, file);
  const markdown = await writeBenchMarkdown(directory, renderBenchMarkdown(file, report));
  const passed = evaluated.filter(({ evaluation }) => evaluation.verdict === "passed").length;
  return {
    status: evaluated.length > 0 && passed === evaluated.length ? "passed" : "failed",
    benchId, directory, report: reportPath, markdown,
    results: results.length, runs: evaluated.length, passed, skipped: file.runs.length - evaluated.length,
  };
}

async function runOnce(options: RunBenchOptions, attempt: Attempt): Promise<{ evaluation: RunEvaluation; record: BenchRunRecord }> {
  const { entry, repeatIndex } = attempt;
  const identity: RunEvaluationIdentity = { scenarioId: entry.scenarioId, workflowId: entry.workflowId, variantId: entry.variantId, repeatIndex, expectedFailure: entry.expectedFailure };
  const started = Date.now();
  let result: RunScenarioResult;
  try {
    result = await options.runScenario({
      repositoryRoot: options.repositoryRoot,
      fluxiqRepositoryRoot: options.fluxiqRepositoryRoot,
      runsDirectory: options.runsDirectory,
      scenarioId: entry.scenarioId,
      ...(entry.workflowId === null ? {} : { workflowId: entry.workflowId }),
      ...(options.evidence ? { evidence: options.evidence } : {}),
      environment: options.environment,
      target: options.target,
    });
  } catch (error) {
    const evaluation = evaluateFailedAttempt({ ...identity, attemptId: attempt.attemptId, error, wallClockMs: Date.now() - started });
    return recordRun(attempt, evaluation, [`runner: ${describeError(error)}`]);
  }
  const wallClockMs = Date.now() - started;
  const problems: string[] = [];
  await options.inspectRun(options.runsDirectory, result.runId).catch((error: unknown) => { problems.push(`inspect: ${describeError(error)}`); });
  const bundle = await readRunBundle(result.path);
  problems.push(...bundle.problems);
  const evaluation = evaluateRecordingRun({ ...identity, result, manifest: bundle.manifest, metrics: bundle.metrics, finalSequence: bundle.finalSequence, errorSequence: bundle.errorSequence, wallClockMs });
  return recordRun(attempt, evaluation, problems);
}

async function recordRun(attempt: Attempt, evaluation: RunEvaluation, problems: string[]): Promise<{ evaluation: RunEvaluation; record: BenchRunRecord }> {
  const evaluationPath = await writeRunEvaluation(attempt.directory, evaluation);
  return {
    evaluation,
    record: {
      ...identityOf(attempt.entry), repeatIndex: attempt.repeatIndex, status: "evaluated",
      runId: evaluation.runId, evaluation: evaluationPath, verdict: evaluation.verdict,
      ...(evaluation.failureCategory === undefined ? {} : { failureCategory: evaluation.failureCategory }),
      ...(problems.length ? { problems } : {}),
    },
  };
}

const identityOf = (entry: BenchPlanEntry): Pick<BenchRunRecord, "corpusRowId" | "scenarioId" | "workflowId" | "variantId"> => ({ corpusRowId: entry.corpusRowId, scenarioId: entry.scenarioId, workflowId: entry.workflowId, variantId: entry.variantId });
const resultKey = (value: Pick<BenchRunRecord, "corpusRowId" | "scenarioId" | "workflowId" | "variantId">): string => JSON.stringify([value.corpusRowId, value.scenarioId, value.workflowId, value.variantId]);
