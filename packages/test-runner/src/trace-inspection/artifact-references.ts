// The trace references a client attached to its results, read back from the
// raw text the trace kept (D14: Core records `metadata.trace` in the trace and
// strips it before any consumer reads the result). Only counts, byte lengths,
// roles and media types leave this function; a payload never does.

import type { ClientGatewayTraceEvent } from "fluxiq/client-gateway";
import { tracePayloadValue } from "./payload-value.js";
import type { TraceArtifactReferences } from "./types.js";

type Sums = { -readonly [K in keyof TraceArtifactReferences]: K extends "byMediaType" ? Record<string, number> : TraceArtifactReferences[K] };

/** Sums the trace requests Core sent and the artifact references the client answered with. */
export function traceArtifactReferences(events: readonly ClientGatewayTraceEvent[]): TraceArtifactReferences {
  const sums: Sums = { tracedCommands: 0, resultsWithReferences: 0, primary: 0, resource: 0, primaryBytes: 0, resourceBytes: 0, unavailable: 0, byMediaType: {}, unparsablePayloads: 0 };
  for (const event of events) {
    if (event.kind !== "outbound" && event.kind !== "inbound") continue;
    const parsed = tracePayloadValue(event.payload);
    if (parsed.kind === "unparsable") sums.unparsablePayloads += 1;
    if (parsed.kind !== "value") continue;
    for (const trace of traceMetadata(parsed.value)) {
      if (event.kind === "outbound" && trace.artifacts === true) sums.tracedCommands += 1;
      if (event.kind === "inbound" && Array.isArray(trace.artifacts)) countResult(sums, trace);
    }
  }
  return Object.freeze({ ...sums, byMediaType: Object.freeze(sums.byMediaType) });
}

function countResult(sums: Sums, trace: Record<string, unknown>): void {
  sums.resultsWithReferences += 1;
  if (typeof trace.unavailable === "number" && Number.isFinite(trace.unavailable)) sums.unavailable += trace.unavailable;
  for (const reference of trace.artifacts as unknown[]) {
    if (!isRecord(reference)) continue;
    const bytes = typeof reference.byteLength === "number" && Number.isFinite(reference.byteLength) ? reference.byteLength : 0;
    if (reference.role === "primary") {
      sums.primary += 1;
      sums.primaryBytes += bytes;
    }
    if (reference.role === "resource") {
      sums.resource += 1;
      sums.resourceBytes += bytes;
    }
    const mediaType = typeof reference.mediaType === "string" ? mediaTypeName(reference.mediaType) : "unknown";
    sums.byMediaType[mediaType] = (sums.byMediaType[mediaType] ?? 0) + 1;
  }
}

/** A media type's `type/subtype` only, lower case; anything else is "other" so no free text is reported. */
function mediaTypeName(value: string): string {
  const name = value.split(";")[0]?.trim().toLowerCase() ?? "";
  return /^[a-z0-9.+-]{1,40}\/[a-z0-9.+-]{1,80}$/u.test(name) ? name : "other";
}

/** Every `metadata.trace` object anywhere in the value. */
function traceMetadata(value: unknown): Record<string, unknown>[] {
  const found: Record<string, unknown>[] = [];
  const stack: unknown[] = [value];
  while (stack.length > 0) {
    const current = stack.pop();
    if (Array.isArray(current)) {
      stack.push(...current);
      continue;
    }
    if (!isRecord(current)) continue;
    const metadata = current.metadata;
    if (isRecord(metadata) && isRecord(metadata.trace)) found.push(metadata.trace);
    for (const [key, child] of Object.entries(current)) if (key !== "metadata") stack.push(child);
    if (isRecord(metadata)) for (const [key, child] of Object.entries(metadata)) if (key !== "trace") stack.push(child);
  }
  return found;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
