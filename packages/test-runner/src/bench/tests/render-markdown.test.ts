import assert from "node:assert/strict";
import test from "node:test";
import type { EvaluationLane, RunEvaluation } from "@fluxiq-web-extension/test-contracts";
import { aggregateBenchReport, benchResultsByLane, groupBenchResults } from "../aggregate-report.js";
import { benchExecutionCoverage } from "../execution-coverage.js";
import { renderBenchMarkdown, type BenchMarkdownCoverage } from "../render-markdown.js";
import type { BenchRunsFile } from "../report-store.js";

/** One W01 run on `lane`, with one click taking `clickMs`. */
const run = (lane: EvaluationLane, durationMs: number, clickMs: number): RunEvaluation => ({
  schemaVersion: "0.1", runId: `run-${lane}`, verdict: "passed", invariants: [], metrics: {},
  scenarioId: "basic-form", workflowId: null, variantId: null, repeatIndex: 0, lane, flowCreated: lane === "flow" ? true : null,
  oracleVerdict: "passed", reportedVerdict: "passed", automationFailureReported: null, automationFailureExpected: null,
  harnessActivations: 0, durationMs, actions: [{ actionType: "web.dom.click", durationMs: clickMs }], evidence: { sanitizedPacketBytes: [], rawSnapshotBytes: [], truncationCount: 0 },
  llm: { mode: "disabled", profileId: null, calls: 0 },
  harnessRecovery: null, adaptationCost: null, adaptationValidation: null, adaptationPersistence: null, adaptationReuse: null,
});

/** The lines of `report.md` under `heading`, up to the next `## ` heading. */
function section(markdown: string, heading: string): string[] {
  const lines = markdown.split("\n");
  const start = lines.indexOf(heading);
  assert.notEqual(start, -1, `report.md has no "${heading}" section:\n${markdown}`);
  const end = lines.findIndex((line, index) => index > start && line.startsWith("## "));
  return lines.slice(start + 1, end === -1 ? undefined : end);
}
/** A section's table rows, without the header and the separator. */
const tableRows = (lines: readonly string[]): string[] => lines.filter((line) => line.startsWith("| ")).slice(2);

/**
 * `report.json` counts every rate over one lane, but the latency, duration and
 * evidence-size distributions and the truncation count over both. Here one
 * W01 run on each lane gives a 40 ms recording-lane click and a 900 ms
 * Flow-lane click: an unlabelled p95 of 900 beside per-lane rates reads as
 * Flow-lane latency, and a p50 of 40 as fast FluxIQ execution. Neither is.
 */
test("report.md labels every distribution and the truncation count all lanes, and keeps every rate on one lane", () => {
  const lanes: EvaluationLane[] = ["recording", "flow"];
  const evaluations = [run("recording", 30_000, 40), run("flow", 50_000, 900)];
  const results = groupBenchResults(evaluations.map((evaluation) => ({ corpusRowId: "W01", evaluation })));
  const report = aggregateBenchReport({ reportId: "bench-unit", generatedAt: "2026-09-13T10:00:00.000Z", corpusId: "week1", repeatCount: 1, target: "isolated", results });
  const coverage: BenchMarkdownCoverage = { total: benchExecutionCoverage(results), byLane: Object.fromEntries(benchResultsByLane(results).map(([lane, onLane]) => [lane, benchExecutionCoverage(onLane)])) };
  const runs: BenchRunsFile = {
    schemaVersion: "0.1", benchId: "bench-unit", corpusId: "week1", repeatCount: 1, target: "isolated", lanes,
    startedAt: "2026-09-13T09:00:00.000Z", finishedAt: "2026-09-13T10:00:00.000Z", sources: {}, flowSources: {},
    runs: lanes.map((lane) => ({ corpusRowId: "W01", scenarioId: "basic-form", workflowId: null, variantId: null, repeatIndex: 0, lane, status: "evaluated", runId: `run-${lane}`, verdict: "passed", actionsExecuted: 1 })),
  };
  const markdown = renderBenchMarkdown(runs, report, coverage);

  const distributions = section(markdown, "## Distributions, all lanes");
  assert.ok(distributions.includes("| Lane | Metric | Samples | p50 | p95 |"), distributions.join("\n"));
  assert.deepEqual(tableRows(distributions), [
    "| all lanes | Action latency web.dom.click (ms) | 2 | 40 | 900 |",
    "| all lanes | Run duration (ms) | 2 | 30000 | 50000 |",
    "| all lanes | Sanitized packet bytes | 0 | n/a | n/a |",
    "| all lanes | Raw snapshot bytes | 0 | n/a | n/a |",
  ]);
  assert.ok(distributions.some((line) => line.startsWith("Truncation count, all lanes: 0.")), distributions.join("\n"));

  const rates = tableRows(section(markdown, "## Rates"));
  assert.ok(rates.length > 0, "report.md prints no rate");
  assert.deepEqual([...new Set(rates.map((line) => line.split(" | ")[0]))], ["| recording", "| flow"], "every rate names one lane, never all lanes");
});
