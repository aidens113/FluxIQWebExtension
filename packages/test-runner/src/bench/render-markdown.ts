import { benchRateMetrics, evaluationLanes, type BenchDistribution, type BenchReport, type EvaluationLane } from "@fluxiq-web-extension/test-contracts";
import { BENCH_RATE_DEFINITIONS } from "./aggregate-report.js";
import type { BenchExecutionCoverage } from "./execution-coverage.js";
import { benchFailureCauses, describeFacilityFailure, type BenchFailureCause } from "./failure-cause.js";
import type { BenchRunRecord, BenchRunsFile } from "./report-store.js";

/**
 * Execution coverage over every evaluated run, and over each lane's results
 * alone. The rates are counted per lane, so the Not executed count beside a
 * rate has to be counted over the same lane's population.
 */
export type BenchMarkdownCoverage = { total: BenchExecutionCoverage; byLane: Partial<Record<EvaluationLane, BenchExecutionCoverage>> };

/**
 * The lane label of every figure `report.json` counts over both lanes at once:
 * the latency, duration and evidence-size distributions and the truncation
 * count. Mixing lanes there is accepted for Week 1; printing it unlabelled is
 * not, because a reader would take a latency beside per-lane rates as Flow-lane
 * latency.
 */
const ALL_LANES = "all lanes";

/**
 * `report.md`: results, skipped results with their reasons, every run's
 * verdict and how many actions FluxIQ executed in it, the corpus metrics, and
 * where each measurement came from.
 *
 * The execution line is deliberately above the results, and the Not executed
 * column deliberately beside every rate. A run in which FluxIQ executed
 * nothing still passes as a test — the Testing Lab drove the fixture and the
 * fixture ended in the expected state — so a reader who sees only pass rates will
 * read a bench of such runs as evidence about FluxIQ. It is not, and the
 * report has to say so where the numbers are, not in a footnote. For the same
 * reason every result and every rate names its lane.
 */
export function renderBenchMarkdown(runs: BenchRunsFile, report: BenchReport | undefined, coverage: BenchMarkdownCoverage | undefined): string {
  const evaluated = runs.runs.filter((run) => run.status === "evaluated");
  const passed = evaluated.filter((run) => run.verdict === "passed").length;
  const skippedRuns = runs.runs.filter((run) => run.status === "skipped");
  const skipped = skippedRuns.filter((run) => run.repeatIndex === 0);
  return [
    `# Bench ${runs.benchId}`,
    "",
    table(["Corpus", "Target", "Lanes", "Repeats", "LLM", "Started", "Finished"], [[runs.corpusId, runs.target, runs.lanes.join(", "), String(runs.repeatCount), report?.llm.mode ?? "disabled", runs.startedAt, runs.finishedAt ?? "unfinished"]]),
    "",
    `${evaluated.length} runs evaluated: ${passed} passed, ${evaluated.length - passed} did not. ${skipped.length} results skipped (${skippedRuns.length} runs); a skipped run is never counted as a pass.`,
    "",
    ...failureLines(benchFailureCauses(runs.runs), evaluated.length),
    ...(coverage ? executionLines(coverage) : []),
    "## Results",
    "",
    report ? table(["Row", "Scenario", "Workflow", "Variant", "Lane", "Runs", "Pass rate", "Flake class"], report.workflows.map((result) => [result.corpusRowId, result.scenarioId, result.workflowId ?? "primary", result.variantId ?? "unarmed", result.lane ?? "unstated", String(result.runs), fixed(result.passRate), result.flakeClass])) : "No result ran, so no report.json was written.",
    "",
    "## Skipped",
    "",
    skipped.length ? table(["Row", "Scenario", "Workflow", "Variant", "Lane", "Reason"], skipped.map((run) => [run.corpusRowId, run.scenarioId, run.workflowId ?? "primary", run.variantId ?? "unarmed", run.lane, run.skipReason ?? ""])) : "None.",
    "",
    "## Runs",
    "",
    evaluated.length ? table(["Row", "Workflow", "Variant", "Lane", "Repeat", "Run", "Verdict", "Actions FluxIQ executed", "Failure category", "Facility diagnostic", "Cause and problems"], evaluated.map((run) => [run.corpusRowId, run.workflowId ?? "primary", run.variantId ?? "unarmed", run.lane, String(run.repeatIndex), run.runId ?? "", run.verdict ?? "", String(run.actionsExecuted ?? 0), run.failureCategory ?? "", run.facilityFailure ? describeFacilityFailure(run.facilityFailure) : "", causeAndProblems(run)])) : "None.",
    "",
    ...(report && coverage ? metricLines(report, coverage) : []),
    "## Measurement sources",
    "",
    ...sourceLines("Recording lane", runs.sources),
    ...(runs.flowSources ? sourceLines("Flow lane", runs.flowSources) : []),
  ].join("\n");
}

/**
 * Why the failed runs failed, stated immediately under the run counts.
 *
 * A bench that lost every run to one fault is the case this section is for. It
 * has happened twice: once when a FluxIQ Core rebuild in the sibling checkout
 * deleted a module mid-run, and once when a concurrent Lab instance could not
 * resolve a workspace package. Both times all four runs carried the same
 * one-line message, both times the report said `unknown` and showed an empty
 * Problems column, and both times the message was sitting in `events.ndjson`.
 * A reader must not have to open a run's event log to learn that the bench
 * never started.
 */
