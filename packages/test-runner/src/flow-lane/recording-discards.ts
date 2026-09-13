import { RunnerFailure } from "../failure.js";

/**
 * One discard Core audited against this run: the entry's type and id, the
 * recording when the entry names one, Core's running counts, and how long after
 * finalization the message arrived. Nothing else of the entry travels. Its
 * `message`, client name, session and input id are not needed to see that a
 * recording reached Core short. `entryId` is Core's random audit id
 * (`ClientGatewayAuditLog.record`), carried so that two reads of the log are
 * unioned without counting an entry twice. `recordingId` is absent for an entry
 * that named none and was counted by the run's session.
 */
export type RecordingDiscard = {
  type: "recording.action_discarded" | "recording.event_discarded";
  entryId?: string;
  recordingId?: string;
  discardedActions: number;
  discardedEvents: number;
  sinceFinalizedMs?: number;
};

/**
 * What makes a discard this run's: the recordings it produced, the session it
 * paired, and the window in which this recording could lose a message.
 * `sessionId` and `from` are required and may be `undefined`, so that no read
 * can leave either out by omission.
 *
 * - `from` is the time, in epoch milliseconds, just before the runner asks the
 *   extension to start recording. Before it, a Core-dispatched action's runtime
 *   confirmation reaches Core with no recording open, and Core audits it as a
 *   discarded action that names no recording.
 * - `until` is the time just before the Flow lane dispatches its Flow, whose own
 *   runtime confirmations Core audits against the finalized recording. It is
 *   absent when no Flow was dispatched, and the window is then open-ended.
 * - A bound that is `undefined` excludes nothing.
 */
export type RecordingDiscardScope = { recordingIds: Iterable<string>; sessionId: string | undefined; from: number | undefined; until?: number | undefined };

/** The discards Core audited for this run, and the failure they amount to, if any. */
export type RecordingDiscardAudit = { discards: RecordingDiscard[]; failure: RunnerFailure | undefined };

/**
 * Reads Core's gateway audit log, from the full `/api/client-gateway/snapshot`
 * response, for discards against this run.
 *
 * Core audits a client message that reaches a recording after it was finalized
 * as `recording.action_discarded` or `recording.event_discarded`, and sends the
 * client nothing (`bridge.ts` `noteDiscardedClientMessage`; since Core `267a2ca`
 * also for the finalize-to-removal window, which used to fail the connection).
 * So this audit is the only place a recording that reached Core short can be
 * seen, and a run that lost an action there must not exit 0.
 *
 * - Only an entry Core audited inside `scope`'s window, `from` to `until`
 *   inclusive, is read, whether it names a recording or only the session. Core
 *   stamps each entry with its own `Date.now()` (`ClientGatewayAuditLog.record`),
 *   the same machine's clock the runner takes both bounds from. An entry with no
 *   readable timestamp is read, so the window fails closed.
 * - An entry whose `metadata.recordingId` is one of `scope.recordingIds` counts.
 *   A discard against another client's or an earlier run's recording is not
 *   this run's loss, even in this run's session.
 * - An entry that names no recording counts when its `sessionId` is
 *   `scope.sessionId`. Every audit entry keeps the session that sent the message
 *   (`ClientGatewayAuditLog.record`), so a message Core attached to no recording
 *   is still this run's loss when this run's session sent it. Another session's
 *   is not, and with no paired session none is.
 * - Core audits a discard only when the late message arrives, so a single read
 *   can come too early. A later read passes an earlier read's discards as
 *   `earlier`, and the result is those followed by each entry of this read not
 *   already among them, matched by audit entry id, or, for an entry without
 *   one, by its type, recording and running counts (Core's `discardedEvents`
 *   rises with every discard of a recording, so no two of its entries share
 *   them). An entry both reads return is counted once; one that left Core's
 *   100-entry snapshot window before the later read is kept from the earlier.
 * - Any discarded executable action in that union fails as
 *   `recording.persistence`: an `action_discarded` entry, or Core's running
 *   `discardedActions` above zero on any entry. Discarded evidence alone does
 *   not, because a page unloading after Stop legitimately emits some.
 * - A response that carries no audit log array fails closed, as
 *   `gateway.connection`, rather than ruling every loss out unread, unless
 *   `earlier` already holds a lost action, which still fails as
 *   `recording.persistence`.
 */
