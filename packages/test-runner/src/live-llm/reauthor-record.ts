// What a run's re-author spent, read from Core's own record of the run.
//
// When Core judges a run's answer wrong it may re-author the Flow: a second
// build, with its own evidence loop and its own provider calls, made inside the
// run (`recovery/refuted-result/reauthor.ts`). Core records every attempt on
// the run detail, `metadata.resultReauthor.attempts[]`, each with the build's
// accounting; a build that succeeded keeps its call count on its adaptation,
// and one that failed keeps it on the attempt's own `evidenceLoop`. None of it
// is in the run's own accounting, its per-call lines or its interventions, so
// every settlement that read only those left the re-author out:
// `run-munw7ffn-fe1cecd2`'s 36 re-author calls and $0.0425 were in no figure
// the Lab or the machine's spend ledger kept.
//
// Counts, token totals, a cost figure and ids only; no decision, prompt or
// page content is read. It raises nothing: what a re-author spent is evidence
// about the run, and a read that failed says so by `source`.

import type { LiveLlmExplorationControl } from "./exploration-record.js";

export type LiveLlmReauthorAttempt = {
  attempt: number | null;
  adaptationId: string | null;
  /** Core's count of the build's provider calls, or `null` where it recorded none this reader could reach. */
  calls: number | null;
  /**
   * Where `calls` came from: the attempt's own loop (a build that failed), its
   * adaptation (one that succeeded), an adaptation that could not be read, or
   * nowhere, because Core recorded neither.
   */
  callsFrom: LiveLlmReauthorCallsSource;
  inputTokens: number | null;
  outputTokens: number | null;
  estimatedCostUsd: number | null;
};

export type LiveLlmReauthorCallsSource = "loop" | "adaptation" | "adaptation_unreadable" | "not_recorded";

export type LiveLlmReauthorRecord = {
  /** `run-detail` when Core recorded a re-author, `absent` when it recorded none, `unreadable` when the detail could not be read. */
  source: "run-detail" | "absent" | "unreadable";
  attempts: LiveLlmReauthorAttempt[];
  /** Every attempt's calls, where each was counted; `uncountedAttempts` says how many were not. */
  calls: number;
  uncountedAttempts: number;
  totalEstimatedCostUsd: number;
};

const NO_REAUTHOR: LiveLlmReauthorRecord = { source: "absent", attempts: [], calls: 0, uncountedAttempts: 0, totalEstimatedCostUsd: 0 };

const ID = /^[A-Za-z0-9_.:-]{1,160}$/u;

/**
 * Reads the run's re-author attempts and what each spent. A succeeded
 * attempt's call count is read from its adaptation (`get-flow-adaptation`),
 * because that is where Core keeps a successful build's loop.
 */
export async function readLiveLlmReauthor(control: LiveLlmExplorationControl, scope: { projectId: string; runId: string }): Promise<LiveLlmReauthorRecord> {
  let payload: unknown;
  try {
    payload = await control.automationStudioCall("get-flow-run-detail", { projectId: scope.projectId, runId: scope.runId });
  } catch {
    return { ...NO_REAUTHOR, attempts: [], source: "unreadable" };
  }
  const detail = asRecord(asRecord(payload)?.runDetail);
  const marker = asRecord(asRecord(detail?.metadata)?.resultReauthor);
  const listed: unknown[] = Array.isArray(marker?.attempts) ? marker.attempts : [];
  const recorded = listed.map(asRecord).filter((item): item is Record<string, unknown> => item !== undefined);
  if (recorded.length === 0) return { ...NO_REAUTHOR, attempts: [] };
  const flowId = id(asRecord(detail?.summary)?.flowId) ?? id(detail?.flowId);
  const attempts: LiveLlmReauthorAttempt[] = [];
  for (const item of recorded) {
    const accounting = asRecord(item.accounting);
    const adaptationId = id(item.adaptationId);
    const counted = await attemptCalls(control, scope.projectId, flowId, adaptationId, asRecord(item.evidenceLoop));
    attempts.push({
      attempt: count(item.attempt),
      adaptationId,
      ...counted,
      inputTokens: count(accounting?.inputTokens),
      outputTokens: count(accounting?.outputTokens),
      estimatedCostUsd: cost(accounting?.estimatedCostUsd),
    });
  }
  return {
    source: "run-detail",
    attempts,
    calls: attempts.reduce((sum, attempt) => sum + (attempt.calls ?? 0), 0),
    uncountedAttempts: attempts.filter((attempt) => attempt.calls === null).length,
    totalEstimatedCostUsd: attempts.reduce((sum, attempt) => sum + (attempt.estimatedCostUsd ?? 0), 0),
  };
}

/** A build's provider calls as its evidence loop counts them: every loop decision plus the calls made outside it. */
function loopCalls(loop: Record<string, unknown> | undefined): number | null {
  return count(loop?.totalProviderCallCount) ?? count(loop?.providerCallCount);
}

/** An attempt's call count and where it was found; an adaptation that could not be read says so rather than reading as uncounted. */
async function attemptCalls(control: LiveLlmExplorationControl, projectId: string, flowId: string | null, adaptationId: string | null, loop: Record<string, unknown> | undefined): Promise<{ calls: number | null; callsFrom: LiveLlmReauthorCallsSource }> {
  const own = loopCalls(loop);
  if (own !== null) return { calls: own, callsFrom: "loop" };
  if (!adaptationId || !flowId) return { calls: null, callsFrom: "not_recorded" };
  let payload: unknown;
  try {
    payload = await control.automationStudioCall("get-flow-adaptation", { projectId, flowId, adaptationId });
  } catch {
    return { calls: null, callsFrom: "adaptation_unreadable" };
  }
  const calls = loopCalls(asRecord(asRecord(asRecord(payload)?.adaptation)?.evidenceLoop));
  return { calls, callsFrom: calls === null ? "not_recorded" : "adaptation" };
}

function id(value: unknown): string | null {
  return typeof value === "string" && ID.test(value) ? value : null;
}

function count(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function cost(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
