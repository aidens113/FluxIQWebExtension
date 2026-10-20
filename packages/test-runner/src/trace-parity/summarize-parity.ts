// Turns Core's trace parity report into what the Lab may write (lane T P3):
// counts of delivery points, divergences by class, and each divergence as its
// sequence, kind, message type, field names and a screened reason. The
// replay's own capture and every payload stay behind.

import type { ClientGatewayTraceManifest, ClientGatewayTraceParityClass, ClientGatewayTraceParityReport } from "fluxiq/client-gateway";
import { screenParityReason } from "./parity-reason.js";
import type { TraceParityClassCounts, TraceParityDivergenceGroup, TraceParityDivergenceRow, TraceParitySummary } from "./types.js";

/** Divergence rows kept in full; every divergence is still counted in the groups. */
export const TRACE_PARITY_ROW_CAP = 400;
const GROUP_SEQUENCES = 8;

export function summarizeTraceParity(input: { manifest: ClientGatewayTraceManifest; events: number; report: ClientGatewayTraceParityReport | null; durationMs: number; failure?: string }): TraceParitySummary {
  const { manifest, report } = input;
  const base = { traceId: manifest.traceId, episodeId: manifest.episodeId, activity: manifest.activity, events: input.events, durationMs: input.durationMs };
  if (report === null) {
    return Object.freeze({
      ...base, verdict: "failed", deliveryPoints: Object.freeze({ compared: 0, matched: 0, diverged: 0, outside: 0 }), divergencesByClass: emptyClassCounts(),
      groups: Object.freeze([]), divergences: Object.freeze([]), divergencesOmitted: 0, normalizations: Object.freeze([]), replayEvents: 0,
      failure: input.failure ?? "the harness produced no report",
    });
  }
  const statuses = { matched: 0, diverged: 0, outside: 0 };
  for (const entry of report.entries) statuses[entry.status] += 1;
  const rows: TraceParityDivergenceRow[] = report.divergences.map(divergence => Object.freeze({
    sequence: divergence.sequence, replaySequence: divergence.replaySequence, class: divergence.class,
    kind: divergence.kind, messageType: divergence.messageType, fields: Object.freeze([...divergence.fields]), reason: screenParityReason(divergence.detail),
  }));
  const counts = { ...emptyClassCounts() } as Record<ClientGatewayTraceParityClass, number>;
  for (const row of rows) counts[row.class] += 1;
  return Object.freeze({
    ...base,
    verdict: report.verdict,
    deliveryPoints: Object.freeze({ compared: statuses.matched + statuses.diverged, ...statuses }),
    divergencesByClass: Object.freeze(counts),
    groups: groupsOf(rows),
    divergences: Object.freeze(rows.slice(0, TRACE_PARITY_ROW_CAP)),
    divergencesOmitted: Math.max(0, rows.length - TRACE_PARITY_ROW_CAP),
    normalizations: Object.freeze(report.normalizations.map(normalization => normalization.field)),
    replayEvents: report.replayEvents.length,
    failure: null,
  });
}

export function emptyClassCounts(): TraceParityClassCounts {
  return Object.freeze({ capture_gap: 0, nondeterminism: 0, intake_defect: 0 });
}

/** Rows grouped by class, kind, message type, field set (array positions as `[*]`) and reason, in first-seen order. */
function groupsOf(rows: readonly TraceParityDivergenceRow[]): readonly TraceParityDivergenceGroup[] {
  const groups = new Map<string, { group: Omit<TraceParityDivergenceGroup, "count" | "sequences">; count: number; sequences: number[] }>();
  for (const row of rows) {
    const fields = [...new Set(row.fields.map(field => field.replace(/\[\d+\]/g, "[*]")))];
    const key = JSON.stringify([row.class, row.kind, row.messageType, fields, row.reason]);
    const entry = groups.get(key) ?? { group: { class: row.class, kind: row.kind, messageType: row.messageType, fields: Object.freeze(fields), reason: row.reason }, count: 0, sequences: [] };
    entry.count += 1;
    const sequence = row.sequence ?? row.replaySequence;
    if (sequence !== null && entry.sequences.length < GROUP_SEQUENCES) entry.sequences.push(sequence);
    groups.set(key, entry);
  }
  return Object.freeze([...groups.values()].map(entry => Object.freeze({ ...entry.group, count: entry.count, sequences: Object.freeze(entry.sequences) })));
}
