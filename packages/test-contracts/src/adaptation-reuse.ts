/**
 * The Week 2 measurements of what became of a run's adaptations: whether the
 * run reused them without the model, how far each has been proven, where each
 * stands in Core's store, and what the model cost. `RunEvaluation` carries one
 * of each as `adaptationReuse`, `adaptationValidation`,
 * `adaptationPersistence` and `adaptationCost`.
 *
 * All four are read from Core's own records (run detail and the adaptation
 * store), never from the Lab's bookkeeping, and carry **identifiers, closed
 * words and numbers only**. Each is `null` on the evaluation when the run did
 * not measure it. Inside a measured record a number Core did not state is
 * `null` too, never `0`: a zero is a measurement.
 */

/**
 * Whether the run exercised adaptations without the model: the reuse proof of
 * Phase 2.9. A deterministic replay is a record whose
 * `exercisedAdaptationIds` is not empty and whose `providerCalls` and
 * `interventions` are both `0`; a `providerCalls` of `null` certifies nothing.
 */
export type RunAdaptationReuse = {
  /**
   * The adaptations, not created by this run and `applied` in Core's store,
   * whose ids Core stamped on a node this run attempted (the node's
   * `metadata.adaptationIds`), in attempt order, each once. Core's own replay
   * rule counts the same stamps.
   */
  exercisedAdaptationIds: string[];
  /** The provider calls Core counted for the run (`providerCallCount`), `null` when Core stated no count. */
  providerCalls: number | null;
  /** The LLM interventions Core recorded for the run. */
  interventions: number;
  /**
   * How the run continued after a change's in-run trial, `null` when it did
   * not resume from one: Core's `metadata.adaptiveRetry` for the status and
   * attempt count, and its resumable patch attempts' `resumeFrom` and
   * `adaptationId` for the point and the changes trialled.
   */
  resume: RunAdaptationResume | null;
};

/**
 * Core's resume record: the run continued from `fromNodeId` along
 * `fromRoute` after trialling `adaptationIds`, and that continuation ended
 * with `status` after `attemptCount` node attempts. `status` is Core's word,
 * never its sentence.
 */
export type RunAdaptationResume = {
  fromNodeId: string;
  fromRoute: string;
  status: string;
  attemptCount: number;
  adaptationIds: string[];
};

/** Core's confidence tiers (`AutomationStudioChangeConfidence`), lowest first. */
export const adaptationConfidenceTiers = ["unverified", "provisional", "established"] as const;
export type AdaptationConfidenceTier = (typeof adaptationConfidenceTiers)[number];

/** Which kind of evidence last failed an adaptation. */
export type AdaptationEvidenceKind = "trial" | "replay";

/**
 * How far each adaptation the run created or exercised has been proven, as
 * Core graded it after the run. An empty list is a run with nothing to grade.
 */
export type RunAdaptationValidation = { adaptations: RunAdaptationConfidence[] };

/**
 * One adaptation's tier and the evidence behind it, as Core's
 * `decideAutomationStudioChangeConfidence` returns them: `trials` and
 * `replays` are the succeeded trials and replays Core counted toward the tier,
 * and `lastFailure` is the kind of evidence that last failed, `null` when none
 * has. `established` is earned by replays alone, and `provisional` by at least
 * one succeeded trial or replay.
 */
export type RunAdaptationConfidence = {
  adaptationId: string;
  tier: AdaptationConfidenceTier;
  trials: number;
  replays: number;
  lastFailure: AdaptationEvidenceKind | null;
};

/** Core's adaptation statuses (`AutomationStudioFlowAdaptationStatus`), `proposed` included: a build or repair awaiting review is stored as one. */
export const adaptationRecordStatuses = ["proposed", "testing", "validated", "applied", "rejected", "disabled", "reverted", "superseded"] as const;
export type AdaptationRecordStatus = (typeof adaptationRecordStatuses)[number];

/**
 * Where each adaptation the run created or exercised stands in Core's
 * adaptation store after the run. An empty list is a run with none.
 */
export type RunAdaptationPersistence = { adaptations: RunAdaptationRecord[] };

/**
 * One stored adaptation: Core's `status`, the Flow revision the change was
 * proposed against, and the revision Core recorded when it applied the change,
 * `null` when it holds none. Core may record the base revision as the applied
 * one, so the two can be equal; whether the change is still applied is what
 * `status` says.
 */
export type RunAdaptationRecord = {
  adaptationId: string;
  status: AdaptationRecordStatus;
  baseRevision: number;
  appliedRevision: number | null;
};

/**
 * What the model cost the run, from Core's accounting.
 *
 * `providerCalls` is Core's count of the run's calls, the same figure as
 * `RunAdaptationReuse.providerCalls`. The four totals are what Core charged
 * the run (`llmGate.costAccounting`): the provider's reported usage where it
 * reported any, the call's reservation otherwise. They are one reading, so
 * they are stated together or are all `null`. `reservedCalls` counts the
 * itemized calls Core charged at their reservation, `null` unless Core
 * itemized every call. A cost over the Lab's budget is a measurement, and is
 * recorded as measured.
 */
export type RunAdaptationCost = {
  providerCalls: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  estimatedCostUsd: number | null;
  reservedCalls: number | null;
};

/**
 * The four measurements one run can carry, together: what a Flow-lane run
 * writes to its bundle's `snapshots/adaptation.json` and what
 * `RunEvaluation` copies member by member. Each is `null` when not measured.
 */
export type RunAdaptationMeasurements = {
  adaptationReuse: RunAdaptationReuse | null;
  adaptationValidation: RunAdaptationValidation | null;
  adaptationPersistence: RunAdaptationPersistence | null;
  adaptationCost: RunAdaptationCost | null;
};

/**
 * FluxBench's Week 2 aggregates over a bench's runs, each `null` when no run
 * measured it. They are counts over the runs' own records and never re-read
 * Core, so a report and its `runs.json` always agree.
 *
 * Reuse is the Phase 2.9 proof. A run is **exercising** when it executed a node
 * stamped with an adaptation it did not create, and a **deterministic replay**
 * when it was exercising and Core counted 0 provider calls and 0
 * interventions. A run whose count Core did not state is **uncertified**: it
 * is neither a replay nor a miss, and `rate` is replays over the exercising
 * runs whose count was stated.
 */
export type BenchAdaptationReuse = {
  measuredRuns: number;
  exercisingRuns: number;
  deterministicReplays: number;
  uncertifiedRuns: number;
  resumedRuns: number;
  rate: number | null;
};

/** Each graded adaptation once per run that graded it, counted by Core's tier. */
export type BenchAdaptationValidation = {
  measuredRuns: number;
  adaptations: number;
  tiers: Record<AdaptationConfidenceTier, number>;
};

/** Each stored adaptation once per run that read it, counted by Core's status after the run. */
export type BenchAdaptationPersistence = {
  measuredRuns: number;
  adaptations: number;
  statuses: Record<AdaptationRecordStatus, number>;
};

/**
 * What the model cost the bench, summed from Core's accounting. `countedRuns`
 * are the runs whose provider calls Core stated, and `providerCalls` their
 * sum; `accountedRuns` are the runs with Core's token and USD totals, which the
 * four totals sum. A run that stated neither adds to `measuredRuns` alone.
 */
export type BenchAdaptationCost = {
  measuredRuns: number;
  countedRuns: number;
  providerCalls: number;
  accountedRuns: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
};
