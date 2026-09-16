import { benchExtractionRateMetrics, benchRateMetrics, evaluationLanes, type BenchMetricComparison, type BenchReport, type BenchRate, type EvaluationLane } from "@fluxiq-web-extension/test-contracts";
import type { BenchResultRuns } from "./aggregate-report.js";

export type ComparisonMetricRow = { metric: string; baseline: number | null; candidate: number | null; tolerance: number | null; verdict: "improved" | "regressed" | "equivalent" | "not-compared" | "not-applicable" | "no-tolerance-stated"; note?: string };
export type VerdictDifference = { corpusRowId: string; scenarioId: string; workflowId: string | null; variantId: string | null; lane: EvaluationLane; repeatIndex?: number; baselineVerdict: string; candidateVerdict: string; baselineCategory?: string; candidateCategory?: string };
export type ExitCriterionFigure = { criterion: 1 | 2 | 3 | 4 | 5 | 6; name: string; baseline: Record<string, number | string | null>; candidate: Record<string, number | string | null>; status: "measured" | "partially-measured" | "not-measured"; note?: string };

const rateValue = (report: BenchReport, lane: EvaluationLane, metric: typeof benchRateMetrics[number]): BenchRate | undefined => {
  if (report.metrics.ratesByLane) return report.metrics.ratesByLane[lane]?.[metric];
  const recordingAlone = report.workflows.every(result => result.lane === undefined && result.variantId === null);
  return lane === "recording" && recordingAlone ? report.metrics.rates?.[metric] : undefined;
};

/**
 * One extraction rate of one lane, or `undefined` when that report did not
 * measure it: a report written before extraction was measured states no block
 * at all, and a rate whose population was empty states `rate: null`. Neither
 * is a zero, so neither may be compared as one.
 */
const extractionValue = (report: BenchReport, lane: EvaluationLane, metric: typeof benchExtractionRateMetrics[number]): BenchRate | undefined =>
  report.metrics.extractionByLane?.[lane]?.[metric];

export function comparisonMetricRows(baseline: BenchReport, candidate: BenchReport, compared: readonly BenchMetricComparison[]): ComparisonMetricRow[] {
  const byName = new Map(compared.map(item => [item.metric, item]));
  const names = [
    ...evaluationLanes.flatMap(lane => benchRateMetrics.map(metric => `rate:${lane}:${metric}`)),
    ...evaluationLanes.flatMap(lane => benchExtractionRateMetrics.map(metric => `extraction:${lane}:${metric}`)),
    ...[...new Set([...Object.keys(baseline.metrics.actionLatencyMs), ...Object.keys(candidate.metrics.actionLatencyMs)])].sort().map(type => `action-latency-p95:${type}`), "run-duration-p95"];
  const rows = names.map((metric): ComparisonMetricRow => {
    const value = byName.get(metric);
    if (value) return { metric: value.metric, baseline: value.baseline, candidate: value.candidate, tolerance: value.tolerance, verdict: value.outcome };
    const [kind, lane, name] = metric.split(":");
    const measured = (report: BenchReport): number | null | undefined => kind === "rate"
      ? rateValue(report, lane as EvaluationLane, name as typeof benchRateMetrics[number])?.rate
      : kind === "extraction"
        ? extractionValue(report, lane as EvaluationLane, name as typeof benchExtractionRateMetrics[number])?.rate
        : metric === "run-duration-p95" ? report.metrics.runDurationMs.p95 : report.metrics.actionLatencyMs[metric.slice("action-latency-p95:".length)]?.p95;
    const base = measured(baseline);
    const next = measured(candidate);
    if ((base === null || base === undefined) && (next === null || next === undefined)) return { metric, baseline: null, candidate: null, tolerance: null, verdict: "not-applicable", note: "neither report has a population or measurement for this metric" };
    return { metric, baseline: base ?? null, candidate: next ?? null, tolerance: null, verdict: "not-compared", note: "absent or unmeasured in exactly one report" };
  });
  for (const type of [...new Set([...Object.keys(baseline.metrics.actionLatencyMs), ...Object.keys(candidate.metrics.actionLatencyMs)])].sort()) rows.push({ metric: `action-latency-p50:${type}`, baseline: baseline.metrics.actionLatencyMs[type]?.p50 ?? null, candidate: candidate.metrics.actionLatencyMs[type]?.p50 ?? null, tolerance: null, verdict: "no-tolerance-stated", note: "Week 1 repeatability tolerance applies to latency p95 only" });
  rows.push({ metric: "run-duration-p50", baseline: baseline.metrics.runDurationMs.p50, candidate: candidate.metrics.runDurationMs.p50, tolerance: null, verdict: "no-tolerance-stated", note: "Week 1 repeatability tolerance applies to latency p95 only" });
  for (const metric of ["sanitizedPacketBytes", "rawSnapshotBytes"] as const) for (const percentile of ["p50", "p95"] as const) rows.push({ metric: `evidence-${metric}-${percentile}`, baseline: baseline.metrics[metric][percentile], candidate: candidate.metrics[metric][percentile], tolerance: null, verdict: "no-tolerance-stated", note: "Week 1 states no repeatability tolerance for evidence size" });
  rows.push({ metric: "evidence-truncation-count", baseline: baseline.metrics.truncationCount, candidate: candidate.metrics.truncationCount, tolerance: null, verdict: "no-tolerance-stated" });
  for (const metric of ["harnessRecovery", "adaptationCost", "adaptationValidation", "adaptationPersistence", "adaptationReuse"] as const) rows.push({ metric: `week2-${metric}`, baseline: baseline.metrics[metric], candidate: candidate.metrics[metric], tolerance: null, verdict: "no-tolerance-stated", note: "Week 1 requires this reserved field to be null" });
  return rows;
}

