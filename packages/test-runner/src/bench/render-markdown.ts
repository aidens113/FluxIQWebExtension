import { benchRateMetrics, type BenchDistribution, type BenchReport } from "@fluxiq-web-extension/test-contracts";
import { BENCH_RATE_DEFINITIONS } from "./aggregate-report.js";
import type { BenchExecutionCoverage } from "./execution-coverage.js";
import type { BenchRunsFile } from "./report-store.js";

/**
 * `report.md`: results, skipped results with their reasons, every run's
 * verdict and how many actions FluxIQ executed in it, the corpus metrics, and
 * where each measurement came from.
 *
 * The execution line is deliberately above the results, and the Not executed
 * column deliberately beside every rate. A run in which FluxIQ executed
 * nothing still passes as a test — the Testing Lab drove the fixture and the
 * fixture ended in the right state — so a reader who sees only pass rates will
 * read a bench of such runs as evidence about FluxIQ. It is not, and the
 * report has to say so where the numbers are, not in a footnote.
 */
export function renderBenchMarkdown(runs: BenchRunsFile, report: BenchReport | undefined, coverage: BenchExecutionCoverage | undefined): string {
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
    ...(coverage ? executionLines(coverage) : []),
    "## Results",
    "",
    report ? table(["Row", "Scenario", "Workflow", "Variant", "Runs", "Pass rate", "Flake class"], report.workflows.map((result) => [result.corpusRowId, result.scenarioId, result.workflowId ?? "primary", result.variantId ?? "unarmed", String(result.runs), fixed(result.passRate), result.flakeClass])) : "No result ran, so no report.json was written.",
    "",
    "## Skipped",
    "",
    skipped.length ? table(["Row", "Scenario", "Workflow", "Variant", "Lane", "Reason"], skipped.map((run) => [run.corpusRowId, run.scenarioId, run.workflowId ?? "primary", run.variantId ?? "unarmed", run.lane, run.skipReason ?? ""])) : "None.",
    "",
    "## Runs",
    "",
    evaluated.length ? table(["Row", "Workflow", "Variant", "Lane", "Repeat", "Run", "Verdict", "Actions FluxIQ executed", "Failure category", "Problems"], evaluated.map((run) => [run.corpusRowId, run.workflowId ?? "primary", run.variantId ?? "unarmed", run.lane, String(run.repeatIndex), run.runId ?? "", run.verdict ?? "", String(run.actionsExecuted ?? 0), run.failureCategory ?? "", (run.problems ?? []).join("; ")])) : "None.",
    "",
    ...(report && coverage ? metricLines(report, coverage) : []),
    "## Measurement sources",
    "",
    ...sourceLines("Recording lane", runs.sources),
    ...(runs.flowSources ? sourceLines("Flow lane", runs.flowSources) : []),
  ].join("\n");
}

/** What FluxIQ actually did, stated before any pass rate a reader might mistake for it. */
function executionLines(coverage: BenchExecutionCoverage): string[] {
  return [
    "## FluxIQ execution",
    "",
    `FluxIQ executed **${coverage.actions} actions** across ${coverage.runs} evaluated runs, and **executed nothing at all in ${coverage.notExecutedRuns} of those ${coverage.runs}**. Runs in which it executed at least one action: ${coverage.executedRuns}.`,
    "",
    "A run in which FluxIQ executed nothing is counted as a **miss** by every execution rate below, never dropped from one: the rate's own population still holds it, and the Not executed column says how many of that population it holds. On the recording lane a run's pass means the Testing Lab drove the fixture and the fixture ended in the expected state; FluxIQ executes at most a two-action Core round-trip probe there, never the workflow, so the action count is the only figure on this page that says what FluxIQ did.",
    "",
  ];
}

function metricLines(report: BenchReport, coverage: BenchExecutionCoverage): string[] {
  const { metrics } = report;
  const distributions: Array<[string, BenchDistribution]> = [
    ...Object.entries(metrics.actionLatencyMs).map(([actionType, distribution]): [string, BenchDistribution] => [`Action latency ${actionType} (ms)`, distribution]),
    ["Run duration (ms)", metrics.runDurationMs],
    ["Sanitized packet bytes", metrics.sanitizedPacketBytes],
    ["Raw snapshot bytes", metrics.rawSnapshotBytes],
  ];
  return [
    "## Rates",
    "",
    table(["Metric", "Unit", "Count", "Total", "Not executed", "Workflows", "Rate", "Population"], benchRateMetrics.map((metric) => {
      const value = metrics.rates[metric];
      const definition = BENCH_RATE_DEFINITIONS[metric];
      return [metric, definition.unit, String(value.count), String(value.total), String(coverage.notExecutedByMetric[metric]), String(value.workflows), value.rate === null ? "n/a" : fixed(value.rate), definition.definition];
    })),
    "",
    "Not executed is how many runs of that metric's own population executed no FluxIQ action. A rate whose Not executed approaches its Total is a statement about the Testing Lab and the fixture, not about FluxIQ.",
    "",
    "## Distributions",
    "",
    table(["Metric", "Samples", "p50", "p95"], distributions.map(([name, distribution]) => [name, String(distribution.samples), distribution.p50 === null ? "n/a" : String(distribution.p50), distribution.p95 === null ? "n/a" : String(distribution.p95)])),
    "",
    `Truncation count: ${metrics.truncationCount}. Week 2 metrics (harness recovery; adaptation cost, validation, persistence, and reuse) are null.`,
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
