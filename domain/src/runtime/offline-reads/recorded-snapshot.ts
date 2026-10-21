// The page snapshot recorded with the replaced read's own result (D32): the
// references on the recorded `client.action_result`'s `metadata.trace`
// (Core's `ClientGatewayTraceResultMetadata`) read back through the matcher.
//
// The primary artifact is the document the extension captured after the read
// ran, and its `source` is that document's address (`doc.URL`,
// `apps/extension/src/content/trace-capture/capture-page.ts`), so the sandbox
// loads it there. Only artifacts the trace recorded up to the end of the
// operation's segment are read; anything else is not this read's page.
//
// `undefined` -- an evidence gap, `snapshot_unavailable` -- for no readable
// references, not exactly one primary, a primary with no
// address or outside the segment, or primary bytes the store does not hold. A
// resource that cannot be had is left out and counted with the parts the
// client could not carry, and the sandbox answers its address with nothing.
// A store that throws is not a missing part: its failure propagates.

import type { CLIENT_GATEWAY_TRACE_METADATA_KEY, ClientGatewayTraceReevaluationRequest } from "fluxiq/client-gateway";
import type { WebPageSnapshot, WebPageSnapshotPart } from "./snapshot-page";

// Core's key, imported as a type only so this module never loads Core's
// client-gateway service; the declared type makes a drift a compile error.
const TRACE_METADATA_KEY: typeof CLIENT_GATEWAY_TRACE_METADATA_KEY = "trace";

type Reference = { sha256: string; mediaType: string; role: "primary" | "resource"; source: string | null };

export async function webOfflineReadRecordedSnapshot(request: ClientGatewayTraceReevaluationRequest): Promise<WebPageSnapshot | undefined> {
  const metadata = request.recordedResult.metadata;
  const trace = traceReferences(isRecord(metadata) ? metadata[TRACE_METADATA_KEY] : undefined);
  if (trace === undefined) return undefined;
  const primaries = trace.references.filter((reference) => reference.role === "primary");
  const primaryReference = primaries.length === 1 ? primaries[0] : undefined;
  if (primaryReference === undefined || primaryReference.source === null) return undefined;
  const inSegment = new Set(request.artifacts.map((artifact) => artifact.sha256));
  const primary = await partOf(primaryReference, inSegment, request);
  if (primary === undefined) return undefined;
  const resources: WebPageSnapshotPart[] = [];
  let unavailable = trace.unavailable;
  for (const reference of trace.references) {
    if (reference.role !== "resource") continue;
    const part = await partOf(reference, inSegment, request);
    if (part === undefined) unavailable += 1;
    else resources.push(part);
  }
  return { url: primaryReference.source, primary, resources, unavailable };
}

async function partOf(reference: Reference, inSegment: ReadonlySet<string>, request: ClientGatewayTraceReevaluationRequest): Promise<WebPageSnapshotPart | undefined> {
  if (!inSegment.has(reference.sha256)) return undefined;
  // A store that throws is left to throw: the matcher answers a reevaluator
  // failure as a gap and keeps its message, where reading it as "not there"
  // would hide a broken store behind a snapshot that merely was not recorded.
  const bytes = await request.readArtifact(reference.sha256);
  return bytes instanceof Uint8Array ? { ...reference, bytes } : undefined;
}

/** The recorded references, or `undefined` when any of them is not well formed. */
function traceReferences(value: unknown): { references: Reference[]; unavailable: number } | undefined {
  if (!isRecord(value) || !Array.isArray(value.artifacts)) return undefined;
  const unavailable = typeof value.unavailable === "number" && Number.isSafeInteger(value.unavailable) && value.unavailable >= 0 ? value.unavailable : undefined;
  if (unavailable === undefined) return undefined;
  const references: Reference[] = [];
  for (const entry of value.artifacts) {
    if (!isRecord(entry) || typeof entry.sha256 !== "string" || typeof entry.mediaType !== "string") return undefined;
    if (entry.role !== "primary" && entry.role !== "resource") return undefined;
    if (entry.source !== undefined && typeof entry.source !== "string") return undefined;
    references.push({ sha256: entry.sha256, mediaType: entry.mediaType, role: entry.role, source: typeof entry.source === "string" ? entry.source : null });
  }
  return { references, unavailable };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
