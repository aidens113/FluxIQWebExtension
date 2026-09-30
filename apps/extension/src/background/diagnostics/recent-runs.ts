// The recent FluxIQ runs a problem report names, from Core's run summaries.
//
// `list-runtime-sessions` with `summaries: true` is on the paired-client
// allowlist Core keeps (`apps/web/src/lib/program-route.ts` in FluxIQ Core), so
// the pairing token reaches it. Its summaries carry ids, states and times, and
// only those are kept, by name: a later Core adding a field to a summary adds
// nothing to a report. A report is most wanted when Core cannot answer, so a
// failure here becomes the reason `recentRuns` is unavailable, never a thrown
// error.

import type { PanelRelayResponse, ProblemReport, ProblemReportRun } from "../../shared/protocol";
import { redactDiagnosticText } from "./diagnostic-redaction";

export const PROBLEM_REPORT_RUN_LIMIT = 10;

export type RecentRunsCall = (endpoint: string, payload: Record<string, unknown>) => Promise<PanelRelayResponse>;

export async function readRecentRuns(call: RecentRunsCall, projectId: string | null | undefined): Promise<ProblemReport["recentRuns"]> {
  if (!projectId) return { available: false, reason: "FluxIQ has not said which project this browser belongs to." };
  let reply: PanelRelayResponse;
  try {
    reply = await call("list-runtime-sessions", { projectId, summaries: true, limit: PROBLEM_REPORT_RUN_LIMIT });
  } catch (error) {
    return { available: false, reason: redactDiagnosticText(error instanceof Error ? error.message : "FluxIQ could not be asked for recent runs.") };
  }
  if (!reply.ok) return { available: false, reason: `${reply.code}: ${redactDiagnosticText(reply.error)}` };
  const listed = (reply.payload as { runtimeSessions?: unknown } | null)?.runtimeSessions;
  const runs = (Array.isArray(listed) ? listed : [])
    .map(reportRun)
    .filter((run): run is ProblemReportRun => run !== undefined)
    .slice(0, PROBLEM_REPORT_RUN_LIMIT);
  return { available: true, runs };
}

function reportRun(value: unknown): ProblemReportRun | undefined {
  if (!value || typeof value !== "object") return undefined;
  const run = value as Record<string, unknown>;
  if (typeof run.runId !== "string" || typeof run.status !== "string") return undefined;
  const kept: ProblemReportRun = { runId: run.runId, status: run.status };
  if (typeof run.targetKind === "string") kept.targetKind = run.targetKind;
  if (typeof run.flowId === "string") kept.flowId = run.flowId;
  if (typeof run.startedAt === "number") kept.startedAt = run.startedAt;
  if (typeof run.finishedAt === "number") kept.finishedAt = run.finishedAt;
  if (typeof run.attemptCount === "number") kept.attemptCount = run.attemptCount;
  return kept;
}
