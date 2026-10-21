// The changed-read gate over one copied store (trace plan P5 gate): every
// trace admitted and its reads listed (`./trace-reads.ts`); the pairs
// asked about -- named ones first, then the selected kind (strict,
// same-snapshot or none), optionally one per differing-path set -- each asked
// of the tier-2 reevaluator as Core's matcher would ask it
// (`./reevaluate-read-pair.ts`) and its answer compared with B's live result;
// and every read run over its own snapshot (`./snapshot-fidelity.ts`). Each pair
// keeps the page evaluations it made (control and changed read), so a gap's
// cause can be traced. What comes back is counts, codes, field paths and digest
// prefixes: never a value read off a page.

import { clientGatewayTraceOperationDifferences, type ClientGatewayTraceStore } from "fluxiq/client-gateway";
import type { Tier2Reevaluation } from "../tier2/index.js";
import { onePairPerFields } from "./one-pair-per-fields.js";
import { readFidelity } from "./snapshot-fidelity.js";
import { readTraceReads } from "./trace-reads.js";
import { reevaluateReadPair } from "./reevaluate-read-pair.js";
import { sameSnapshotReadPairs } from "./same-snapshot-read-pairs.js";
import { strictReadPairs } from "./strict-read-pairs.js";
import type { FidelityReport, PairReport, ReadPair, ReadRef, TracedRead, TraceReads } from "./types.js";

/** A pair named on the command line: each side a trace (its id, or the 8 hex digits after `trace.`) and a delivery sequence. */
export type NamedReadPair = Readonly<{ a: Readonly<{ trace: string; sequence: number }>; b: Readonly<{ trace: string; sequence: number }> }>;

export type ReadsGateInput = Readonly<{
  store: ClientGatewayTraceStore;
  traceIds: readonly string[];
  tier2: Pick<Tier2Reevaluation, "page" | "reevaluator" | "takeEvaluations" | "asks">;
  pairs: "strict" | "same_snapshot" | "none";
  named: readonly NamedReadPair[];
  /** Keep the first selected pair of each differing-path set, up to this many; `null` keeps every selected pair. */
  onePerFields: number | null;
  fidelity: boolean;
  progress?: ((line: string) => void) | undefined;
}>;

export type ReadsGateReport = Readonly<{
  traces: readonly Readonly<{ traceId: string; activity: string; refusal: string | null; operations: number; reads: number; readsByAction: Readonly<Record<string, number>> }>[];
  selected: Readonly<{ kind: ReadsGateInput["pairs"]; available: number; named: number; asked: number }>;
  pairs: readonly PairReport[];
  fidelity: readonly FidelityReport[];
  summary: Readonly<{
    pairs: Readonly<{ total: number; answeredEqual: number; answeredDifferent: number; gaps: Readonly<Record<string, number>>; declined: number; notAsked: Readonly<Record<string, number>>; threw: number }>;
    fidelity: Readonly<{ total: number; equal: number; different: number; controlReproduced: number; unavailable: Readonly<Record<string, number>>; notEvaluated: Readonly<Record<string, number>>; threw: number }>;
  }>;
}>;

