import assert from "node:assert/strict";
import test from "node:test";
import { assertBenchReport, type RunAdaptationReuse, type RunEvaluation } from "@fluxiq-web-extension/test-contracts";
import { benchAdaptationMetrics } from "../adaptation-metrics.js";
import { aggregateBenchReport, type BenchResultRuns } from "../aggregate-report.js";

const run = (repeatIndex: number, fields: Partial<RunEvaluation> = {}): RunEvaluation => ({
  schemaVersion: "0.3", runId: `run-${repeatIndex}`, verdict: "passed", facilityFailure: null, invariants: [], metrics: {},
  scenarioId: "identity-drift", workflowId: null, variantId: "renamed-redesign", repeatIndex, lane: "flow", flowCreated: true,
  oracleVerdict: "passed", reportedVerdict: "passed", automationFailureReported: null, automationFailureExpected: null,
  harnessActivations: 0, durationMs: 40_000, actions: [], evidence: { sanitizedPacketBytes: [], rawSnapshotBytes: [], truncationCount: 0 },
  llm: { mode: "disabled", profileId: null, calls: 0 },
  extraction: null,
  harnessRecovery: null, adaptationCost: null, adaptationValidation: null, adaptationPersistence: null, adaptationReuse: null,
  ...fields,
});
const reuse = (exercised: string[], providerCalls: number | null, interventions = 0): RunAdaptationReuse => ({ exercisedAdaptationIds: exercised, providerCalls, interventions, resume: null });

test("a bench no run of which measured an adaptation states all four aggregates unmeasured, never zeros", () => {
  assert.deepEqual(benchAdaptationMetrics([run(0), run(1)]), { adaptationCost: null, adaptationValidation: null, adaptationPersistence: null, adaptationReuse: null });
});

/**
 * The reuse rate is judged by Core's counts: a replay is an exercising run with
 * 0 calls and 0 interventions; a run whose count Core did not state is
 * uncertified and kept out of the rate, and a run that exercised nothing is in
 * neither.
 */
test("reuse counts deterministic replays over the exercising runs Core certified, with the uncertified beside them", () => {
  const metrics = benchAdaptationMetrics([
    run(0, { adaptationReuse: reuse(["adaptation.a"], 0) }),
    run(1, { adaptationReuse: reuse(["adaptation.a"], 0, 1) }),
    run(2, { adaptationReuse: reuse(["adaptation.a"], null) }),
    run(3, { adaptationReuse: reuse([], 0) }),
    run(4),
  ]);
  assert.deepEqual(metrics.adaptationReuse, { measuredRuns: 4, exercisingRuns: 3, deterministicReplays: 1, uncertifiedRuns: 1, resumedRuns: 0, rate: 0.5 });
});

test("validation, persistence and cost are tallied from each run's own records and the report carrying them validates", () => {
  const runs = [
    run(0, {
      adaptationReuse: reuse(["adaptation.a"], 0),
      adaptationValidation: { adaptations: [{ adaptationId: "adaptation.a", tier: "established", trials: 1, replays: 2, lastFailure: null }] },
      adaptationPersistence: { adaptations: [{ adaptationId: "adaptation.a", status: "applied", baseRevision: 2, appliedRevision: 3 }] },
      adaptationCost: { providerCalls: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCostUsd: 0, reservedCalls: null },
    }),
    run(1, {
      adaptationReuse: reuse([], null),
      adaptationValidation: { adaptations: [{ adaptationId: "adaptation.b", tier: "unverified", trials: 0, replays: 0, lastFailure: "trial" }] },
      adaptationPersistence: { adaptations: [{ adaptationId: "adaptation.b", status: "proposed", baseRevision: 2, appliedRevision: null }] },
    }),
  ];
  const metrics = benchAdaptationMetrics(runs);
  assert.deepEqual(metrics.adaptationValidation, { measuredRuns: 2, adaptations: 2, tiers: { unverified: 1, provisional: 0, established: 1 } });
  assert.deepEqual(metrics.adaptationPersistence?.statuses.applied, 1);
  assert.deepEqual(metrics.adaptationPersistence?.statuses.proposed, 1);
  assert.deepEqual(metrics.adaptationCost, { measuredRuns: 1, countedRuns: 1, providerCalls: 0, accountedRuns: 1, inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCostUsd: 0 });

  const results: BenchResultRuns[] = [{ corpusRowId: "A01", scenarioId: "identity-drift", workflowId: null, variantId: "renamed-redesign", lane: "flow", evaluations: runs }];
  const report = aggregateBenchReport({ reportId: "bench-week2", generatedAt: "2026-09-29T10:00:00.000Z", corpusId: "week2", repeatCount: 2, target: "isolated", results });
  assertBenchReport(report);
  assert.deepEqual(report.metrics.adaptationReuse, { measuredRuns: 2, exercisingRuns: 1, deterministicReplays: 1, uncertifiedRuns: 0, resumedRuns: 0, rate: 1 });
  assert.equal(report.metrics.harnessRecovery, null);
});

test("the report contract refuses an aggregate that contradicts its own counts", () => {
  const report = aggregateBenchReport({ reportId: "bench-week2", generatedAt: "2026-09-29T10:00:00.000Z", corpusId: "week2", repeatCount: 1, target: "isolated", results: [{ corpusRowId: "A01", scenarioId: "identity-drift", workflowId: null, variantId: "renamed-redesign", lane: "flow", evaluations: [run(0, { adaptationReuse: reuse(["adaptation.a"], 0) })] }] });
  assert.throws(() => assertBenchReport({ ...report, metrics: { ...report.metrics, adaptationReuse: { ...report.metrics.adaptationReuse!, rate: 0 } } }), /rate/u);
  assert.throws(() => assertBenchReport({ ...report, metrics: { ...report.metrics, adaptationValidation: { measuredRuns: 0, adaptations: 0, tiers: { unverified: 0, provisional: 0, established: 0 } } } }), /measuredRuns/u);
});
