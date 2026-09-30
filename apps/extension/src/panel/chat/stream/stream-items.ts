// The chat's message stream as data: Core's thread turns and the relay's
// activity rows (`activityRows`) on one timeline. No DOM.
//
// Order. By time: a turn's from the turn clock, a row's from its first event's
// `at` (an unreadable `at` takes the row before it, so the relay's order
// holds). On equal times a turn goes first, then everything in its own order.

import type { ExtensionActivityState } from "../../../shared/activity/index";
import type { CoreTurn } from "../conversation";
import { activityRows, type ActivityRow } from "./activity-rows";
import type { StampedTurn } from "./turn-clock";

/** The most activity rows the stream keeps. */
export const CHAT_ACTIVITY_ROW_LIMIT = 120;

/** One item of the stream. */
export type ChatStreamItem =
  | { kind: "turn"; key: string; at: number; turn: CoreTurn }
  | { kind: "activity"; key: string; at: number; row: ActivityRow };

/** The stream, and the units of work whose opening may be missing (see `activityRows`). */
export type ChatStream = { items: ChatStreamItem[]; partial: ReadonlySet<string> };

/** The stream for `turns` and the relay's `recent` events. */
export function buildChatStream(
  turns: readonly StampedTurn[],
  recent: ExtensionActivityState["recent"],
  limit = CHAT_ACTIVITY_ROW_LIMIT
): ChatStream {
  const { rows, partial } = activityRows(recent, limit);
  const items: ChatStreamItem[] = [
    ...turns.map(({ turn, at }): ChatStreamItem => ({ kind: "turn", key: `turn:${turn.turnId}`, at, turn })),
    ...rows.map((row): ChatStreamItem => ({ kind: "activity", key: row.key, at: row.at, row }))
  ];
  // Array sort is stable: equal times keep turns first, each in its own order.
  items.sort((a, b) => (a.at === b.at ? 0 : a.at < b.at ? -1 : 1));
  return { items, partial };
}
