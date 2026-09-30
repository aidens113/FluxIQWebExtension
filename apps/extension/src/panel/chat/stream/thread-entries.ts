// The chat as a person reads it: turns, with the work that led to each one
// folded above it, the way ChatGPT folds "Worked for 2m" above its answer.
// No DOM.
//
// Input is the time-ordered stream (`buildChatStream`). Activity rows that
// sit between two turns form a run, and a run is one fold, however many units
// of work it spans (a build and the run that followed it):
//
//   - a run followed by a FluxIQ turn belongs to that turn: it is the work
//     that answer came from, and it shows above the answer's words;
//   - a run followed by the person's turn led to no answer; it stands on its
//     own, where it happened;
//   - the run after the last turn belongs to the live line while FluxIQ is
//     still working (`working`), and stands on its own once it is not.
//
// A fold's key comes from its first unit of work, so it keeps its element
// (and whether the person opened it) when it moves from the live line to the
// turn that arrived, and when its oldest rows fall out of the relay's window.
//
// A fold's time runs from its first row to its last. When its opening may be
// missing (`partial`) and the person's message just before it has a time on
// Core's clock, it runs from that message instead, which is when the work
// began -- unless the message is over `ASKED_GAP_MS` older than the first row
// left, in which case the work is not that message's and its own rows are all
// the time there is to say.

import type { CoreTurn } from "../conversation";
import type { ActivityRow } from "./activity-rows";
import type { ChatStream } from "./stream-items";

/** How much older than a partial fold's first row the person's message may be and still be where it began. */
const ASKED_GAP_MS = 10 * 60_000;

/** The work between two turns, as one fold. */
export type WorkFold = {
  key: string;
  rows: ActivityRow[];
  /** When the work began and when its last event was, in ms; not finite when Core's times were unreadable. */
  startAt: number;
  endAt: number;
  /** False when rows may be missing from its start, so no step count is given. */
  complete: boolean;
};

/** One entry of the chat, top to bottom. */
export type ThreadEntry =
  | { kind: "turn"; key: string; turn: CoreTurn; work: WorkFold | null }
  | { kind: "work"; key: string; fold: WorkFold };

/** The chat's entries, and the work the live line carries while FluxIQ is working. */
export type ChatThread = { entries: ThreadEntry[]; live: WorkFold | null };

/** Folds the stream's rows above the turns they led to. */
export function buildChatThread(stream: ChatStream, working: boolean): ChatThread {
  const entries: ThreadEntry[] = [];
  const keys = new Map<string, number>();
  let pending: ActivityRow[] = [];
  let askedAt = Number.NEGATIVE_INFINITY;

  const fold = (): WorkFold | null => {
    if (pending.length === 0) return null;
    const rows = pending;
    pending = [];
    const base = `work:${rows[0]!.activityId}`;
    const seen = keys.get(base) ?? 0;
    keys.set(base, seen + 1);
    const complete = rows.every((row) => !stream.partial.has(row.activityId));
    const first = rows[0]!.at;
    const startAt = !complete && Number.isFinite(askedAt) && askedAt < first && first - askedAt <= ASKED_GAP_MS ? askedAt : first;
    return { key: seen === 0 ? base : `${base}#${seen + 1}`, rows, startAt, endAt: Math.max(...rows.map((row) => row.endAt)), complete };
  };
  const standAlone = (): void => {
    const made = fold();
    if (made !== null) entries.push({ kind: "work", key: made.key, fold: made });
  };

  for (const item of stream.items) {
    if (item.kind === "activity") {
      pending.push(item.row);
      continue;
    }
    if (item.turn.author === "person") {
      standAlone();
      entries.push({ kind: "turn", key: item.key, turn: item.turn, work: null });
      askedAt = item.at;
    } else {
      entries.push({ kind: "turn", key: item.key, turn: item.turn, work: fold() });
      // Answered: work after this is not that message's.
      askedAt = Number.NEGATIVE_INFINITY;
    }
  }
  if (working) return { entries, live: fold() };
  standAlone();
  return { entries, live: null };
}
