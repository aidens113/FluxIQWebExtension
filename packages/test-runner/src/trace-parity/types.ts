// What the Lab writes about replaying a stored client gateway trace through
// Core's own intake (trace-offline-trials-plan, lane T P3): per trace, the
// verdict, how many delivery points were compared and matched, and each
// divergence by class with its sequence, event kind, protocol message type,
// the field names that differ and a reason from a closed vocabulary. Never a
// payload, a page text, a typed value or a credential.

import type { ClientGatewayTraceParityClass, ClientGatewayTraceParityReport, ClientGatewayTraceSessionReferences, ClientGatewayTraceStore } from "fluxiq/client-gateway";

/** One delivery point that did not match, by name only. */
export type TraceParityDivergenceRow = Readonly<{
  /** The original event's sequence; `null` for an event only the replay has, or a failure outside any event. */
  sequence: number | null;
  replaySequence: number | null;
  class: ClientGatewayTraceParityClass;
  kind: string | null;
  messageType: string | null;
  /** The fields that differ, as paths of field names (`payload.value.delivered.result`); `event` when one side has none. */
  fields: readonly string[];
  /** Core's reason, kept only when it matches a known template (`parity-reason.ts`); otherwise withheld. */
  reason: string;
}>;

/** Divergences of one class, kind, message type, field set and reason, counted. */
export type TraceParityDivergenceGroup = Readonly<{
  class: ClientGatewayTraceParityClass;
  kind: string | null;
  messageType: string | null;
  fields: readonly string[];
  reason: string;
  count: number;
  /** The first few original sequences (or replay sequences, for replay-only events), in order. */
  sequences: readonly number[];
}>;

export type TraceParityClassCounts = Readonly<Record<ClientGatewayTraceParityClass, number>>;

export type TraceParitySummary = Readonly<{
  traceId: string;
  episodeId: string;
  activity: string;
  /** Events the trace holds. */
  events: number;
  /** `failed` when the harness could not produce a report at all (see `failure`). */
  verdict: "matched" | "diverged" | "failed";
  /** Recorded delivery points: compared (matched + diverged), and those outside gateway parity (control inputs). */
  deliveryPoints: Readonly<{ compared: number; matched: number; diverged: number; outside: number }>;
  /** Every divergence, including events only the replay derived and failures outside any event. */
  divergencesByClass: TraceParityClassCounts;
  groups: readonly TraceParityDivergenceGroup[];
  divergences: readonly TraceParityDivergenceRow[];
  /** Divergences left out of `divergences` past its cap; every one is still counted in `groups` and `divergencesByClass`. */
  divergencesOmitted: number;
  /** Fields Core's harness normalized, by name. */
  normalizations: readonly string[];
  replayEvents: number;
  durationMs: number;
  /** Why no report was produced, in closed text; `null` when one was. */
  failure: string | null;
}>;

export type ProjectTraceParity = Readonly<{
  projectId: string;
  traces: readonly TraceParitySummary[];
  /** Traces in the store the filter left out. */
  tracesSkipped: number;
  totals: Readonly<{ traces: number; matched: number; diverged: number; failed: number; compared: number; matchedPoints: number; divergencesByClass: TraceParityClassCounts }>;
  durationMs: number;
}>;

/** Core's harness, or a stand-in for it in tests. */
export type TraceReplay = (input: { store: ClientGatewayTraceStore; traceId: string }) => Promise<ClientGatewayTraceParityReport>;

/** One delivery point near a trace's end, by name only. */
export type DeliveryTailRow = Readonly<{
  sequence: number;
  /** Core's observed time since the trace's clock origin. */
  logicalMs: number;
  kind: string;
  messageType: string | null;
  /** The command by its ordinal in the trace (`c1`, `c2`, ...); never its id. */
  command: string | null;
  /** Closed protocol names read from known fields (action, statuses, failure code and stage, disposition, outcome); any other value is withheld. */
  names: Readonly<Record<string, string>>;
  /** Its parity entry in Core's report, or `null`. */
  parity: "matched" | "diverged" | "outside" | null;
}>;

export type DeliveryTail = Readonly<{
  rows: readonly DeliveryTailRow[];
  /** `server.execute_action` commands the trace issued. */
  commands: number;
  /** Commands no client result and no Core-synthesized outcome in the trace answered, by ordinal. */
  unanswered: readonly string[];
  lastEventMs: number | null;
}>;

/** One trace of a store on disk: its parity by Core's harness, and its tail. */
export type StoreTraceCheck = Readonly<{
  traceId: string;
  episodeId: string;
  activity: string;
  terminationReason: string | null;
  startedAt: string;
  closedAt: string | null;
  events: number;
  /**
   * How Core's harness found the trace's events naming their session: `recorded`; `single_session`, a legacy trace
   * shown to hold one session, replayed with it attached (a normalization the summary names); `refused`, a legacy
   * trace that could not be shown single-session, its events capture gaps whose reason says why. `null` when the
   * harness produced no report.
   */
  sessionReferences: ClientGatewayTraceSessionReferences["status"] | null;
  recorded: TraceParitySummary;
  /** Of `recorded`'s divergences, the capture gaps Core gave dispositions recorded under schema version 1 (no delivered digests) whose every recorded field matched. */
  olderDispositionSchemaOnly: number;
  tail: DeliveryTail;
}>;

export type StoreTracesCheck = Readonly<{
  projects: readonly Readonly<{ projectId: string; traces: readonly StoreTraceCheck[] }>[];
  durationMs: number;
}>;
