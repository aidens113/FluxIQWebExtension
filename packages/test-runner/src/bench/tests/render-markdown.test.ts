import assert from "node:assert/strict";
import test from "node:test";
import { benchExtractionRateMetrics, type EvaluationLane, type RunEvaluation, type RunExtractionMeasurement } from "@fluxiq-web-extension/test-contracts";
import { aggregateBenchReport, benchResultsByLane, groupBenchResults } from "../aggregate-report.js";
import { benchExecutionCoverage } from "../execution-coverage.js";
import { BENCH_EXTRACTION_RATE_DEFINITIONS } from "../extraction-metrics.js";
import { renderBenchMarkdown, type BenchMarkdownCoverage } from "../render-markdown.js";
import type { BenchRunsFile } from "../report-store.js";

/** One W01 run on `lane`, with one click taking `clickMs`. */
const run = (lane: EvaluationLane, durationMs: number, clickMs: number): RunEvaluation => ({
  schemaVersion: "0.3", runId: `run-${lane}`, verdict: "passed", facilityFailure: null, invariants: [], metrics: {},
  scenarioId: "basic-form", workflowId: null, variantId: null, repeatIndex: 0, lane, flowCreated: lane === "flow" ? true : null,
  oracleVerdict: "passed", reportedVerdict: "passed", automationFailureReported: null, automationFailureExpected: null,
  harnessActivations: 0, durationMs, actions: [{ actionType: "web.dom.click", durationMs: clickMs }], evidence: { sanitizedPacketBytes: [], rawSnapshotBytes: [], truncationCount: 0 },
  llm: { mode: "disabled", profileId: null, calls: 0 },
  extraction: null,
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

/**
 * A reader of an extraction rate must be able to see what it stands on. The
 * Flow-lane run below judges three steps: one compares two records and gets
 * one right, one states a count alone and compares nothing, and one judges
 * neither. The record accuracy is 0.5 over the compared step, the count
 * accuracy 1.000 over the count-only step, and the basis line says so.
 */
test("report.md states each extraction rate with the steps it stands on, and prints n/a for a rate nothing judged", () => {
  const step = (fields: Partial<RunExtractionMeasurement>): RunExtractionMeasurement => ({
    stepIndex: 1, status: "judged", expectedRecords: 0, observedRecords: 0, recordsListed: false, countStated: false,
    comparedRecords: 0, matchedRecords: 0, expectedFields: 0, presentFields: 0, unexpectedFields: 0,
    matchedInAnyOrder: 0, unjudged: [], expectedPages: null, pagesFollowed: null, truncated: null, durationMs: null, nonStringValues: 0, ...fields,
  });
  const evaluation: RunEvaluation = {
    ...run("flow", 50_000, 900),
    extraction: [
      step({ recordsListed: true, expectedRecords: 2, observedRecords: 2, comparedRecords: 2, matchedRecords: 1, expectedFields: 2, presentFields: 1, expectedPages: 3 }),
      step({ countStated: true, expectedRecords: 1_000, observedRecords: 1_000 }),
      step({}),
    ],
  };
  const results = groupBenchResults([{ corpusRowId: "W04", evaluation }]);
  const report = aggregateBenchReport({ reportId: "bench-extraction", generatedAt: "2026-09-15T10:00:00.000Z", corpusId: "week1", repeatCount: 1, target: "isolated", results });
  const coverage: BenchMarkdownCoverage = { total: benchExecutionCoverage(results), byLane: Object.fromEntries(benchResultsByLane(results).map(([lane, onLane]) => [lane, benchExecutionCoverage(onLane)])) };
  const runs: BenchRunsFile = {
    schemaVersion: "0.1", benchId: "bench-extraction", corpusId: "week1", repeatCount: 1, target: "isolated", lanes: ["flow"],
    startedAt: "2026-09-15T09:00:00.000Z", finishedAt: "2026-09-15T10:00:00.000Z", sources: {}, flowSources: {},
    runs: [{ corpusRowId: "W04", scenarioId: "basic-form", workflowId: null, variantId: null, repeatIndex: 0, lane: "flow", status: "evaluated", runId: "run-flow", verdict: "passed", actionsExecuted: 1 }],
  };
  const extraction = section(renderBenchMarkdown(runs, report, coverage), "## Extraction");
  assert.ok(extraction.some((line) => line.includes("3 step(s) judged and 0 not: 1 compared their records, 1 stated a count alone")), extraction.join("\n"));
  assert.ok(extraction.some((line) => line.startsWith("| extractionRecordAccuracy | records | 1 | 2 | 1 | 0.500 | judged steps whose expectation listed the records")), extraction.join("\n"));
  assert.ok(extraction.some((line) => line.startsWith("| extractionCountAccuracy | steps | 1 | 1 | 1 | 1.000 | judged steps that stated a count and listed no records")), extraction.join("\n"));
  // Declared pages nothing observed, so the rate has one side and publishes none.
  assert.ok(extraction.some((line) => line.startsWith("| paginationAccuracy | steps | 0 | 0 | 0 | n/a | judged steps stating both an expected page count")), extraction.join("\n"));
  // Every rate prints the population it was counted over, and it is the one the aggregator computed: a definition that drifts from the counting rule is how a reader comes to compare two rates over different sets of steps.
  for (const metric of benchExtractionRateMetrics) {
    assert.ok(extraction.some((line) => line.startsWith(`| ${metric} | `) && line.endsWith(` | ${BENCH_EXTRACTION_RATE_DEFINITIONS[metric].definition} |`)), `${metric} prints no population: ${extraction.join("\n")}`);
  }
  // A bench that measured no extraction prints no section at all, rather than a table of zeros.
  const plain = groupBenchResults([{ corpusRowId: "W01", evaluation: run("flow", 50_000, 900) }]);
  const plainReport = aggregateBenchReport({ reportId: "bench-plain", generatedAt: "2026-09-15T10:00:00.000Z", corpusId: "week1", repeatCount: 1, target: "isolated", results: plain });
  assert.equal(renderBenchMarkdown(runs, plainReport, coverage).includes("## Extraction"), false);
});
