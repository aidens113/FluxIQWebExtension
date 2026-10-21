// The snapshot page as the experiment watches it (P5 tier 2): every
// evaluation passes through unchanged, and what is kept of it may be written
// down -- the command id and action type it ran, the snapshot's digest prefix,
// the page's status and reason, the result's status, failure code and row
// count, the sandbox's counts and the time it took. Never a value read off the
// page, and never the page's free-text detail, which can quote an error raised
// over page content.

import type { WebSnapshotPage, WebSnapshotSandboxObservations } from "@fluxiq-web-extension/domain/node";

export type SnapshotEvaluationSummary = Readonly<{
  commandId: string;
  actionType: string;
  /** The first 12 hex digits of the snapshot's primary digest. */
  snapshot: string;
  status: "evaluated" | "unavailable";
  reason: string | null;
  resultStatus: string | null;
  failureCode: string | null;
  /** How many records the read returned; `null` for a value that is not a list. */
  rows: number | null;
  observations: WebSnapshotSandboxObservations | null;
  ms: number;
}>;

export type RecordingSnapshotPage = Readonly<{
  page: WebSnapshotPage;
  /** The evaluations made since the last call, each handed over once. */
  take(): SnapshotEvaluationSummary[];
}>;

export function recordingSnapshotPage(inner: WebSnapshotPage): RecordingSnapshotPage {
  let kept: SnapshotEvaluationSummary[] = [];
  return Object.freeze({
    page: {
      evaluate: async (snapshot, action) => {
        const started = performance.now();
        const evaluation = await inner.evaluate(snapshot, action);
        const ms = Math.round(performance.now() - started);
        const base = { commandId: action.commandId, actionType: action.actionType, snapshot: snapshot.primary.sha256.slice(0, 12), ms };
        kept.push(evaluation.status === "unavailable"
          ? Object.freeze({ ...base, status: "unavailable", reason: evaluation.reason, resultStatus: null, failureCode: null, rows: null, observations: null })
          : Object.freeze({
            ...base, status: "evaluated", reason: null, resultStatus: evaluation.result.status,
            failureCode: evaluation.result.failure?.code ?? null,
            rows: Array.isArray(evaluation.result.extracted) ? evaluation.result.extracted.length : null,
            observations: Object.freeze({ ...evaluation.observations }),
          }));
        return evaluation;
      },
    },
    take: () => {
      const taken = kept;
      kept = [];
      return taken;
    },
  });
}
