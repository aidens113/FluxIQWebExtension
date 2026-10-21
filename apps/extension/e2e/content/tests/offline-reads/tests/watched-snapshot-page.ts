// The snapshot page as the reevaluator is given it, watched: each evaluation's
// command id, outcome, row count and sandbox observations are kept, counts
// only, so the spec can say which run (the control, A, or the changed read, B)
// saw what, and that the sandbox held for both.

import type { WebSnapshotPage, WebSnapshotSandboxObservations } from "@fluxiq-web-extension/domain/node";

export type WatchedEvaluation = Readonly<{
  commandId: string;
  status: "evaluated" | "unavailable";
  resultStatus: string | null;
  failure: string | null;
  rows: number;
  observations: WebSnapshotSandboxObservations | null;
}>;

export function watchedSnapshotPage(page: WebSnapshotPage): { page: WebSnapshotPage; evaluations: WatchedEvaluation[] } {
  const evaluations: WatchedEvaluation[] = [];
  return {
    evaluations,
    page: {
      evaluate: async (snapshot, action) => {
        const evaluation = await page.evaluate(snapshot, action);
        evaluations.push(evaluation.status === "evaluated"
          ? {
            commandId: action.commandId, status: "evaluated", resultStatus: evaluation.result.status, failure: evaluation.result.failure?.code ?? null,
            rows: Array.isArray(evaluation.result.extracted) ? evaluation.result.extracted.length : 0, observations: evaluation.observations
          }
          : { commandId: action.commandId, status: "unavailable", resultStatus: null, failure: evaluation.reason, rows: 0, observations: null });
        return evaluation;
      }
    }
  };
}