const resultKey = (item: { corpusRowId: string; scenarioId: string; workflowId: string | null; variantId: string | null; lane: EvaluationLane }): string => JSON.stringify([item.corpusRowId, item.scenarioId, item.workflowId, item.variantId, item.lane]);

export function comparisonVerdictDifferences(baseline: BenchReport, candidate: BenchReport, baselineRuns: readonly BenchResultRuns[], candidateRuns: readonly BenchResultRuns[]): { results: VerdictDifference[]; runs: VerdictDifference[] } {
  const candidateResults = new Map(candidate.workflows.filter(item => item.lane !== undefined).map(item => [resultKey(item as typeof item & { lane: EvaluationLane }), item]));
  const results = baseline.workflows.flatMap((item): VerdictDifference[] => {
    if (item.lane === undefined) return [];
    const next = candidateResults.get(resultKey(item as typeof item & { lane: EvaluationLane }));
    if (!next || (item.passRate === next.passRate && item.flakeClass === next.flakeClass)) return next ? [] : [{ ...item, lane: item.lane, baselineVerdict: `${item.flakeClass}:${item.passRate}`, candidateVerdict: "absent" }];
    return [{ ...item, lane: item.lane, baselineVerdict: `${item.flakeClass}:${item.passRate}`, candidateVerdict: `${next.flakeClass}:${next.passRate}` }];
  });
  const candidateEvaluations = new Map(candidateRuns.flatMap(result => result.evaluations.map(evaluation => [`${resultKey(result)}:${evaluation.repeatIndex}`, evaluation] as const)));
  const runs = baselineRuns.flatMap(result => result.evaluations.flatMap((evaluation): VerdictDifference[] => {
    const next = candidateEvaluations.get(`${resultKey(result)}:${evaluation.repeatIndex}`);
    const baseCategory = evaluation.automationFailureReported?.category ?? evaluation.failureCategory;
    const nextCategory = next?.automationFailureReported?.category ?? next?.failureCategory;
    if (next && evaluation.verdict === next.verdict && baseCategory === nextCategory) return [];
    return [{ corpusRowId: result.corpusRowId, scenarioId: result.scenarioId, workflowId: result.workflowId, variantId: result.variantId, lane: result.lane, repeatIndex: evaluation.repeatIndex, baselineVerdict: evaluation.verdict, candidateVerdict: next?.verdict ?? "absent", ...(baseCategory ? { baselineCategory: baseCategory } : {}), ...(nextCategory ? { candidateCategory: nextCategory } : {}) }];
  }));
  const baselineResultKeys = new Set(baseline.workflows.filter(item => item.lane !== undefined).map(item => resultKey(item as typeof item & { lane: EvaluationLane })));
  for (const item of candidate.workflows) if (item.lane !== undefined && !baselineResultKeys.has(resultKey(item as typeof item & { lane: EvaluationLane }))) results.push({ ...item, lane: item.lane, baselineVerdict: "absent", candidateVerdict: `${item.flakeClass}:${item.passRate}` });
  const baselineEvaluationKeys = new Set(baselineRuns.flatMap(result => result.evaluations.map(evaluation => `${resultKey(result)}:${evaluation.repeatIndex}`)));
  for (const result of candidateRuns) for (const evaluation of result.evaluations) if (!baselineEvaluationKeys.has(`${resultKey(result)}:${evaluation.repeatIndex}`)) runs.push({ corpusRowId: result.corpusRowId, scenarioId: result.scenarioId, workflowId: result.workflowId, variantId: result.variantId, lane: result.lane, repeatIndex: evaluation.repeatIndex, baselineVerdict: "absent", candidateVerdict: evaluation.verdict, ...(evaluation.automationFailureReported?.category ?? evaluation.failureCategory ? { candidateCategory: evaluation.automationFailureReported?.category ?? evaluation.failureCategory } : {}) });
  return { results, runs };
}

