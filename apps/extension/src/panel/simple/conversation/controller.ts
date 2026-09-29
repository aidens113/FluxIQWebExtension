// What the conversation card knows, and every request it makes. No DOM, so
// each rule below is tested directly.
//
// The conversation belongs to FluxIQ Core (UI audit, section 4, principle 6).
// This holds only what is on screen -- the end of the most recent open thread,
// as Core last answered it -- plus whether a send or an answer is in flight.
// There are no local turns, ids, model calls or merging: after a send or an
// answer the thread is read again and what Core says replaces what was shown.
//
// Which thread: the most recent open one (`list-conversations`, open, limit 1).
// A read happens when the card is shown, after each send and answer, and on a
// timer while it is visible; a thread whose `revision` has not moved is not
// read again.
//
// Errors end with their cause. A read error clears on the next good read; a
// send error when the person sends again; both, and every answer error, when
// the connection drops, because the composer is disabled then and "Try again"
// would be advice nobody can take. An answer error clears when the question is
// no longer waiting.
//
// Two failures turn the card into its "Talk to FluxIQ in the FluxIQ window."
// fallback, because trying again from here cannot help:
//   unsupported  this extension's background does not know the message; it
//                lasts as long as the card is mounted
//   refused      FluxIQ refused this browser's token (`code: "refused"`, an
//                older FluxIQ that takes only its own login); it lasts until the
//                connection drops, since pairing again reconnects
// Every other failure is an error sentence beside what was on screen.

import { RUNTIME_MESSAGES } from "../../../shared/constants";
import type { PanelResult, PanelStore } from "../../state";
import { parseConversation, type CoreTurn } from "./core-thread";
import { readThreadTail } from "./thread-tail";

/** Which of the card's faces shows. */
export type ConversationMode = "fallback" | "offline" | "loading" | "empty" | "thread";

/** Why the card shows its fallback. */
export type ConversationFallbackReason = "unsupported" | "refused";

/** Everything the card renders. */
export type ConversationState = {
  mode: ConversationMode;
  /** Set exactly when `mode` is `fallback`. */
  fallbackReason?: ConversationFallbackReason | undefined;
  turns: readonly CoreTurn[];
  readError?: string | undefined;
  sending: boolean;
  sendError?: string | undefined;
  /** Asks whose answer is on its way. */
  answering: ReadonlySet<string>;
  /** Why an answer did not go, by ask. */
  answerErrors: ReadonlyMap<string, string>;
};

export type ConversationController = {
  state(): ConversationState;
  /** Tells it whether FluxIQ is connected. Becoming connected reads the thread. */
  setConnected(connected: boolean): void;
  /** Reads the thread again when it may have changed. Never rejects. */
  refresh(): Promise<void>;
  /** Sends `text` as the person's turn. Answers true once it went, so the composer can empty. */
  send(text: string): Promise<boolean>;
  /** Answers a question FluxIQ asked. */
  answer(askId: string, kind: string, value?: string): Promise<void>;
};

const READ_FAILED = "Couldn't load the conversation.";
const SEND_FAILED = "Couldn't send that. Try again.";
const ANSWER_FAILED = "Couldn't send your answer. Try again.";

type Shown = { conversationId: string; projectId: string; revision: number | undefined };

