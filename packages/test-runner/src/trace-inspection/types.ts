// What the Lab reads back about the client gateway traces one run left in a
// project store (trace-offline-trials-plan, lane T P2, D17). Counts, sizes,
// ids, protocol message types and durations only: never a payload, a page
// text, a typed value or a credential.

import type { ClientGatewayTraceCompletenessIssue } from "fluxiq/client-gateway";

/** Bytes kept for a trace's events, split the way the project store keeps them. */
export type TraceEventBytes = Readonly<{
  /** Every event's JSON, UTF-8. */
  total: number;
  /** Events held inline in the event row (below the content store threshold). */
  inline: number;
  inlineEvents: number;
  /** Events held as content objects (at or above the threshold). */
  object: number;
  objectEvents: number;
}>;

/** What the result metadata said the client uploaded, summed over the trace's results. */
export type TraceArtifactReferences = Readonly<{
  /** Outbound commands that carried a trace request (`metadata.trace.artifacts: true`). */
  tracedCommands: number;
  /** Inbound results that carried trace result metadata. */
  resultsWithReferences: number;
  primary: number;
  resource: number;
  /** Bytes the references declare, by role. */
  primaryBytes: number;
  resourceBytes: number;
  /** Summed `unavailable` counts: artifacts the client could not capture or upload. */
  unavailable: number;
  /** Referenced artifacts by media type (a protocol value, never a page value). */
  byMediaType: Readonly<Record<string, number>>;
  /** Inbound or outbound raw text payloads that did not parse as JSON, so could not be read for references. */
  unparsablePayloads: number;
}>;

/** Whether credential-bearing protocol messages in the trace carry the credential redaction. */
export type TraceCredentialRedactions = Readonly<Record<string, Readonly<{ events: number; redacted: number }>>>;

/** Command round trips the trace shows: outbound command to its inbound answer, by command id. */
export type TraceCommandTimings = Readonly<{
  commands: number;
  answered: number;
  /** Per outbound message type: count and the answer time in milliseconds (Core's observed clock). */
  byMessageType: Readonly<Record<string, Readonly<{ count: number; totalMs: number; maxMs: number }>>>;
}>;

export type TraceSummary = Readonly<{
  traceId: string;
  episodeId: string;
  activity: string;
  startedAt: string;
  closedAt: string | null;
  terminationReason: string | null;
  claimedCompleteness: string;
  /** `evaluateClientGatewayTraceCompleteness` over the stored evidence. */
  completeness: Readonly<{ status: string; issues: readonly ClientGatewayTraceCompletenessIssue[]; redactionLimitations: number }>;
  events: number;
  eventsByKind: Readonly<Record<string, number>>;
  eventsByStream: Readonly<Record<string, number>>;
  eventsByMessageType: Readonly<Record<string, number>>;
  eventBytes: TraceEventBytes;
  /** The manifest's artifact inventory and what the store actually holds of it. */
  artifacts: Readonly<{ inventory: number; held: number; heldBytes: number; distinctSha256: number }>;
  references: TraceArtifactReferences;
  credentialRedactions: TraceCredentialRedactions;
  commandTimings: TraceCommandTimings;
  redactionsByReason: Readonly<Record<string, number>>;
}>;

/** Artifact bytes over all traces read: every reference, and each distinct digest once. */
export type TraceArtifactDedupe = Readonly<{
  references: number;
  referencedBytes: number;
  distinct: number;
  distinctBytes: number;
}>;

/** Whether any secret the caller holds appears in a stored event or artifact. Counts only. */
export type TraceSecretScan = Readonly<{
  secretsChecked: number;
  eventsScanned: number;
  artifactsScanned: number;
  eventHits: number;
  artifactHits: number;
}>;

export type ProjectTraceInspection = Readonly<{
  projectId: string;
  traces: readonly TraceSummary[];
  /** Traces in the store that the filter left out (another run's). */
  tracesSkipped: number;
  dedupe: TraceArtifactDedupe;
  secretScan: TraceSecretScan;
}>;
