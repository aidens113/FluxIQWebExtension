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
 * - A bound that is `undefined`, or any other value that is not a finite number,
 *   excludes nothing.
 */
export type RecordingDiscardScope = { recordingIds: Iterable<string>; sessionId: string | undefined; from: number | undefined; until?: number | undefined };

/**
 * How many discard entries one read of Core's audit log left out because Core
 * stamped them outside the scope's window, per audit type, and by the recording
 * each entry names: one of this run's (`thisRunsRecording`), none
 * (`noRecording`, whichever session sent it), or another (`anotherRecording`).
 * Only counts travel: no entry's id, message, session, recording id, label or
 * input id.
 */
export type RecordingDiscardExclusions = Record<RecordingDiscard["type"], Record<"thisRunsRecording" | "noRecording" | "anotherRecording", number>>;

/**
 * The window a read judged Core's audit entries against, published beside its
 * discards so a run shows what the window left out and not only what it kept:
 * `from` in epoch milliseconds, or `null` when the read had no lower bound;
 * `until` only when the read had an upper bound; and what the window excluded,
 * or `null` when the response carried no audit log to read.
 */
export type RecordingDiscardWindow = { from: number | null; until?: number; excluded: RecordingDiscardExclusions | null };

/** The discards Core audited for this run, the window this read judged them in, and the failure they amount to, if any. */
export type RecordingDiscardAudit = { discards: RecordingDiscard[]; window: RecordingDiscardWindow; failure: RunnerFailure | undefined };

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
 * - The result's `window` publishes the bounds this read applied and a count of
 *   the discard entries it excluded, so a run's bundle can show that a
 *   confirmation outside the window was left out rather than never audited.
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
 *   not, because a page unloading after Stop legitimately emits some. The
 *   failure names a lost action inside this run's recording window, per
 *   recording, as `N for <recordingId>` or `N with no recording id`, and adds
 *   `after finalization` only when every entry showing that loss carries Core's
 *   `sinceFinalizedMs`.
 * - A response that carries no audit log array fails closed, as
 *   `gateway.connection`, rather than ruling every loss out unread, unless
 *   `earlier` already holds a lost action, which still fails as
 *   `recording.persistence`.
 */
export function readRecordingDiscards(snapshot: unknown, scope: RecordingDiscardScope, earlier: readonly RecordingDiscard[] = []): RecordingDiscardAudit {
  const auditLog = (snapshot as { payload?: { auditLog?: unknown } } | null | undefined)?.payload?.auditLog;
  const read = Array.isArray(auditLog) ? readAuditLog(auditLog, scope) : undefined;
  const discards = [...earlier];
  const seen = new Set(earlier.map(entryKey));
  for (const discard of read?.discards ?? []) {
    const key = entryKey(discard);
    if (seen.has(key)) continue;
    seen.add(key);
    discards.push(discard);
  }
  const until = windowBound(scope.until);
  const window: RecordingDiscardWindow = { from: windowBound(scope.from) ?? null, ...(until === undefined ? {} : { until }), excluded: read?.excluded ?? null };
  const lost = lostActions(discards);
  if (lost) return { discards, window, failure: new RunnerFailure("recording.persistence", `Core discarded recorded actions inside this run's recording window (${lost})`, { details: { recordingDiscards: discards } }) };
  if (!read) return { discards, window, failure: new RunnerFailure("gateway.connection", "Core's gateway snapshot carried no audit log, so a recorded action it discarded cannot be ruled out") };
  return { discards, window, failure: undefined };
}

/**
 * Per recording, the most actions any of its entries shows lost, as `N for <recordingId>` or `N with no recording id`,
 * followed by ` after finalization` only when every entry showing that loss carries `sinceFinalizedMs`; undefined when none is.
 */