/** Creates the controller. `onChange` is called after every change to `state()`. */
export function createConversationController(request: PanelStore["request"], onChange: () => void): ConversationController {
  let fallback: ConversationFallbackReason | undefined;
  let connected = false;
  let loaded = false;
  let shown: Shown | undefined;
  let anchorTurnId: string | undefined;
  let turns: readonly CoreTurn[] = [];
  let readError: string | undefined;
  let sending = false;
  let sendError: string | undefined;
  const answering = new Set<string>();
  const answerErrors = new Map<string, string>();
  let inFlight: Promise<void> | undefined;
  let again = false;

  function failed(result: Extract<PanelResult<unknown>, { ok: false }>, sentence: string, set: (sentence: string) => void): void {
    if (result.unsupported) fallback = "unsupported";
    else if (result.code === "refused") fallback ??= "refused";
    else set(sentence);
  }

  async function readOnce(): Promise<void> {
    const listed = await request<{ payload?: { conversations?: unknown } }>({
      type: RUNTIME_MESSAGES.panelConversationRead,
      kind: "list",
      status: "open",
      limit: 1
    });
    if (!listed.ok) return failed(listed, READ_FAILED, (sentence) => (readError = sentence));
    const list = listed.value.payload?.conversations;
    if (!Array.isArray(list)) {
      readError = READ_FAILED;
      return;
    }
    const latest = list.length === 0 ? undefined : parseConversation(list[0]);
    if (list.length > 0 && latest === undefined) {
      readError = READ_FAILED;
      return;
    }
    if (latest === undefined) return settle(undefined, undefined, []);
    const same = shown?.conversationId === latest.conversationId;
    if (same && shown?.revision === latest.revision) return settle(shown, anchorTurnId, turns);

    const tail = await readThreadTail(request, {
      conversationId: latest.conversationId,
      projectId: latest.projectId,
      anchorTurnId: same ? anchorTurnId : undefined
    });
    if (!tail.ok) return failed(tail, READ_FAILED, (sentence) => (readError = sentence));
    if (tail.value.missing) return settle(undefined, undefined, []);
    // An incomplete read leaves the revision unknown, so the next one carries on.
    settle({ ...latest, revision: tail.value.complete ? latest.revision : undefined }, tail.value.anchorTurnId, tail.value.turns);
  }

  function settle(next: Shown | undefined, nextAnchor: string | undefined, nextTurns: readonly CoreTurn[]): void {
    shown = next;
    anchorTurnId = nextAnchor;
    turns = nextTurns;
    loaded = true;
    readError = undefined;
    const pending = new Set(nextTurns.flatMap((turn) => (turn.ask?.status === "pending" ? [turn.ask.askId] : [])));
    for (const askId of [...answerErrors.keys()]) if (!pending.has(askId)) answerErrors.delete(askId);
  }

  function readable(): boolean {
    return connected && fallback === undefined;
  }

  const controller: ConversationController = {
    state() {
      const mode: ConversationMode = fallback !== undefined ? "fallback"
        : !connected ? "offline"
          : turns.length > 0 ? "thread"
            : loaded && readError === undefined ? "empty"
              : "loading";
      return { mode, fallbackReason: fallback, turns, readError, sending, sendError, answering, answerErrors };
    },
    setConnected(next) {
      if (next === connected) return;
      connected = next;
      if (!next) {
        if (fallback === "refused") fallback = undefined;
        readError = undefined;
        sendError = undefined;
        answerErrors.clear();
      }
      onChange();
      if (next) void controller.refresh();
    },
    refresh() {
      if (!readable()) return Promise.resolve();
      if (inFlight) {
        again = true;
        return inFlight;
      }
      inFlight = (async () => {
        do {
          again = false;
          await readOnce();
          onChange();
        } while (again && readable());
        inFlight = undefined;
      })();
      return inFlight;
    },
    async send(text) {
      const body = text.trim();
      if (body === "" || sending || !readable()) return false;
      sending = true;
      sendError = undefined;
      onChange();
      const result = await request<{ payload?: { conversation?: unknown } }>({
        type: RUNTIME_MESSAGES.panelConversationSend,
        text: body,
        conversationId: shown?.conversationId,
        projectId: shown?.projectId
      });
      sending = false;
      if (!result.ok) {
        failed(result, SEND_FAILED, (sentence) => (sendError = sentence));
        onChange();
        return false;
      }
      const opened = parseConversation(result.value.payload?.conversation);
      if (opened !== undefined && opened.conversationId !== shown?.conversationId) {
        // A first message opened a thread: show that one from its start.
        shown = { ...opened, revision: undefined };
        anchorTurnId = undefined;
      } else if (shown) {
        shown = { ...shown, revision: undefined };
      }
      onChange();
      await controller.refresh();
      return true;
    },
    async answer(askId, kind, value) {
      if (answering.has(askId) || !readable()) return;
      answering.add(askId);
      answerErrors.delete(askId);
      onChange();
      const result = await request({
        type: RUNTIME_MESSAGES.panelConversationAnswer,
        askId,
        kind,
        value,
        projectId: shown?.projectId
      });
      answering.delete(askId);
      if (!result.ok) {
        failed(result, ANSWER_FAILED, (sentence) => answerErrors.set(askId, sentence));
        onChange();
        return;
      }
      if (shown) shown = { ...shown, revision: undefined };
      onChange();
      await controller.refresh();
    }
  };
  return controller;
}
