// The bytes the project store actually keeps for a trace's events (trace-
// offline-trials-plan, lane T P3): inline JSON, chunk digest lists, the stored
// (possibly deflated) bytes of the chunks the trace uses and legacy 0030
// content objects, beside the logical size of its events. Core's store answers
// this by name (`AutomationStudioProjectGatewayTraceStore.measureTrace`), so
// the Lab never opens Core's trace tables and survives a change to their layout.

import type { AutomationStudioProjectGatewayTraceStore } from "fluxiq/automation-studio";
import type { TraceStoredBytes } from "./types.js";

/** Stored bytes of one trace's events, from Core's own measure. */
export async function readTraceStoredBytes(store: AutomationStudioProjectGatewayTraceStore, traceId: string): Promise<TraceStoredBytes> {
  const measure = await store.measureTrace(traceId);
  const logical = measure.logicalEventBytes;
  const stored = measure.inlineBytes + measure.digestListBytes + measure.storedChunkBytes + measure.objectBytes;
  return Object.freeze({
    logicalBytes: logical,
    storedBytes: stored,
    ratio: logical === 0 ? null : stored / logical,
    inlineEvents: measure.inlineEvents,
    inlineBytes: measure.inlineBytes,
    chunkedEvents: measure.chunkedEvents,
    chunkedLogicalBytes: measure.chunkedLogicalBytes,
    digestListBytes: measure.digestListBytes,
    objectEvents: measure.objectEvents,
    objectBytes: measure.objectBytes,
    chunks: measure.chunks,
    chunkRawBytes: measure.chunkRawBytes,
    chunkStoredBytes: measure.storedChunkBytes,
    exclusiveChunks: measure.chunks - measure.sharedChunks,
    exclusiveChunkStoredBytes: measure.storedChunkBytes - measure.sharedStoredChunkBytes,
  });
}
