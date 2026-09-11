import { benchRateMetrics, type BenchDistribution, type BenchReport } from "@fluxiq-web-extension/test-contracts";
import { BENCH_RATE_DEFINITIONS } from "./aggregate-report.js";
import type { BenchRunsFile } from "./report-store.js";

/** `report.md`: results, skipped results with their reasons, every run's verdict, the corpus metrics, and where each measurement came from. */
export function renderBenchMarkdown(runs: BenchRunsFile, report: BenchReport | undefined): string {
  const evaluated = runs.runs.filter((run) => run.status === "evaluated");
  const passed = evaluated.filter((run) => run.verdict === "passed").length;
  const skippedRuns = runs.runs.filter((run) => run.status === "skipped");
  const skipped = skippedRuns.filter((run) => run.repeatIndex === 0);
  return [
    `# Bench ${runs.benchId}`,
    "",
    table(["Corpus", "Target", "Lane", "Repeats", "LLM", "Started", "Finished"], [[runs.corpusId, runs.target, runs.lane, String(runs.repeatCount), report?.llm.mode ?? "disabled", runs.startedAt, runs.finishedAt ?? "unfinished"]]),
    "",
    `${evaluated.length} runs evaluated: ${passed} passed, ${evaluated.length - passed} did not. ${skipped.length} results skipped (${skippedRuns.length} runs); a skipped run is never counted as a pass.`,
    "",
    "## Results",
    "",
    report ? table(["Row", "Scenario", "Workflow", "Variant", "Runs", "Pass rate", "Flake class"], report.workflows.map((result) => [result.corpusRowId, result.scenarioId, result.workflowId ?? "primary", result.variantId ?? "unarmed", String(result.runs), fixed(result.passRate), result.flakeClass])) : "No result ran, so no report.json was written.",
    "",
    "## Skipped",
    "",
    skipped.length ? table(["Row", "Scenario", "Workflow", "Variant", "Reason"], skipped.map((run) => [run.corpusRowId, run.scenarioId, run.workflowId ?? "primary", run.variantId ?? "unarmed", run.skipReason ?? ""])) : "None.",
    "",
    "## Runs",
    "",
    evaluated.length ? table(["Row", "Workflow", "Variant", "Repeat", "Run", "Verdict", "Failure category", "Problems"], evaluated.map((run) => [run.corpusRowId, run.workflowId ?? "primary", run.variantId ?? "unarmed", String(run.repeatIndex), run.runId ?? "", run.verdict ?? "", run.failureCategory ?? "", (run.problems ?? []).join("; ")])) : "None.",
    "",
    ...(report ? metricLines(report) : []),
    "## Measurement sources",
    "",
    ...Object.entries(runs.sources).map(([name, source]) => `- ${name}: ${source}`),
    "",
  ].join("\n");
}

function metricLines(report: BenchReport): string[] {
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
    table(["Metric", "Unit", "Count", "Total", "Workflows", "Rate", "Population"], benchRateMetrics.map((metric) => {
      const value = metrics.rates[metric];
      const definition = BENCH_RATE_DEFINITIONS[metric];
      return [metric, definition.unit, String(value.count), String(value.total), String(value.workflows), value.rate === null ? "n/a" : fixed(value.rate), definition.definition];
    })),
    "",
    "## Distributions",
    "",
    table(["Metric", "Samples", "p50", "p95"], distributions.map(([name, distribution]) => [name, String(distribution.samples), distribution.p50 === null ? "n/a" : String(distribution.p50), distribution.p95 === null ? "n/a" : String(distribution.p95)])),
    "",
    `Truncation count: ${metrics.truncationCount}. Week 2 metrics (harness recovery; adaptation cost, validation, persistence, and reuse) are null.`,
    "",
  ];
}

function table(header: string[], rows: string[][]): string {
  return [header, header.map(() => "---"), ...rows].map((cells) => `| ${cells.map(cell).join(" | ")} |`).join("\n");
}
const cell = (value: string): string => value.replace(/\|/gu, "\\|").replace(/\s*\r?\n\s*/gu, " ");
const fixed = (value: number): string => value.toFixed(3);
