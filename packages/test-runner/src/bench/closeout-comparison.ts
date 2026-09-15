import type { BenchComparisonOutcome, BenchReport } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../failure.js";
import type { BenchResultRuns } from "./aggregate-report.js";
import { comparisonExitCriteria, comparisonMetricRows, comparisonVerdictDifferences, type ComparisonMetricRow, type ExitCriterionFigure, type VerdictDifference } from "./comparison-details.js";
import { summarizeBenchComparison } from "./compare-reports.js";
import { loadBenchReport, loadBenchResults, type BenchCampaignTopology } from "./load-report.js";
import { readPersistenceDiscardDiagnostics, type PersistenceDiscardDiagnostics } from "./persistence-discard-diagnostics.js";

export type BenchCloseoutComparison = { baselineReportId: string; candidateReportId: string; outcome: BenchComparisonOutcome; comparisonPassed: boolean; advisory: string[]; topology: { baseline: BenchCampaignTopology; candidate: BenchCampaignTopology; identical: boolean }; metrics: ComparisonMetricRow[]; differingVerdicts: { results: VerdictDifference[]; runs: VerdictDifference[] }; exitCriteria: ExitCriterionFigure[]; persistenceDiscards: { baseline: PersistenceDiscardDiagnostics; candidate: PersistenceDiscardDiagnostics }; gaps: string[] };
export type BenchCloseoutRequest = { runsDirectory: string; cwd: string; baseline: string; candidate: string; sharedLoad: boolean };

/** Week 1 closeout view built on the same validated reports and contract comparison as `lab compare`. */
export async function compareBenchCloseoutCommand(request: BenchCloseoutRequest): Promise<BenchCloseoutComparison> {
  const baseline = await loadBenchReport(request.baseline, request.runsDirectory, request.cwd); const candidate = await loadBenchReport(request.candidate, request.runsDirectory, request.cwd);
  const topology = { baseline: baseline.topology ?? { mode: "serial" } as const, candidate: candidate.topology ?? { mode: "serial" } as const };
  const topologyIdentical = JSON.stringify(topology.baseline) === JSON.stringify(topology.candidate);
  if (request.sharedLoad && !topologyIdentical) throw new RunnerFailure("fixture.invalid", `Shared-load closeout requires identical execution topology (${topologyLabel(topology.baseline)} versus ${topologyLabel(topology.candidate)})`);
  const comparison = summarizeBenchComparison(baseline.report, candidate.report);
  const [baselineRuns, candidateRuns] = await Promise.all([loadBenchResults(baseline.directory), loadBenchResults(candidate.directory)]);
  assertCompleteBundle(baseline.report, baselineRuns); assertCompleteBundle(candidate.report, candidateRuns);
  const metrics = comparisonMetricRows(baseline.report, candidate.report, comparison.metrics);
  const differingVerdicts = comparisonVerdictDifferences(baseline.report, candidate.report, baselineRuns, candidateRuns);
  const exitCriteria = comparisonExitCriteria(baseline.report, candidate.report, baselineRuns, candidateRuns, metrics, differingVerdicts, request.sharedLoad);
  const [baselineDiscards, candidateDiscards] = await Promise.all([readPersistenceDiscardDiagnostics(baseline.directory, request.runsDirectory), readPersistenceDiscardDiagnostics(candidate.directory, request.runsDirectory)]);
  const topologyGap = topologyIdentical ? [] : [`execution topology differs: ${topologyLabel(topology.baseline)} versus ${topologyLabel(topology.candidate)}`];
  const gaps = [...topologyGap, ...metrics.filter(row => row.verdict === "not-compared").map(row => `${row.metric}: absent or unmeasured in at least one report`), ...metrics.filter(row => row.verdict === "no-tolerance-stated").map(row => `${row.metric}: no tolerance stated`), "criterion 2 external evidence assertions are not encoded in BenchReport", "criterion 6 blocker ranking is not encoded in BenchReport"];
  const comparisonPassed = metrics.every(row => row.verdict !== "improved" && row.verdict !== "regressed" && row.verdict !== "not-compared") && differingVerdicts.results.length === 0 && differingVerdicts.runs.length === 0;
  return { baselineReportId: comparison.baselineReportId, candidateReportId: comparison.candidateReportId, outcome: comparison.outcome, comparisonPassed, advisory: comparison.advisory, topology: { ...topology, identical: topologyIdentical }, metrics, differingVerdicts, exitCriteria, persistenceDiscards: { baseline: baselineDiscards, candidate: candidateDiscards }, gaps };
}

function topologyLabel(topology: BenchCampaignTopology): string {
  return topology.mode === "serial" ? "serial" : `${topology.algorithm}/shards=${topology.shardCount}/jobs=${topology.jobs}`;
}

function assertCompleteBundle(report: BenchReport, results: readonly BenchResultRuns[]): void {
  if (results.length !== report.workflows.length) throw new RunnerFailure("fixture.invalid", `Bench ${report.reportId} report lists ${report.workflows.length} results but runs.json provides ${results.length} evaluated result groups`);
  const legacy = report.workflows.every(result => result.lane === undefined);
  if (!legacy && report.workflows.some(result => result.lane === undefined)) throw new RunnerFailure("fixture.invalid", `Bench ${report.reportId} mixes lane-aware and legacy result identities`);
  const key = (result: { corpusRowId: string; scenarioId: string; workflowId: string | null; variantId: string | null; lane?: string }): string => JSON.stringify([result.corpusRowId, result.scenarioId, result.workflowId, result.variantId, legacy ? null : result.lane]);
  const loaded = new Map(results.map(result => [key(result), result]));
  for (const expected of report.workflows) {
    const actual = loaded.get(key(expected));
    if (!actual) throw new RunnerFailure("fixture.invalid", `Bench ${report.reportId} runs.json is missing result ${expected.corpusRowId}/${expected.scenarioId}/${expected.variantId ?? "unarmed"}`);
    if (actual.evaluations.length !== report.repeatCount || expected.runs !== report.repeatCount) throw new RunnerFailure("fixture.invalid", `Bench ${report.reportId} result ${expected.corpusRowId}/${expected.scenarioId}/${expected.variantId ?? "unarmed"} does not have exactly ${report.repeatCount} evaluated repeats`);
  }
}
