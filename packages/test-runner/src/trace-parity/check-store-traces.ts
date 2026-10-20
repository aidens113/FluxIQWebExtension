// Replays every trace in an Automation Studio storage root on disk (a copied
// workspace's store, a live round's store) through Core's own harness, opened
// through Core's store API, and reports per trace:
// - the parity Core's harness reports for the trace as stored. Older traces
//   are classified by Core itself: a legacy trace whose events name no session
//   is replayed with its one session attached when the trace shows it held one
//   (a normalization the report names), and refused as capture gaps when it
//   cannot be shown; a disposition recorded under schema version 1 is compared
//   on the fields it carries, its missing delivered digests a capture gap;
// - how many of those capture gaps are such older dispositions;
// - the trace's last delivery points by name (`delivery-tail.ts`).
// Nothing here rewrites or relabels a trace.
//
// Run it only against a store no Core is writing. Opening a store applies
// Core's migrations to it, so point it at a copy.

import { AutomationStudioProjectDatabasePool, AutomationStudioProjectGatewayTraceStore } from "fluxiq/automation-studio";
import { replayClientGatewayTrace, type ClientGatewayTraceManifest } from "fluxiq/client-gateway";
import { TRACE_PARITY_DEFAULT_DEADLINE_MS } from "./check-project-trace-parity.js";
import { deliveryTail } from "./delivery-tail.js";
import { replayWithDeadline } from "./replay-with-deadline.js";
import { listStoreProjects } from "./store-projects.js";
import { summarizeTraceParity } from "./summarize-parity.js";
import type { StoreTraceCheck, StoreTracesCheck, TraceParitySummary, TraceReplay } from "./types.js";

export type StoreTracesInput = {
  /** Automation Studio's storage root: the directory holding `projects/<projectId>/project.sqlite`. */
  automationDataDir: string;
  /** Delivery points kept from each trace's end. Default 30. */
  tailLength?: number;
  deadlineMs?: number;
};

/** Core's reason for a version 1 disposition whose every recorded field matched, and the one field it lacks. */
const OLDER_DISPOSITION_REASON = "the disposition was recorded under schema version 1, which does not record what Core delivered for the message; every field it records matched";
const OLDER_DISPOSITION_FIELD = "payload.value.delivered";

export async function checkStoreTraces(input: StoreTracesInput, seams: { replay?: TraceReplay } = {}): Promise<StoreTracesCheck> {
  const startedAt = Date.now();
  const replay = seams.replay ?? replayClientGatewayTrace;
  const settings = { replay, deadlineMs: input.deadlineMs ?? TRACE_PARITY_DEFAULT_DEADLINE_MS, tailLength: input.tailLength ?? 30 };
  const projects: StoreTracesCheck["projects"][number][] = [];
  for (const projectId of await listStoreProjects(input.automationDataDir)) {
    const pool = new AutomationStudioProjectDatabasePool({ rootDir: input.automationDataDir });
    try {
      const store = await AutomationStudioProjectGatewayTraceStore.open({ pool, projectId });
      try {
        const traces: StoreTraceCheck[] = [];
        for (const manifest of await store.listManifests({})) traces.push(await checkTrace(store, manifest, settings));
        projects.push(Object.freeze({ projectId, traces: Object.freeze(traces) }));
      } finally {
        await store.close();
      }
    } finally {
      await pool.closeAll();
    }
  }
  return Object.freeze({ projects: Object.freeze(projects), durationMs: Date.now() - startedAt });
}

async function checkTrace(store: AutomationStudioProjectGatewayTraceStore, manifest: ClientGatewayTraceManifest, settings: { replay: TraceReplay; deadlineMs: number; tailLength: number }): Promise<StoreTraceCheck> {
  const events = await store.readEventRange(manifest.traceId, 1, Number.MAX_SAFE_INTEGER);
  const attempt = await replayWithDeadline(settings.replay, store, manifest.traceId, settings.deadlineMs);
  const recorded = summarizeTraceParity({ manifest, events: events.length, report: attempt.report, durationMs: attempt.durationMs, ...(attempt.failure === null ? {} : { failure: attempt.failure }) });
  return Object.freeze({
    traceId: manifest.traceId, episodeId: manifest.episodeId, activity: manifest.activity, terminationReason: manifest.terminationReason,
    startedAt: manifest.startedAt, closedAt: manifest.closedAt, events: events.length,
    sessionReferences: attempt.report?.sessionReferences.status ?? null,
    recorded,
    olderDispositionSchemaOnly: olderDispositionSchemaOnly(recorded),
    tail: deliveryTail(events, attempt.report?.entries ?? null, settings.tailLength),
  });
}

/** Disposition capture gaps Core gave for a version 1 disposition whose every recorded field matched. */
function olderDispositionSchemaOnly(summary: TraceParitySummary): number {
  let count = 0;
  for (const group of summary.groups) {
    const older = group.class === "capture_gap" && group.kind === "disposition" && group.reason === OLDER_DISPOSITION_REASON;
    if (older && group.fields.length === 1 && group.fields[0] === OLDER_DISPOSITION_FIELD) count += group.count;
  }
  return count;
}