function lostActions(discards: readonly RecordingDiscard[]): string | undefined {
  const lost = new Map<string | undefined, { actions: number; afterFinalization: boolean }>();
  for (const discard of discards) {
    if (discard.type !== "recording.action_discarded" && discard.discardedActions === 0) continue;
    const group = lost.get(discard.recordingId);
    lost.set(discard.recordingId, { actions: Math.max(group?.actions ?? 0, discard.discardedActions, 1), afterFinalization: (group?.afterFinalization ?? true) && discard.sinceFinalizedMs !== undefined });
  }
  return lost.size
    ? [...lost].map(([recordingId, { actions, afterFinalization }]) => `${recordingId === undefined ? `${actions} with no recording id` : `${actions} for ${recordingId}`}${afterFinalization ? " after finalization" : ""}`).join(", ")
    : undefined;
}

function entryKey(discard: RecordingDiscard): string {
  return discard.entryId ?? JSON.stringify([discard.type, discard.recordingId ?? null, discard.discardedActions, discard.discardedEvents]);
}

/** A discard-typed audit entry, with the recording its metadata names. */
type DiscardEntry = { type: RecordingDiscard["type"]; id: unknown; timestamp: unknown; sessionId: unknown; recordingId: string | undefined; fields: Record<string, unknown> };

/** One pass over Core's audit log: this run's discards inside the window, and a count of the discard entries Core stamped outside it. */
function readAuditLog(auditLog: readonly unknown[], scope: RecordingDiscardScope): { discards: RecordingDiscard[]; excluded: RecordingDiscardExclusions } {
  const wanted = new Set(scope.recordingIds);
  const excluded: RecordingDiscardExclusions = { "recording.action_discarded": noExclusions(), "recording.event_discarded": noExclusions() };
  const discards: RecordingDiscard[] = [];
  for (const item of auditLog) {
    const entry = discardEntry(item);
    if (!entry) continue;
    if (outsideWindow(entry.timestamp, scope)) {
      excluded[entry.type][entry.recordingId === undefined ? "noRecording" : wanted.has(entry.recordingId) ? "thisRunsRecording" : "anotherRecording"] += 1;
      continue;
    }
    const ours = entry.recordingId === undefined ? scope.sessionId !== undefined && entry.sessionId === scope.sessionId : wanted.has(entry.recordingId);
    if (ours) discards.push(discardOf(entry));
  }
  return { discards, excluded };
}

function noExclusions(): Record<"thisRunsRecording" | "noRecording" | "anotherRecording", number> {
  return { thisRunsRecording: 0, noRecording: 0, anotherRecording: 0 };
}

/** The entry when its type is a discard; undefined for any other entry. */
function discardEntry(entry: unknown): DiscardEntry | undefined {
  if (typeof entry !== "object" || entry === null) return undefined;
  const { id, type, timestamp, sessionId, metadata } = entry as { id?: unknown; type?: unknown; timestamp?: unknown; sessionId?: unknown; metadata?: unknown };
  if (type !== "recording.action_discarded" && type !== "recording.event_discarded") return undefined;
  const fields = typeof metadata === "object" && metadata !== null ? metadata as Record<string, unknown> : {};
  const recordingId = typeof fields.recordingId === "string" && fields.recordingId ? fields.recordingId : undefined;
  return { type, id, timestamp, sessionId, recordingId, fields };
}

function discardOf({ type, id, recordingId, fields }: DiscardEntry): RecordingDiscard {
  const sinceFinalizedMs = count(fields.sinceFinalizedMs);
  return {
    type,
    ...(typeof id === "string" && id ? { entryId: id } : {}),
    ...(recordingId === undefined ? {} : { recordingId }),
    discardedActions: count(fields.discardedActions) ?? 0,
    discardedEvents: count(fields.discardedEvents) ?? 0,
    ...(sinceFinalizedMs === undefined ? {} : { sinceFinalizedMs }),
  };
}

/** Whether Core stamped an entry outside the scope's window. An unreadable timestamp is inside it. */
function outsideWindow(timestamp: unknown, scope: RecordingDiscardScope): boolean {
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) return false;
  const from = windowBound(scope.from);
  const until = windowBound(scope.until);
  return (from !== undefined && timestamp < from) || (until !== undefined && timestamp > until);
}

/** A window bound as it is applied and published: a finite number, or undefined for no bound. */
function windowBound(bound: unknown): number | undefined {
  return typeof bound === "number" && Number.isFinite(bound) ? bound : undefined;
}

function count(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}