function criterionCounts(results: readonly BenchResultRuns[]) {
  const stable = (items: readonly BenchResultRuns[]) => items.filter(result => result.evaluations.every(run => run.verdict === "passed")).length;
  const unarmed = results.filter(result => result.variantId === null && Number(result.corpusRowId.slice(1)) <= 19);
  const fallback = results.filter(result => result.lane === "flow" && (["W20", "W21", "W22", "W23"].includes(result.corpusRowId) || (result.corpusRowId === "W26" && result.variantId === null)));
  const required = results.flatMap(result => result.evaluations.map(run => ({ row: result.corpusRowId, run }))).filter(item => ["W14", "W19", "W27"].includes(item.row) && item.run.automationFailureExpected !== null).map(item => item.run);
  const negatives = results.flatMap(result => result.evaluations).filter(run => run.automationFailureExpected !== null);
  const classified = (runs: typeof required) => runs.filter(run => run.automationFailureReported?.category === run.automationFailureExpected?.category).length;
  const all = results.flatMap(result => result.evaluations);
  const recording = unarmed.filter(result => result.lane === "recording"); const flow = unarmed.filter(result => result.lane === "flow");
  const recovered = fallback.filter(result => result.evaluations.every(run => run.verdict === "passed" && run.harnessActivations === 0)).length;
  return { recordingUnarmedTotal: recording.length, recordingUnarmedStable: stable(recording), flowUnarmedTotal: flow.length, flowUnarmedStable: stable(flow), evidencePackets: all.reduce((sum, run) => sum + run.evidence.sanitizedPacketBytes.length, 0), evidenceTruncations: all.reduce((sum, run) => sum + run.evidence.truncationCount, 0), fallbackTotal: fallback.length, fallbackRecoveredWithoutHarness: recovered, requiredNegativeTotal: required.length, requiredNegativeCorrect: classified(required), everyNegativeTotal: negatives.length, everyNegativeCorrect: classified(negatives) };
}

export function comparisonExitCriteria(baseline: BenchReport, candidate: BenchReport, baselineRuns: readonly BenchResultRuns[], candidateRuns: readonly BenchResultRuns[], metricRows: readonly ComparisonMetricRow[], differing: { results: readonly VerdictDifference[]; runs: readonly VerdictDifference[] }, sharedLoad: boolean): ExitCriterionFigure[] {
  const a = criterionCounts(baselineRuns); const b = criterionCounts(candidateRuns);
  const figures = (value: ReturnType<typeof criterionCounts>, report: BenchReport) => ({ ...value, repeatCount: report.repeatCount });
  const repeatProof = baseline.repeatCount >= 3 && candidate.repeatCount >= 3;
  const outside = metricRows.filter(row => row.verdict === "regressed" || row.verdict === "improved").length;
  const missing = metricRows.filter(row => row.verdict === "not-compared").length;
  return [
    { criterion: 1, name: "actions-reliable", baseline: figures(a, baseline), candidate: figures(b, candidate), status: repeatProof ? "measured" : "partially-measured", note: "Unarmed W01-W19 workflow results stable across every repeat; Week 1 proof requires repeatCount >= 3 in both reports" },
    { criterion: 2, name: "evidence-useful", baseline: { packetSamples: a.evidencePackets, truncations: a.evidenceTruncations }, candidate: { packetSamples: b.evidencePackets, truncations: b.evidenceTruncations }, status: "partially-measured", note: "Bench reports do not encode the external 16-item and sensitive-input leak assertions" },
    { criterion: 3, name: "deterministic-fallback", baseline: { recoveredWithoutHarness: a.fallbackRecoveredWithoutHarness, total: a.fallbackTotal, repeatCount: baseline.repeatCount }, candidate: { recoveredWithoutHarness: b.fallbackRecoveredWithoutHarness, total: b.fallbackTotal, repeatCount: candidate.repeatCount }, status: repeatProof ? "measured" : "partially-measured", note: "W20-W23 drift variants and unarmed contextual W26 only; every repeat must pass with zero harness activations" },
    { criterion: 4, name: "failures-classified", baseline: { requiredCorrect: a.requiredNegativeCorrect, requiredTotal: a.requiredNegativeTotal, allCorrect: a.everyNegativeCorrect, allTotal: a.everyNegativeTotal, repeatCount: baseline.repeatCount }, candidate: { requiredCorrect: b.requiredNegativeCorrect, requiredTotal: b.requiredNegativeTotal, allCorrect: b.everyNegativeCorrect, allTotal: b.everyNegativeTotal, repeatCount: candidate.repeatCount }, status: repeatProof ? "measured" : "partially-measured", note: "Required W14/W19/W27 accuracy target is at least 0.9; all negative variants are shown alongside it" },
    { criterion: 5, name: "bench-repeatable", baseline: { metricsRendered: metricRows.length, outsideTolerance: outside, differingResults: differing.results.length, differingRuns: differing.runs.length, repeatCount: baseline.repeatCount }, candidate: { metricsRendered: metricRows.length, absentComparableMetrics: missing, differingResults: differing.results.length, differingRuns: differing.runs.length, repeatCount: candidate.repeatCount }, status: missing || !repeatProof ? "partially-measured" : "measured", note: `${sharedLoad ? "latency measured under shared load" : "latency measured sequentially"}; no-tolerance rows are disclosures; Week 1 proof requires repeatCount >= 3 in both reports` },
    { criterion: 6, name: "blockers-ranked", baseline: { rankedBlockers: null }, candidate: { rankedBlockers: null }, status: "not-measured", note: "The Phase 1.6b blocker ranking is authored ledger evidence, not a BenchReport field" },
  ];
}
