// The runner's answer reduced to what may be written down: ids, codes, counts,
// field names, the U5 result (whose gap details name causes, paths and
// sequences, never values), the session view Core used with the
// normalizations it declared, the matched / recorded operation counts, and the
// operations a reevaluator answered (tier 2), by ordinal and field path. The
// trial's feedback is reduced separately (`./trial-observation.ts`); the
// matcher's free-text delivery notes are counted, not copied.

import type { AutomationStudioOfflineCandidateTrialOutcome } from "fluxiq/automation-studio";

export type OfflineTrialReport =
  | Readonly<{ status: "refused"; reasonCode: string; detail: string }>
  | Readonly<{
    status: "ran";
    trial: Readonly<{ verdict: string; code: string | null; execution: string; trialRunId: string | null; start: string; judgeCalls: number }>;
    evidence: unknown;
    sessionView: string;
    normalizations: readonly Readonly<{ field: string; reason: string }>[];
    supported: Readonly<{ matchedOperations: number; recordedOperations: number }>;
    /** The operations a reevaluator answered in the recorded one's place (tier 2): ordinal, action type, differing field paths. */
    reevaluated: readonly Readonly<{ ordinal: number; actionType: string; fields: readonly string[] }>[];
    matcher: Readonly<{
      traceId: string;
      sourceEpisodeId: string | null;
      refusal: unknown;
      recordedOperations: number;
      matched: readonly Readonly<{ ordinal: number; actionType: string; recordedSequence: number; answeredFrom: string }>[];
      gaps: readonly Readonly<{ ordinal: number; actionType: string; reason: string; cause: string; fields: readonly string[]; recordedSequence: number | null }>[];
      deliveredSequences: number;
      refusedDeliveries: number;
      unansweredMessageTypes: readonly string[];
    }>;
  }>;

export function offlineTrialReport(outcome: AutomationStudioOfflineCandidateTrialOutcome): OfflineTrialReport {
  if (outcome.status === "refused") return Object.freeze({ status: "refused", reasonCode: outcome.reasonCode, detail: outcome.detail });
  const { record } = outcome.trial;
  const { matcher } = outcome;
  return Object.freeze({
    status: "ran",
    trial: Object.freeze({ verdict: record.verdict, code: record.code ?? null, execution: record.execution, trialRunId: record.trialRunId ?? null, start: record.start.status, judgeCalls: record.judge.calls }),
    evidence: structuredClone(outcome.evidence),
    sessionView: outcome.sessionView,
    normalizations: outcome.normalizations.map((normalization) => Object.freeze({ field: normalization.field, reason: normalization.reason })),
    supported: Object.freeze({ ...outcome.supported }),
    reevaluated: outcome.reevaluated.map((operation) => Object.freeze({ ordinal: operation.ordinal, actionType: operation.actionType, fields: Object.freeze([...operation.fields]) })),
    matcher: Object.freeze({
      traceId: matcher.traceId,
      sourceEpisodeId: matcher.sourceEpisodeId,
      refusal: matcher.refusal ? structuredClone(matcher.refusal) : null,
      recordedOperations: matcher.recordedOperations,
      matched: matcher.matchedOperations.map((operation) => Object.freeze({ ordinal: operation.ordinal, actionType: operation.actionType, recordedSequence: operation.recordedSequence, answeredFrom: operation.answeredFrom })),
      gaps: matcher.gaps.map((gap) => Object.freeze({ ordinal: gap.ordinal, actionType: gap.actionType, reason: gap.reason, cause: gap.cause, fields: [...gap.fields], recordedSequence: gap.recordedSequence })),
      deliveredSequences: matcher.deliveredSequences.length,
      refusedDeliveries: matcher.refusedDeliveries.length,
      unansweredMessageTypes: [...matcher.unansweredMessageTypes],
    }),
  });
}
