import { RunnerFailure } from "../failure.js";

/**
 * One discard Core audited against a recording this run produced: the entry's
 * type, the recording, Core's running counts for it, and how long after
 * finalization the message arrived. Nothing else of the entry travels. Its
 * `message`, client name and input id are not needed to see that a recording
 * reached Core short.
 */
export type RecordingDiscard = {
  type: "recording.action_discarded" | "recording.event_discarded";
  recordingId: string;
  discardedActions: number;
  discardedEvents: number;
  sinceFinalizedMs?: number;
};

/** The discards Core audited for this run's recordings, and the failure they amount to, if any. */
export type RecordingDiscardAudit = { discards: RecordingDiscard[]; failure: RunnerFailure | undefined };

/**
 * Reads Core's gateway audit log, from the full `/api/client-gateway/snapshot`
 * response, for discards against the recordings this run produced.
 *
 * Core audits a client message that reaches a recording after it was finalized
 * as `recording.action_discarded` or `recording.event_discarded`, and sends the
 * client nothing (`bridge.ts` `noteDiscardedClientMessage`; since Core `267a2ca`
 * also for the finalize-to-removal window, which used to fail the connection).
 * So this audit is the only place a recording that reached Core short can be
 * seen, and a run that lost an action there must not exit 0.
 *
 * - Only entries whose `metadata.recordingId` is one of `recordingIds` count. A
 *   discard against another client's or an earlier run's recording is not this
 *   run's loss.
 * - Any discarded executable action for them fails as `recording.persistence`:
 *   an `action_discarded` entry, or Core's running `discardedActions` above zero
 *   on any entry. Discarded evidence alone does not, because a page unloading
 *   after Stop legitimately emits some.
 * - A response that carries no audit log array fails closed, as
 *   `gateway.connection`, rather than ruling every loss out unread.
 */
export function readRecordingDiscards(snapshot: unknown, recordingIds: Iterable<string>): RecordingDiscardAudit {
  const auditLog = (snapshot as { payload?: { auditLog?: unknown } } | null | undefined)?.payload?.auditLog;
  if (!Array.isArray(auditLog)) {
    return { discards: [], failure: new RunnerFailure("gateway.connection", "Core's gateway snapshot carried no audit log, so a recorded action it discarded cannot be ruled out") };
  }
  const wanted = new Set(recordingIds);
  const discards = auditLog.flatMap(entry => discardOf(entry, wanted));
  const lost = new Map<string, number>();
  for (const discard of discards) {
    if (discard.type !== "recording.action_discarded" && discard.discardedActions === 0) continue;
    lost.set(discard.recordingId, Math.max(lost.get(discard.recordingId) ?? 0, discard.discardedActions, 1));
  }
  if (!lost.size) return { discards, failure: undefined };
  const summary = [...lost].map(([recordingId, actions]) => `${actions} for ${recordingId}`).join(", ");
  return { discards, failure: new RunnerFailure("recording.persistence", `Core discarded recorded actions that arrived after their recording was finalized (${summary})`, { details: { recordingDiscards: discards } }) };
}

function discardOf(entry: unknown, wanted: ReadonlySet<string>): RecordingDiscard[] {
  if (typeof entry !== "object" || entry === null) return [];
  const { type, metadata } = entry as { type?: unknown; metadata?: unknown };
  if (type !== "recording.action_discarded" && type !== "recording.event_discarded") return [];
  const fields = typeof metadata === "object" && metadata !== null ? metadata as Record<string, unknown> : {};
  const recordingId = fields.recordingId;
  if (typeof recordingId !== "string" || !wanted.has(recordingId)) return [];
  const sinceFinalizedMs = count(fields.sinceFinalizedMs);
  return [{
    type, recordingId,
    discardedActions: count(fields.discardedActions) ?? 0,
    discardedEvents: count(fields.discardedEvents) ?? 0,
    ...(sinceFinalizedMs === undefined ? {} : { sinceFinalizedMs }),
  }];
}

function count(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}
