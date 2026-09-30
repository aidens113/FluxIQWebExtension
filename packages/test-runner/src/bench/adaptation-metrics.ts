import {
  adaptationConfidenceTiers, adaptationRecordStatuses,
  type BenchAdaptationCost, type BenchAdaptationPersistence, type BenchAdaptationReuse, type BenchAdaptationValidation, type RunEvaluation,
} from "@fluxiq-web-extension/test-contracts";

/** The four Week 2 aggregates of a bench, as `BenchCorpusMetrics` states them. */
export type BenchAdaptationMetrics = {
  adaptationCost: BenchAdaptationCost | null;
  adaptationValidation: BenchAdaptationValidation | null;
  adaptationPersistence: BenchAdaptationPersistence | null;
  adaptationReuse: BenchAdaptationReuse | null;
};

/**
 * The Week 2 adaptation aggregates over a bench's evaluated runs, counted from
 * each run's own records (`RunEvaluation.adaptation*`) and nothing else. An
 * aggregate no run measured is `null`: a block of zeros would claim the bench
 * measured adaptations and found none.
 *
 * Reuse is Phase 2.9's proof, and it is judged by Core's counts, never by a
 * verdict: an exercising run is a deterministic replay only when Core counted
 * 0 provider calls and 0 interventions, and a run whose count Core did not
 * state is uncertified -- left out of the rate's population and counted
 * beside it, so the rate cannot be lifted by runs nobody could certify.
 */
export function benchAdaptationMetrics(runs: readonly RunEvaluation[]): BenchAdaptationMetrics {
  return { adaptationCost: cost(runs), adaptationValidation: validation(runs), adaptationPersistence: persistence(runs), adaptationReuse: reuse(runs) };
}

function reuse(runs: readonly RunEvaluation[]): BenchAdaptationReuse | null {
  const measured = runs.flatMap((run) => (run.adaptationReuse ? [run.adaptationReuse] : []));
  if (measured.length === 0) return null;
  const exercising = measured.filter((record) => record.exercisedAdaptationIds.length > 0);
  const uncertified = exercising.filter((record) => record.providerCalls === null).length;
  const replays = exercising.filter((record) => record.providerCalls === 0 && record.interventions === 0).length;
  const certified = exercising.length - uncertified;
  return {
    measuredRuns: measured.length,
    exercisingRuns: exercising.length,
    deterministicReplays: replays,
    uncertifiedRuns: uncertified,
    resumedRuns: measured.filter((record) => record.resume !== null).length,
    rate: certified === 0 ? null : replays / certified,
  };
}

function validation(runs: readonly RunEvaluation[]): BenchAdaptationValidation | null {
  const measured = runs.flatMap((run) => (run.adaptationValidation ? [run.adaptationValidation] : []));
  if (measured.length === 0) return null;
  const graded = measured.flatMap((record) => record.adaptations);
  return {
    measuredRuns: measured.length,
    adaptations: graded.length,
    tiers: Object.fromEntries(adaptationConfidenceTiers.map((tier) => [tier, graded.filter((entry) => entry.tier === tier).length])) as BenchAdaptationValidation["tiers"],
  };
}

function persistence(runs: readonly RunEvaluation[]): BenchAdaptationPersistence | null {
  const measured = runs.flatMap((run) => (run.adaptationPersistence ? [run.adaptationPersistence] : []));
  if (measured.length === 0) return null;
  const stored = measured.flatMap((record) => record.adaptations);
  return {
    measuredRuns: measured.length,
    adaptations: stored.length,
    statuses: Object.fromEntries(adaptationRecordStatuses.map((status) => [status, stored.filter((entry) => entry.status === status).length])) as BenchAdaptationPersistence["statuses"],
  };
}

function cost(runs: readonly RunEvaluation[]): BenchAdaptationCost | null {
  const measured = runs.flatMap((run) => (run.adaptationCost ? [run.adaptationCost] : []));
  if (measured.length === 0) return null;
  const counted = measured.flatMap((record) => (record.providerCalls === null ? [] : [record.providerCalls]));
  const accounted = measured.filter((record) => record.totalTokens !== null);
  const sum = (of: (record: (typeof accounted)[number]) => number | null): number => accounted.reduce((total, record) => total + (of(record) ?? 0), 0);
  return {
    measuredRuns: measured.length,
    countedRuns: counted.length,
    providerCalls: counted.reduce((total, calls) => total + calls, 0),
    accountedRuns: accounted.length,
    inputTokens: sum((record) => record.inputTokens),
    outputTokens: sum((record) => record.outputTokens),
    totalTokens: sum((record) => record.totalTokens),
    estimatedCostUsd: sum((record) => record.estimatedCostUsd),
  };
}
