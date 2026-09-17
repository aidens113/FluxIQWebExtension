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
  /** The adaptations whose nodes this run executed (Core's `runDetail.metadata.adaptationsExercised`), in Core's order, each once. */
  exercisedAdaptationIds: string[];
  /** The provider calls Core counted for the run (`providerCallCount`), `null` when Core stated no count. */
  providerCalls: number | null;
  /** The LLM interventions Core recorded for the run. */
  interventions: number;
  /** How the run continued after a change's in-run trial (Core's `runDetail.metadata.resume`), `null` when it did not resume from one. */
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

/** Core's adaptation statuses (`AutomationStudioFlowAdaptationStatus`). */
export const adaptationRecordStatuses = ["testing", "validated", "applied", "rejected", "disabled", "reverted", "superseded"] as const;
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
