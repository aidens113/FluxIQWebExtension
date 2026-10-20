// One stored trace as counts: its completeness judged by Core's own evaluator
// over the evidence the store holds (never the recorder's claim alone), its
// events by kind, stream and protocol message type, the bytes its events take
// and where the store keeps them, its artifacts, the trace references the
// client answered with, credential redactions, and command round trips.

import { evaluateClientGatewayTraceCompleteness } from "fluxiq/client-gateway";
import type { ClientGatewayTraceArtifactPresence, ClientGatewayTraceEvent, ClientGatewayTraceManifest } from "fluxiq/client-gateway";
import { traceArtifactReferences } from "./artifact-references.js";
import { traceCommandTimings } from "./command-timings.js";
import { traceCredentialRedactions } from "./credential-redactions.js";
import type { TraceEventSummary } from "./types.js";

const IDENTIFIER = /^[A-Za-z][A-Za-z0-9_.:-]{0,79}$/u;

export function summarizeTrace(input: {
  manifest: ClientGatewayTraceManifest;
  events: readonly ClientGatewayTraceEvent[];
  heldArtifacts: readonly ClientGatewayTraceArtifactPresence[];
  /** The project store keeps an event's JSON inline below this many bytes, else as a content object. */
  objectThresholdBytes: number;
}): TraceEventSummary {
  const { manifest, events, heldArtifacts } = input;
  const completeness = evaluateClientGatewayTraceCompleteness({ manifest, events, availableArtifacts: heldArtifacts, compatibility: { status: "compatible" }, recorderActive: false });
  const bytes = { total: 0, inline: 0, inlineEvents: 0, object: 0, objectEvents: 0 };
  for (const event of events) {
    const size = Buffer.byteLength(JSON.stringify(event), "utf8");
    bytes.total += size;
    if (size < input.objectThresholdBytes) {
      bytes.inline += size;
      bytes.inlineEvents += 1;
    } else {
      bytes.object += size;
      bytes.objectEvents += 1;
    }
  }
  return Object.freeze({
    traceId: manifest.traceId, episodeId: manifest.episodeId, activity: manifest.activity,
    startedAt: manifest.startedAt, closedAt: manifest.closedAt, terminationReason: manifest.terminationReason,
    claimedCompleteness: manifest.completeness.status,
    completeness: Object.freeze({ status: completeness.status, issues: completeness.issues, redactionLimitations: completeness.limitations.length }),
    events: events.length,
    eventsByKind: tally(events.map(event => event.kind)),
    eventsByStream: tally(events.map(event => event.stream)),
    eventsByMessageType: tally(events.map(event => event.messageType ?? "none")),
    eventBytes: Object.freeze(bytes),
    artifacts: Object.freeze({
      inventory: manifest.artifacts.length, held: heldArtifacts.length,
      heldBytes: heldArtifacts.reduce((sum, artifact) => sum + artifact.byteLength, 0),
      distinctSha256: new Set(heldArtifacts.map(artifact => artifact.sha256)).size,
    }),
    references: traceArtifactReferences(events),
    credentialRedactions: traceCredentialRedactions(events),
    commandTimings: traceCommandTimings(events),
    redactionsByReason: tally(events.flatMap(event => event.redactions.map(redaction => redaction.reason))),
  });
}

/** Counts per value; a value that is not a plain identifier is counted as "other", so no free text is reported. */
function tally(values: readonly string[]): Readonly<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const value of values) {
    const key = IDENTIFIER.test(value) ? value : "other";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.freeze(counts);
}
