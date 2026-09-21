// The pure half of the Runtime Debug assertion: what the rendered run row and
// Action Log readings mean once compared with Core's run detail. Raw strings
// read from the page come in; closed statuses, counts, booleans and one closed
// code go out, so no page text can reach a result, a log line or a report.

import type { ExistingRunDetail } from "../../existing-fluxiq-control.js";

export const RUNTIME_DEBUG_CODES = [
  "runtime_debug.verified",
  "runtime_debug.core_not_terminal",
  "runtime_debug.reloaded",
  "runtime_debug.log_opened_after_response",
  "runtime_debug.not_refreshed_in_place",
  "runtime_debug.run_row_missing",
  "runtime_debug.run_row_status_mismatch",
  "runtime_debug.run_row_action_count_mismatch",
  "runtime_debug.log_missing",
  "runtime_debug.log_run_mismatch",
  "runtime_debug.log_status_mismatch",
  "runtime_debug.log_action_count_mismatch",
  "runtime_debug.attempt_rows_mismatch",
] as const;
export type RuntimeDebugCode = typeof RUNTIME_DEBUG_CODES[number];

const RUNTIME_STATUSES = ["queued", "running", "waiting", "succeeded", "failed", "cancelled"] as const;
export type RuntimeDebugStatus = typeof RUNTIME_STATUSES[number] | "unknown";

/** The Action Log's first page holds this many attempt rows (Core `RUNTIME_ACTION_PAGE_SIZE`). */
export const ACTION_LOG_PAGE_SIZE = 50;

/** One run as Core records it, in the order its attempts ran. */
export type RuntimeDebugCoreRun = {
  runId: string;
  status: RuntimeDebugStatus;
  actionCount: number;
  attempts: ReadonlyArray<{ nodeId: string; status: RuntimeDebugStatus }>;
};

/** The Action Log as read from its structural hooks. Every string is raw page content and stays in this module's callers. */
export type ActionLogReading = {
  present: boolean;
  heroLine: string;
  badge: string;
  metrics: ReadonlyArray<readonly [string, string]>;
  rows: ReadonlyArray<{ nodeId: string; status: string }>;
};

/** A run row as read from its structural hooks; `index` is -1 when no row names the run. */
export type RunRowReading = { index: number; badge: string; activity: string };

export type ActionLogFacts = {
  present: boolean;
  namesRun: boolean;
  status: RuntimeDebugStatus;
  metricStatus: RuntimeDebugStatus;
  actionCount: number | null;
  attemptRows: number;
  attemptRowsMatch: boolean;
};
export type RunRowFacts = { present: boolean; status: RuntimeDebugStatus; actionCount: number | null };
/**
 * What a refresh watch measured. `documentReplaced` is the reload signal: the
 * page's document lost the marker set when the watch began. Main-frame
 * navigations are reported too, but Playwright counts same-document history
 * updates among them, so they are a fact for the reader, not a failure.
 */
export type RefreshFacts = { documentReplaced: boolean; mainFrameNavigations: number; responseObserved: boolean; logNamedRunBeforeResponse: boolean; probeFailures: number };

/** A status the page or Core rendered, as a member of the closed runtime set or `unknown`. */
export function closedRuntimeStatus(value: unknown): RuntimeDebugStatus {
  const text = typeof value === "string" ? value.trim().toLowerCase() : "";
  return (RUNTIME_STATUSES as readonly string[]).includes(text) ? text as RuntimeDebugStatus : "unknown";
}

/** Core's run detail reduced to what the Runtime Debug view presents, attempts in run order. */
export function runtimeDebugCoreRun(detail: Pick<ExistingRunDetail, "summary" | "actionAttempts">): RuntimeDebugCoreRun {
  const attempts = [...detail.actionAttempts].sort((left, right) => left.order - right.order);
  return {
    runId: detail.summary.runId,
    status: closedRuntimeStatus(detail.summary.status),
    actionCount: detail.summary.actionAttemptCount,
    attempts: attempts.map(attempt => ({ nodeId: attempt.nodeId, status: closedRuntimeStatus(attempt.status) })),
  };
}

export function actionLogFacts(reading: ActionLogReading, core: RuntimeDebugCoreRun): ActionLogFacts {
  const metric = (label: string) => reading.metrics.find(([name]) => name === label)?.[1] ?? "";
  const expectedRows = core.attempts.slice(0, ACTION_LOG_PAGE_SIZE);
  return {
    present: reading.present,
    namesRun: reading.heroLine.split("|")[0]?.trim() === core.runId,
    status: closedRuntimeStatus(reading.badge),
    metricStatus: closedRuntimeStatus(metric("Status")),
    actionCount: wholeNumber(metric("Actions")),
    attemptRows: reading.rows.length,
    attemptRowsMatch: reading.rows.length === expectedRows.length
      && reading.rows.every((row, index) => row.nodeId === expectedRows[index]?.nodeId && closedRuntimeStatus(row.status) === expectedRows[index]?.status),
  };
}

export function runRowFacts(reading: RunRowReading): RunRowFacts {
  const count = /^\s*(\d+) actions?\b/u.exec(reading.activity)?.[1];
  return {
    present: reading.index >= 0,
    status: reading.index >= 0 ? closedRuntimeStatus(reading.badge) : "unknown",
    actionCount: count === undefined ? null : Number(count),
  };
}

/** Whether an Action Log reading shows exactly Core's terminal run. */
export function actionLogMatches(facts: ActionLogFacts, core: RuntimeDebugCoreRun): boolean {
  return facts.present && facts.namesRun && facts.status === core.status && facts.metricStatus === core.status
    && facts.actionCount === core.actionCount && facts.attemptRowsMatch;
}

/** The first failed check, in the order a reader would trust them, or `verified`. */
export function runtimeDebugVerdict(input: {
  core: RuntimeDebugCoreRun;
  refresh?: RefreshFacts;
  inPlaceLog?: ActionLogFacts;
  runRow: RunRowFacts;
  reopenedLog: ActionLogFacts;
}): RuntimeDebugCode {
  const { core, refresh, inPlaceLog, runRow, reopenedLog } = input;
  if (!["succeeded", "failed", "cancelled"].includes(core.status)) return "runtime_debug.core_not_terminal";
  if (refresh) {
    if (refresh.documentReplaced) return "runtime_debug.reloaded";
    if (!refresh.logNamedRunBeforeResponse) return "runtime_debug.log_opened_after_response";
    if (!inPlaceLog || !actionLogMatches(inPlaceLog, core)) return "runtime_debug.not_refreshed_in_place";
  }
  if (!runRow.present) return "runtime_debug.run_row_missing";
  if (runRow.status !== core.status) return "runtime_debug.run_row_status_mismatch";
  if (runRow.actionCount !== core.actionCount) return "runtime_debug.run_row_action_count_mismatch";
  if (!reopenedLog.present) return "runtime_debug.log_missing";
  if (!reopenedLog.namesRun) return "runtime_debug.log_run_mismatch";
  if (reopenedLog.status !== core.status || reopenedLog.metricStatus !== core.status) return "runtime_debug.log_status_mismatch";
  if (reopenedLog.actionCount !== core.actionCount) return "runtime_debug.log_action_count_mismatch";
  if (!reopenedLog.attemptRowsMatch) return "runtime_debug.attempt_rows_mismatch";
  return "runtime_debug.verified";
}

function wholeNumber(text: string): number | null {
  return /^\d{1,9}$/u.test(text.trim()) ? Number(text.trim()) : null;
}