function failureLines(causes: readonly BenchFailureCause[], evaluatedRuns: number): string[] {
  if (causes.length === 0) return [];
  const dominant = causes[0];
  const everyRun = dominant !== undefined && dominant.runs === evaluatedRuns && causes.length === 1;
  return [
    "## Why the failed runs failed",
    "",
    ...(everyRun ? [`**Every one of the ${evaluatedRuns} evaluated runs failed for the same reason**, so this bench measures that reason and nothing else. No number below says anything about FluxIQ.`, ""] : []),
    table(["Runs", "Failure category", "Cause"], causes.map((cause) => [String(cause.runs), cause.category, cause.message === "" ? "no cause recorded" : cause.message])),
    "",
    "The category is the test-rig taxonomy — why the facility could not produce a trustworthy run — and never how the automation failed. The cause is the runner's thrown error, or the summary the run recorded on its last `error` evidence event.",
    "",
  ];
}

/** A run's own failure first, then any bundle file the bench could not read; the cause is not repeated when a problem already carries it. */
function causeAndProblems(run: BenchRunRecord): string {
  const problems = run.problems ?? [];
  const cause = run.failureCause;
  return [...(cause !== undefined && !problems.some((problem) => problem.includes(cause)) ? [cause] : []), ...problems].join("; ");
}

/** What FluxIQ actually did, stated before any pass rate a reader might mistake for it: in total, then per lane. */
function executionLines(coverage: BenchMarkdownCoverage): string[] {
  const { total } = coverage;
  const lanes = evaluationLanes.flatMap((lane) => {
    const onLane = coverage.byLane[lane];
    return onLane ? [`${lane} lane, ${onLane.actions} actions across ${onLane.runs} runs, nothing executed in ${onLane.notExecutedRuns}`] : [];
  });
  return [
    "## FluxIQ execution",
    "",
    `FluxIQ executed **${total.actions} actions** across ${total.runs} evaluated runs, and **executed nothing at all in ${total.notExecutedRuns} of those ${total.runs}**. Runs in which it executed at least one action: ${total.executedRuns}.`,
    "",
    ...(lanes.length > 0 ? [`By lane: ${lanes.join("; ")}.`, ""] : []),
    "A run in which FluxIQ executed nothing is counted as a **miss** by every execution rate below, never dropped from one: the rate's own population still holds it, and the Not executed column says how many of that population it holds. On the recording lane a run's pass means the Testing Lab drove the fixture and the fixture ended in the expected state; FluxIQ executes at most a two-action Core round-trip probe there, never the workflow, so the action count is the only figure on this page that says what FluxIQ did.",
    "",
  ];
}

function metricLines(report: BenchReport, coverage: BenchMarkdownCoverage): string[] {
  const { metrics } = report;
  const distributions: Array<[string, BenchDistribution]> = [
    ...Object.entries(metrics.actionLatencyMs).map(([actionType, distribution]): [string, BenchDistribution] => [`Action latency ${actionType} (ms)`, distribution]),
    ["Run duration (ms)", metrics.runDurationMs],
    ["Sanitized packet bytes", metrics.sanitizedPacketBytes],
    ["Raw snapshot bytes", metrics.rawSnapshotBytes],
  ];
  const rates = evaluationLanes.flatMap((lane) => {
    const onLane = metrics.ratesByLane?.[lane];
    const notExecuted = coverage.byLane[lane]?.notExecutedByMetric;
    return onLane === undefined ? [] : benchRateMetrics.map((metric) => {
      const value = onLane[metric];
      const definition = BENCH_RATE_DEFINITIONS[metric];
      return [lane, metric, definition.unit, String(value.count), String(value.total), notExecuted ? String(notExecuted[metric]) : "unmeasured", String(value.workflows), value.rate === null ? "n/a" : fixed(value.rate), definition.definition];
    });
  });
  return [
    "## Rates",
    "",
    "Every rate is counted over one lane's runs, never over both. An unarmed row runs on the recording lane and on the Flow lane, and the recording lane executes at most a two-action Core round-trip probe, never the workflow: a rate over both lanes would count each unarmed row twice and mix what the Testing Lab did into what FluxIQ did.",
    "",
    table(["Lane", "Metric", "Unit", "Count", "Total", "Not executed", "Workflows", "Rate", "Population"], rates),
    "",
    "Not executed is how many runs of that lane's population for the metric executed no FluxIQ action. A rate whose Not executed approaches its Total is a statement about the Testing Lab and the fixture, not about FluxIQ.",
    "",
    `## Distributions, ${ALL_LANES}`,
    "",
    `Unlike the rates, every distribution is counted over ${ALL_LANES}: the recording lane's runs and the Flow lane's together. An action latency here is not Flow-lane latency, and a run duration is not the time FluxIQ took to execute a workflow.`,
    "",
    table(["Lane", "Metric", "Samples", "p50", "p95"], distributions.map(([name, distribution]) => [ALL_LANES, name, String(distribution.samples), distribution.p50 === null ? "n/a" : String(distribution.p50), distribution.p95 === null ? "n/a" : String(distribution.p95)])),
    "",
    `Truncation count, ${ALL_LANES}: ${metrics.truncationCount}. Sanitized packet bytes and the truncation count come from Flow-lane runs only: a recording-lane run runs no Flow, so Core captures no sanitized packet for it. Raw snapshot bytes has no samples on any lane: no producer measures raw snapshots, and they are not a Week 1 metric. Week 2 metrics (harness recovery; adaptation cost, validation, persistence, and reuse) are null.`,
    "",
  ];
}

function sourceLines(lane: string, sources: Readonly<Record<string, string>>): string[] {
  return [`### ${lane}`, "", ...Object.entries(sources).map(([name, source]) => `- ${name}: ${source}`), ""];
}

function table(header: string[], rows: string[][]): string {
  return [header, header.map(() => "---"), ...rows].map((cells) => `| ${cells.map(cell).join(" | ")} |`).join("\n");
}
const cell = (value: string): string => value.replace(/\|/gu, "\\|").replace(/\s*\r?\n\s*/gu, " ");
const fixed = (value: number): string => value.toFixed(3);
