// The changed-read gate tool's values (trace plan P5 gate): the reads a trace
// recorded, the changed-read pairs among them, and what the tier-2 reevaluator
// and the snapshot page answered, compared with what each read returned live.
// Recorded commands and results are held in memory only; nothing that leaves
// this tool carries a value read off a page: counts, field paths, codes and
// digest prefixes.

import type { ClientGatewayTraceMatcherAdmission, ClientGatewayTraceRecordedOperation, ClientGatewayTraceReevaluationRequest } from "fluxiq/client-gateway";
import type { WebSnapshotSandboxObservations } from "@fluxiq-web-extension/domain/node";
import type { SnapshotEvaluationSummary } from "../tier2/index.js";

/**
 * One recorded read (an action the domain classifies as only observing the
 * page, `web.dom.capture_snapshot` aside): where it sits among the trace's
 * operations, the page it read (the primary snapshot's address path and
 * digest, from its recorded result's trace references), and the request Core
 * builds for it -- its recorded command and its one recorded result -- or
 * `null` when its segment holds no single readable result.
 */
export type TracedRead = Readonly<{
  traceId: string;
  cursor: number;
  sequence: number;
  actionType: string;
  operation: ClientGatewayTraceRecordedOperation;
  urlPath: string | null;
  snapshot: string | null;
  request: ClientGatewayTraceReevaluationRequest | null;
}>;

/** A trace admitted for matching as Core's matcher admits it, with its reads. */
export type TraceReads = Readonly<{
  traceId: string;
  activity: string;
  admission: ClientGatewayTraceMatcherAdmission;
  reads: readonly TracedRead[];
}>;

/**
 * Two reads of the same action where the second's command differs from the
 * first's: `strict` (same trace and page path, nothing that acts on the page
 * between them), `same_snapshot` (any traces, the same recorded snapshot) or
 * `named` on the command line. `fields` are Core's operation differences of
 * B's command from A's recorded operation, which is what the matcher hands a
 * reevaluator.
 */
export type ReadPair = Readonly<{
  kind: "strict" | "same_snapshot" | "named";
  a: TracedRead;
  b: TracedRead;
  sameSnapshot: boolean;
  fields: readonly string[];
}>;

/** A tier-2 answer (or a page's own result) compared with what a read returned live, on what the page decided. */
export type ReadAnswerComparison = Readonly<{
  equal: boolean;
  status: Readonly<{ live: string | null; answer: string | null; equal: boolean }>;
  failureCode: Readonly<{ live: string | null; answer: string | null; equal: boolean }>;
  /** Record rows (`payload.extracted` as a list), record by record; `null` when neither side returned a list. */
  rows: Readonly<{
    live: number | null;
    answer: number | null;
    /** Positions where the two records are equal by value. */
    equalPositions: number;
    /** Positions where the two records have the same number of cells. */
    cellCountsEqual: number;
    cellsLive: number;
    cellsAnswer: number;
    firstDifference: number | null;
    /** The field names whose values differ at any position (at most 10). */
    differingFields: readonly string[];
  }> | null;
  /** A value that is not a list (a single extracted value): whether it is equal, and its kind on each side. */
  value: Readonly<{ live: string; answer: string; equal: boolean }> | null;
  /** The extraction summary's counts: which differ. */
  summary: Readonly<{ equal: boolean; differing: readonly string[] }>;
}>;

export type PairOutcome =
  | Readonly<{ status: "answered"; comparison: ReadAnswerComparison }>
  | Readonly<{ status: "gap"; reason: string; fields: readonly string[] }>
  | Readonly<{ status: "declined" }>
  | Readonly<{ status: "not_asked"; reason: string }>
  | Readonly<{ status: "threw"; error: string }>;

export type PairReport = Readonly<{
  kind: ReadPair["kind"];
  a: ReadRef;
  b: ReadRef;
  sameSnapshot: boolean;
  fields: readonly string[];
  labels: readonly string[];
  outcome: PairOutcome;
  evaluations: readonly SnapshotEvaluationSummary[];
}>;

export type FidelityOutcome =
  | Readonly<{ status: "evaluated"; comparison: ReadAnswerComparison; controlReproduced: boolean; observations: WebSnapshotSandboxObservations }>
  | Readonly<{ status: "unavailable"; reason: string }>
  | Readonly<{ status: "not_evaluated"; reason: string }>
  | Readonly<{ status: "threw"; error: string }>;

export type FidelityReport = Readonly<{ read: ReadRef; outcome: FidelityOutcome }>;

/** A read named for a report: trace, delivery sequence, action, page path and snapshot digest prefix. */
export type ReadRef = Readonly<{ traceId: string; sequence: number; actionType: string; urlPath: string | null; snapshot: string | null; liveStatus: string | null; liveRows: number | null }>;
