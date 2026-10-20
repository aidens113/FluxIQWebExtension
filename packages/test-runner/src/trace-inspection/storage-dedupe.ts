// Stored trace bytes over several traces (trace-offline-trials-plan, lane T
// P3): chunks are stored once per project, so a chunk two of the read traces
// share counts once here, where each trace's own figure counts it in full.
// The distinct chunks come from Core's store (`measureTraceChunks`), never
// from its tables.

import type { AutomationStudioProjectGatewayTraceStore } from "fluxiq/automation-studio";
import type { TraceStorageDedupe, TraceStoredBytes } from "./types.js";

/** Over several traces: each distinct chunk once, so chunks two traces share are stored once. */
export async function readTraceStorageDedupe(store: AutomationStudioProjectGatewayTraceStore, traces: readonly Readonly<{ traceId: string; stored: TraceStoredBytes }>[]): Promise<TraceStorageDedupe> {
  const distinct = await store.measureTraceChunks(traces.map(trace => trace.traceId));
  const logical = traces.reduce((sum, trace) => sum + trace.stored.logicalBytes, 0);
  const outsideChunks = traces.reduce((sum, trace) => sum + trace.stored.inlineBytes + trace.stored.digestListBytes + trace.stored.objectBytes, 0);
  const stored = outsideChunks + distinct.storedChunkBytes;
  return Object.freeze({
    traces: traces.length,
    logicalBytes: logical,
    storedBytes: stored,
    ratio: logical === 0 ? null : stored / logical,
    distinctChunks: distinct.chunks,
    distinctChunkStoredBytes: distinct.storedChunkBytes,
  });
}
