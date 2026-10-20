// Replays every selected client gateway trace a project store holds through
// Core's own gateway intake and reports parity (trace-offline-trials-plan,
// lane T P3). The store is opened through Core's API
// (`AutomationStudioProjectGatewayTraceStore`), never by its tables; Core's
// harness (`replayClientGatewayTrace`) only reads it, and records its replay
// into a memory store of its own. What leaves is `summarize-parity.ts`'s
// projection: counts, sequences, kinds, message types and field names.
//
// Run it only against a store no Core is writing: the Lab calls it after the
// replay's Core has stopped.

import { AutomationStudioProjectDatabasePool, AutomationStudioProjectGatewayTraceStore } from "fluxiq/automation-studio";
import { replayClientGatewayTrace, type ClientGatewayTraceManifest, type ClientGatewayTraceParityClass } from "fluxiq/client-gateway";
import { replayWithDeadline } from "./replay-with-deadline.js";
import { emptyClassCounts, summarizeTraceParity } from "./summarize-parity.js";
import type { ProjectTraceParity, TraceParitySummary, TraceReplay } from "./types.js";

/** How long one trace's replay may take before it is reported failed. */
export const TRACE_PARITY_DEFAULT_DEADLINE_MS = 180_000;

export type ProjectTraceParityInput = {
  /** Automation Studio's storage root: the directory holding `projects/<projectId>/project.sqlite`. */
  automationDataDir: string;
  projectId: string;
  /** Which traces to replay; all of them when absent. The rest are counted as skipped. */
  include?: (manifest: ClientGatewayTraceManifest) => boolean;
  deadlineMs?: number;
};

export async function checkProjectTraceParity(input: ProjectTraceParityInput, seams: { replay?: TraceReplay } = {}): Promise<ProjectTraceParity> {
  const startedAt = Date.now();
  const pool = new AutomationStudioProjectDatabasePool({ rootDir: input.automationDataDir });
  try {
    const store = await AutomationStudioProjectGatewayTraceStore.open({ pool, projectId: input.projectId });
    try {
      const manifests = await store.listManifests({});
      const selected = manifests.filter(manifest => input.include?.(manifest) ?? true);
      const traces: TraceParitySummary[] = [];
      for (const manifest of selected) traces.push(await checkTrace(store, manifest, seams.replay ?? replayClientGatewayTrace, input.deadlineMs ?? TRACE_PARITY_DEFAULT_DEADLINE_MS));
      return Object.freeze({ projectId: input.projectId, traces: Object.freeze(traces), tracesSkipped: manifests.length - selected.length, totals: totalsOf(traces), durationMs: Date.now() - startedAt });
    } finally {
      await store.close();
    }
  } finally {
    await pool.closeAll();
  }
}

async function checkTrace(store: AutomationStudioProjectGatewayTraceStore, manifest: ClientGatewayTraceManifest, replay: TraceReplay, deadlineMs: number): Promise<TraceParitySummary> {
  const events = (await store.readEventRange(manifest.traceId, 1, Number.MAX_SAFE_INTEGER)).length;
  const attempt = await replayWithDeadline(replay, store, manifest.traceId, deadlineMs);
  return summarizeTraceParity({ manifest, events, report: attempt.report, durationMs: attempt.durationMs, ...(attempt.failure === null ? {} : { failure: attempt.failure }) });
}

function totalsOf(traces: readonly TraceParitySummary[]): ProjectTraceParity["totals"] {
  const classes = { ...emptyClassCounts() } as Record<ClientGatewayTraceParityClass, number>;
  const totals = { traces: traces.length, matched: 0, diverged: 0, failed: 0, compared: 0, matchedPoints: 0 };
  for (const trace of traces) {
    totals[trace.verdict] += 1;
    totals.compared += trace.deliveryPoints.compared;
    totals.matchedPoints += trace.deliveryPoints.matched;
    for (const name of Object.keys(classes) as ClientGatewayTraceParityClass[]) classes[name] += trace.divergencesByClass[name];
  }
  return Object.freeze({ ...totals, divergencesByClass: Object.freeze(classes) });
}
