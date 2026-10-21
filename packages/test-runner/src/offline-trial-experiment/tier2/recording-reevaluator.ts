// The reevaluator as the experiment watches it (P5 tier 2): each ask the
// matcher (or the gate tool) makes is kept as the recorded operation it stood
// for, the differing field paths, the answer's status and gap reason, and the
// page evaluations it made (`./recording-snapshot-page.ts`). The answer passes
// through unchanged; a reevaluator that throws is kept as `threw` with the
// error's class name only, and still throws, so the matcher reads it as the gap
// it is.

import type { ClientGatewayTraceReevaluator } from "fluxiq/client-gateway";
import type { SnapshotEvaluationSummary } from "./recording-snapshot-page.js";

export type ReevaluationAsk = Readonly<{
  recordedSequence: number;
  actionType: string;
  fields: readonly string[];
  status: "answered" | "gap" | "declined" | "threw";
  reason: string | null;
  evaluations: readonly SnapshotEvaluationSummary[];
}>;

export type RecordingReevaluator = Readonly<{ reevaluator: ClientGatewayTraceReevaluator; asks(): readonly ReevaluationAsk[] }>;

export function recordingReevaluator(inner: ClientGatewayTraceReevaluator, takeEvaluations: () => SnapshotEvaluationSummary[]): RecordingReevaluator {
  const asks: ReevaluationAsk[] = [];
  return Object.freeze({
    reevaluator: {
      reevaluate: async (request) => {
        takeEvaluations();
        const base = { recordedSequence: request.recorded.sequence, actionType: request.operation.actionType, fields: Object.freeze([...request.fields]) };
        try {
          const answer = await inner.reevaluate(request);
          asks.push(Object.freeze({ ...base, status: answer.status, reason: answer.status === "gap" ? answer.reason : null, evaluations: takeEvaluations() }));
          return answer;
        } catch (error) {
          asks.push(Object.freeze({ ...base, status: "threw", reason: error instanceof Error ? error.constructor.name : typeof error, evaluations: takeEvaluations() }));
          throw error;
        }
      },
    },
    asks: () => Object.freeze([...asks]),
  });
}