export function readRecordingDiscards(snapshot: unknown, scope: RecordingDiscardScope, earlier: readonly RecordingDiscard[] = []): RecordingDiscardAudit {
  const auditLog = (snapshot as { payload?: { auditLog?: unknown } } | null | undefined)?.payload?.auditLog;
  const wanted = new Set(scope.recordingIds);
  const discards = [...earlier];
  const seen = new Set(earlier.map(entryKey));
  for (const discard of Array.isArray(auditLog) ? auditLog.flatMap(entry => discardOf(entry, wanted, scope)) : []) {
    const key = entryKey(discard);
    if (seen.has(key)) continue;
    seen.add(key);
    discards.push(discard);
  }
  const lost = lostActions(discards);
  if (lost) return { discards, failure: new RunnerFailure("recording.persistence", `Core discarded recorded actions that arrived after their recording was finalized (${lost})`, { details: { recordingDiscards: discards } }) };
  if (!Array.isArray(auditLog)) return { discards, failure: new RunnerFailure("gateway.connection", "Core's gateway snapshot carried no audit log, so a recorded action it discarded cannot be ruled out") };
  return { discards, failure: undefined };
}

/** Per recording, the most actions any of its entries shows lost, as `N for <recordingId>`, or `N with no recording id`; undefined when none is. */
function lostActions(discards: readonly RecordingDiscard[]): string | undefined {
  const lost = new Map<string | undefined, number>();
  for (const discard of discards) {
    if (discard.type !== "recording.action_discarded" && discard.discardedActions === 0) continue;
    lost.set(discard.recordingId, Math.max(lost.get(discard.recordingId) ?? 0, discard.discardedActions, 1));
  }
  return lost.size ? [...lost].map(([recordingId, actions]) => recordingId === undefined ? `${actions} with no recording id` : `${actions} for ${recordingId}`).join(", ") : undefined;
}

function entryKey(discard: RecordingDiscard): string {
  return discard.entryId ?? JSON.stringify([discard.type, discard.recordingId ?? null, discard.discardedActions, discard.discardedEvents]);
}

function discardOf(entry: unknown, wanted: ReadonlySet<string>, scope: RecordingDiscardScope): RecordingDiscard[] {
  if (typeof entry !== "object" || entry === null) return [];
  const { id, type, timestamp, sessionId: entrySessionId, metadata } = entry as { id?: unknown; type?: unknown; timestamp?: unknown; sessionId?: unknown; metadata?: unknown };
  if (type !== "recording.action_discarded" && type !== "recording.event_discarded") return [];
  if (outsideWindow(timestamp, scope)) return [];
  const fields = typeof metadata === "object" && metadata !== null ? metadata as Record<string, unknown> : {};
  const recordingId = typeof fields.recordingId === "string" && fields.recordingId ? fields.recordingId : undefined;
  const ours = recordingId === undefined ? scope.sessionId !== undefined && entrySessionId === scope.sessionId : wanted.has(recordingId);
  if (!ours) return [];
  const sinceFinalizedMs = count(fields.sinceFinalizedMs);
  return [{
    type,
    ...(typeof id === "string" && id ? { entryId: id } : {}),
    ...(recordingId === undefined ? {} : { recordingId }),
    discardedActions: count(fields.discardedActions) ?? 0,
    discardedEvents: count(fields.discardedEvents) ?? 0,
    ...(sinceFinalizedMs === undefined ? {} : { sinceFinalizedMs }),
  }];
}

/** Whether Core stamped an entry outside the scope's window. An unreadable timestamp is inside it, and a bound that is not a number excludes nothing. */
function outsideWindow(timestamp: unknown, { from, until }: RecordingDiscardScope): boolean {
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) return false;
  return (typeof from === "number" && timestamp < from) || (typeof until === "number" && timestamp > until);
}

function count(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}