export async function runReadsGate(input: ReadsGateInput): Promise<ReadsGateReport> {
  const say = input.progress ?? (() => undefined);
  const traces: TraceReads[] = [];
  for (const traceId of input.traceIds) traces.push(await readTraceReads({ store: input.store, traceId }));
  const named = input.named.map((pair) => namedPair(traces, pair));
  const available = input.pairs === "strict" ? traces.flatMap((trace) => strictReadPairs(trace)) : input.pairs === "same_snapshot" ? sameSnapshotReadPairs(traces) : [];
  const chosen = input.onePerFields === null ? available : onePairPerFields(available, input.onePerFields);
  const seen = new Set<string>();
  const asked = [...named, ...chosen].filter((pair) => {
    const key = `${pair.a.traceId}@${pair.a.sequence}/${pair.b.traceId}@${pair.b.sequence}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const pairs: PairReport[] = [];
  for (const pair of asked) {
    const aTrace = traces.find((trace) => trace.traceId === pair.a.traceId)!;
    const asksBefore = input.tier2.asks().length;
    const outcome = await reevaluateReadPair({ store: input.store, aTrace, pair, reevaluator: input.tier2.reevaluator });
    // The watched reevaluator keeps the page evaluations each ask made (control, then changed read).
    const evaluations = input.tier2.asks().slice(asksBefore).flatMap((ask) => ask.evaluations);
    const report: PairReport = Object.freeze({ kind: pair.kind, a: refOf(pair.a), b: refOf(pair.b), sameSnapshot: pair.sameSnapshot, fields: pair.fields, labels: labelsOf(pair), outcome, evaluations });
    pairs.push(report);
    say(`pair ${short(pair.a)} -> ${short(pair.b)} ${outcome.status}${outcome.status === "gap" ? ` ${outcome.reason}` : ""}${outcome.status === "answered" ? (outcome.comparison.equal ? " equal" : " different") : ""}`);
  }
  const fidelity: FidelityReport[] = [];
  if (input.fidelity) {
    for (const read of traces.flatMap((trace) => trace.reads)) {
      input.tier2.takeEvaluations();
      const outcome = await readFidelity({ read, page: input.tier2.page });
      fidelity.push(Object.freeze({ read: refOf(read), outcome }));
      say(`read ${short(read)} ${read.actionType} ${outcome.status}${outcome.status === "evaluated" ? (outcome.comparison.equal ? " equal" : " different") : ""}`);
    }
    input.tier2.takeEvaluations();
  }
  return Object.freeze({
    traces: traces.map((trace) => Object.freeze({
      traceId: trace.traceId, activity: trace.activity, refusal: trace.admission.refusal?.reason ?? null, operations: trace.admission.operations.length, reads: trace.reads.length,
      readsByAction: Object.freeze(tally(trace.reads.map((read) => read.actionType))),
    })),
    selected: Object.freeze({ kind: input.pairs, available: available.length, named: named.length, asked: asked.length }),
    pairs: Object.freeze(pairs),
    fidelity: Object.freeze(fidelity),
    summary: Object.freeze({ pairs: pairSummary(pairs), fidelity: fidelitySummary(fidelity) }),
  });
}

function namedPair(traces: readonly TraceReads[], named: NamedReadPair): ReadPair {
  const a = readAt(traces, named.a);
  const b = readAt(traces, named.b);
  return Object.freeze({ kind: "named", a, b, sameSnapshot: a.snapshot !== null && a.snapshot === b.snapshot, fields: Object.freeze(clientGatewayTraceOperationDifferences(b.operation, a.operation)) });
}

function readAt(traces: readonly TraceReads[], at: NamedReadPair["a"]): TracedRead {
  const trace = traces.find((candidate) => candidate.traceId === at.trace || candidate.traceId.startsWith(`trace.${at.trace}`));
  if (trace === undefined) throw new Error(`The store holds no trace ${at.trace}`);
  const read = trace.reads.find((candidate) => candidate.sequence === at.sequence);
  if (read === undefined) throw new Error(`Trace ${trace.traceId} recorded no read at sequence ${at.sequence}`);
  return read;
}

function labelsOf(pair: ReadPair): string[] {
  const labels: string[] = [];
  if (pair.fields.length > 0 && pair.fields.every((field) => field === "parameters.timeoutMs")) labels.push("timeoutMs_only");
  if (pair.a.traceId !== pair.b.traceId) labels.push("cross_trace");
  labels.push(pair.sameSnapshot ? "same_snapshot" : "different_snapshot");
  return labels;
}

function refOf(read: TracedRead): ReadRef {
  const live = read.request?.recordedResult;
  const payload = typeof live?.payload === "object" && live.payload !== null && !Array.isArray(live.payload) ? live.payload as Record<string, unknown> : undefined;
  return Object.freeze({
    traceId: read.traceId, sequence: read.sequence, actionType: read.actionType, urlPath: read.urlPath, snapshot: read.snapshot?.slice(0, 12) ?? null,
    liveStatus: typeof live?.status === "string" ? live.status : null, liveRows: Array.isArray(payload?.extracted) ? payload.extracted.length : null,
  });
}

function short(read: TracedRead): string {
  return `${read.traceId.slice(6, 14)}@${read.sequence}`;
}

function tally(values: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

function pairSummary(pairs: readonly PairReport[]): ReadsGateReport["summary"]["pairs"] {
  const outcomes = pairs.map((pair) => pair.outcome);
  return Object.freeze({
    total: pairs.length,
    answeredEqual: outcomes.filter((outcome) => outcome.status === "answered" && outcome.comparison.equal).length,
    answeredDifferent: outcomes.filter((outcome) => outcome.status === "answered" && !outcome.comparison.equal).length,
    gaps: Object.freeze(tally(outcomes.flatMap((outcome) => outcome.status === "gap" ? [outcome.reason] : []))),
    declined: outcomes.filter((outcome) => outcome.status === "declined").length,
    notAsked: Object.freeze(tally(outcomes.flatMap((outcome) => outcome.status === "not_asked" ? [outcome.reason] : []))),
    threw: outcomes.filter((outcome) => outcome.status === "threw").length,
  });
}

function fidelitySummary(reports: readonly FidelityReport[]): ReadsGateReport["summary"]["fidelity"] {
  const outcomes = reports.map((report) => report.outcome);
  return Object.freeze({
    total: reports.length,
    equal: outcomes.filter((outcome) => outcome.status === "evaluated" && outcome.comparison.equal).length,
    different: outcomes.filter((outcome) => outcome.status === "evaluated" && !outcome.comparison.equal).length,
    controlReproduced: outcomes.filter((outcome) => outcome.status === "evaluated" && outcome.controlReproduced).length,
    unavailable: Object.freeze(tally(outcomes.flatMap((outcome) => outcome.status === "unavailable" ? [outcome.reason] : []))),
    notEvaluated: Object.freeze(tally(outcomes.flatMap((outcome) => outcome.status === "not_evaluated" ? [outcome.reason] : []))),
    threw: outcomes.filter((outcome) => outcome.status === "threw").length,
  });
}
