// The chat's message stream as data: Core's thread turns and FluxIQ's step
// messages (`stepMessages`) on one timeline. No DOM, no folds: every step is
// its own message, where it happened.
//
// Order. By time: a turn's from the turn clock, a step message's from the
// event that opened it (an unreadable `at` takes the message before it, so the
// relay's order holds). On equal times a turn goes first, then everything in
// its own order. A message's time never changes, so once placed it stays put.

import type { ClientGatewayActivity } from "../../../shared/activity/index";
import type { CoreTurn } from "../conversation";
import { stepMessages, type StepMessage } from "./step";
import type { StampedTurn } from "./turn-clock";

/** The most step messages the chat keeps, the newest: several long builds' worth. */
export const CHAT_STEP_MESSAGE_LIMIT = 1_000;

/** One item of the stream. */
export type ChatStreamItem =
  | { kind: "turn"; key: string; at: number; turn: CoreTurn }
  | { kind: "step"; key: string; at: number; message: StepMessage };

/** The chat, top to bottom. */
export type ChatStream = { items: ChatStreamItem[] };

/** The stream for `turns` and the activity `events` the chat on screen shows (oldest first). */
export function buildChatStream(
  turns: readonly StampedTurn[],
  events: readonly ClientGatewayActivity[],
  limit = CHAT_STEP_MESSAGE_LIMIT
): ChatStream {
  const items: ChatStreamItem[] = [
    ...turns.map(({ turn, at }): ChatStreamItem => ({ kind: "turn", key: `turn:${turn.turnId}`, at, turn })),
    ...stepMessages(events, limit).map((message): ChatStreamItem => ({ kind: "step", key: message.key, at: message.at, message }))
  ];
  // Array sort is stable: equal times keep turns first, each in its own order.
  items.sort((a, b) => (a.at === b.at ? 0 : a.at < b.at ? -1 : 1));
  return { items };
}
