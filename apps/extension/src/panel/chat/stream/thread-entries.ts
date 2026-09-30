// The chat as a person reads it: turns, with the work that led to each one
// folded under it, the way ChatGPT folds "Worked for 2m" above its answer.
// No DOM.
//
// Input is the time-ordered stream (`buildChatStream`). Activity rows that
// sit between two turns form a run; a run splits into groups by unit of work
// (`activityId`), so one build's 46 steps are one group and a run that
// follows it is another. Where each group goes:
//
//   - a run followed by a FluxIQ turn belongs to that turn: it is the work
//     that answer came from, and it shows above the answer's words;
//   - a run followed by the person's turn led to no answer; its groups stand
//     on their own, where they happened;
//   - the run after the last turn belongs to the live line while FluxIQ is
//     still working (`working`), and stands on its own once it is not.
//
// A group's key is its first row's, so it keeps its element (and whether the
// person opened it) when it moves from the live line to the turn that
// arrived.

import type { CoreTurn } from "../../simple/conversation";
import type { ActivityRow, ChatStreamItem } from "./stream-items";

/** The rows of one unit of work between two turns. */
export type WorkGroup = {
  key: string;
  activityId: string;
  rows: ActivityRow[];
  /** The first row's time and the last event's, in ms; not finite when Core's times were unreadable. */
  startAt: number;
  endAt: number;
};

/** One entry of the chat, top to bottom. */
export type ThreadEntry =
  | { kind: "turn"; key: string; turn: CoreTurn; work: WorkGroup[] }
  | { kind: "work"; key: string; group: WorkGroup };

/** The chat's entries, and the work the live line carries while FluxIQ is working. */
export type ChatThread = { entries: ThreadEntry[]; live: WorkGroup[] };

/** Folds the stream's rows under the turns they led to. */
export function buildChatThread(items: readonly ChatStreamItem[], working: boolean): ChatThread {
  const entries: ThreadEntry[] = [];
  let pending: WorkGroup[] = [];
  const standAlone = (): void => {
    for (const group of pending) entries.push({ kind: "work", key: group.key, group });
    pending = [];
  };
  for (const item of items) {
    if (item.kind === "activity") {
      const last = pending[pending.length - 1];
      if (last !== undefined && last.activityId === item.row.activityId) {
        last.rows.push(item.row);
        last.endAt = Math.max(last.endAt, item.row.endAt);
      } else {
        pending.push({ key: `work:${item.row.key}`, activityId: item.row.activityId, rows: [item.row], startAt: item.row.at, endAt: item.row.endAt });
      }
      continue;
    }
    if (item.turn.author === "person") {
      standAlone();
      entries.push({ kind: "turn", key: item.key, turn: item.turn, work: [] });
    } else {
      entries.push({ kind: "turn", key: item.key, turn: item.turn, work: pending });
      pending = [];
    }
  }
  if (working) return { entries, live: pending };
  standAlone();
  return { entries, live: [] };
}
