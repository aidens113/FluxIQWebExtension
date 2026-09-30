// The chat's message stream as data: Core's thread turns and the relay's
// activity rows on one timeline. No DOM.
//
// Rows. Only an event with a `detail` is a row; a pure status change moves the
// header and nothing else. Events of one unit of work that describe the same
// thing -- the same `activityId`, `detail.kind` and `ref` (or title, when there
// is no ref) -- are one row while it is open: a tool that `started` and then
// `succeeded` is one row that now says succeeded, where it first appeared.
// A row that already finished is not reopened; the next such event is a new
// row. At most `limit` rows are kept, the newest.
//
// Order. By time: a turn's from the turn clock, a row's from its first event's
// `at` (an unreadable `at` takes the row before it, so the relay's order
// holds). On equal times a turn goes first, then everything in its own order.

import type { ClientGatewayActivity, ExtensionActivityState } from "../../../shared/activity/index";
import type { CoreTurn } from "../../simple/conversation";
import type { StampedTurn } from "./turn-clock";

/** The most activity rows the stream keeps. */
export const CHAT_ACTIVITY_ROW_LIMIT = 40;

type ActivityDetail = NonNullable<ClientGatewayActivity["detail"]>;

/** One activity row: one line of a fold's list. */
export type ActivityRow = {
  /** Stable for the row's life, so a re-render keeps it open. */
  key: string;
  /** The unit of work it belongs to (`ClientGatewayActivity.activityId`). */
  activityId: string;
  kind: ActivityDetail["kind"];
  title: string;
  text: string | undefined;
  ref: string | undefined;
  status: ActivityDetail["status"];
  phase: ClientGatewayActivity["phase"];
  /** The row's first event's time, in ms. */
  at: number;
  /** The row's last event's time, in ms. */
  endAt: number;
  /** The last event folded into it. */
  sequence: number;
};

/** One item of the stream. */
export type ChatStreamItem =
  | { kind: "turn"; key: string; at: number; turn: CoreTurn }
  | { kind: "activity"; key: string; at: number; row: ActivityRow };

/** The stream for `turns` and the relay's `recent` events. */
export function buildChatStream(
  turns: readonly StampedTurn[],
  recent: ExtensionActivityState["recent"],
  limit = CHAT_ACTIVITY_ROW_LIMIT
): ChatStreamItem[] {
  // slice(-0) would keep everything, so a zero limit is said outright.
  const rows = limit > 0 ? activityRows(recent).slice(-limit) : [];
  const items: ChatStreamItem[] = [
    ...turns.map(({ turn, at }): ChatStreamItem => ({ kind: "turn", key: `turn:${turn.turnId}`, at, turn })),
    ...rows.map((row): ChatStreamItem => ({ kind: "activity", key: row.key, at: row.at, row }))
  ];
  // Array sort is stable: equal times keep turns first, each in its own order.
  return items.sort((a, b) => (a.at === b.at ? 0 : a.at < b.at ? -1 : 1));
}

function activityRows(recent: ExtensionActivityState["recent"]): ActivityRow[] {
  const rows: ActivityRow[] = [];
  const open = new Map<string, number>();
  let lastAt = Number.NEGATIVE_INFINITY;
  for (const event of [...recent].sort((a, b) => a.sequence - b.sequence)) {
    const parsed = Date.parse(event.at);
    const at = Number.isFinite(parsed) ? parsed : lastAt;
    lastAt = at;
    const detail = event.detail;
    if (detail === undefined) continue;
    const identity = `${event.activityId}|${detail.kind}|${detail.ref ?? detail.title}`;
    const index = open.get(identity);
    const text = detail.text?.trim() || undefined;
    if (index !== undefined) {
      const row = rows[index]!;
      rows[index] = rowOf(row.key, event, detail, { at: row.at, endAt: Math.max(row.at, at) }, text ?? row.text);
    } else {
      rows.push(rowOf(`activity:${event.activityId}#${event.sequence}`, event, detail, { at, endAt: at }, text));
    }
    if (detail.status === "started") open.set(identity, index ?? rows.length - 1);
    else open.delete(identity);
  }
  return rows;
}

function rowOf(
  key: string,
  event: ClientGatewayActivity,
  detail: ActivityDetail,
  time: { at: number; endAt: number },
  text: string | undefined
): ActivityRow {
  const ref = detail.ref?.trim() || undefined;
  return {
    key,
    activityId: event.activityId,
    kind: detail.kind,
    title: detail.title,
    text,
    ref,
    status: detail.status,
    phase: event.phase,
    at: time.at,
    endAt: time.endAt,
    sequence: event.sequence
  };
}
