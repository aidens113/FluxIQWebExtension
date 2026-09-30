// What the conversation card knows, and every request it makes. No DOM, so
// each rule below is tested directly.
//
// The conversation belongs to FluxIQ Core (UI audit, section 4, principle 6).
// This holds only what is on screen -- the end of the target's open thread,
// as Core last answered it -- plus whether a send or an answer is in flight.
// There are no local turns, ids, model calls or merging: after a send or an
// answer the thread is read again and what Core says replaces what was shown.
//
// Which thread: the target's (`thread-requests.ts`): the project's own open
// thread, or the open thread about one automation. A read happens when the card is
// shown, after each send and answer, and on a timer while it is visible; a
// thread whose `revision` has not moved is not read again. Changing the target
// forgets the thread on screen at once, and a read still on its way for the
// old target lands nowhere, so one thread's turns never show under another's
// name. A send already on its way still goes where it was written.
//
// A failed read is not shown at once. FluxIQ is busy during a build and a
// single read can fail and succeed a second later (a worker restart, a Core
// that briefly answers with an error), so a failure keeps what is on screen
// and reads again quietly (`read/retry.ts`). Only a failure that lasts sets
// `readError`, a notice naming the step and the cause (`read/failure.ts`),
// and `retry()` reads again at once. The poll keeps
// reading meanwhile, and the next good read clears the notice.
//
// Errors end with their cause. A send error clears when the person sends
// again; the read notice, the send error and every answer error when the
// connection drops, because the composer is disabled then and "Try again"
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
// Every other failure keeps what was on screen: a read retries as above, and a
// send or an answer shows its sentence.

import { RUNTIME_MESSAGES } from "../../../shared/constants";
import type { PanelResult, PanelStore } from "../../state";
import type { ChatTarget } from "../target";
import { sameThread } from "../same-thread";
import { parseConversation, type CoreTurn } from "./core-thread";
import { READ_RETRY, readFailureNotice, UNREADABLE_CODE, type ConversationClock, type ThreadReadStep } from "./read";
import { threadListRequest, threadSendRequest } from "./thread-requests";
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
  /** The thread on screen, once there is one. */
  conversationId?: string | undefined;
  /** Set only once reading has kept failing: what failed, and why. */
  readError?: string | undefined;
  /** A read is on its way. */
  reading: boolean;
  sending: boolean;
  sendError?: string | undefined;
  /** Asks whose answer is on its way. */
  answering: ReadonlySet<string>;
  /** Why an answer did not go, by ask. */
  answerErrors: ReadonlyMap<string, string>;
};

export type ConversationController = {
  state(): ConversationState;
  /** Shows `target`'s thread from now on, and reads it. The same thread again (a renamed automation) keeps what is on screen. */
  setTarget(target: ChatTarget): void;
  /** Tells it whether FluxIQ is connected. Becoming connected reads the thread. */
  setConnected(connected: boolean): void;
  /** Reads the thread again when it may have changed. Never rejects. */
  refresh(): Promise<void>;
  /** The person's "Retry": reads at once, and quiet retries start over if it fails again. Never rejects. */
  retry(): Promise<void>;
  /** Sends `text` as the person's turn. Answers true once it went, so the composer can empty. */
  send(text: string): Promise<boolean>;
  /** Answers a question FluxIQ asked. */
  answer(askId: string, kind: string, value?: string): Promise<void>;
};

const SYSTEM_CLOCK: ConversationClock = {
  now: () => Date.now(),
  schedule: (run, ms) => {
    const handle = setTimeout(run, ms);
    return () => clearTimeout(handle);
  }
};

const UNREADABLE_LIST: Extract<PanelResult<unknown>, { ok: false }> = {
  ok: false,
  sentence: "FluxIQ answered with a list of chats this panel can't read.",
  code: UNREADABLE_CODE
};

const SEND_FAILED = "Couldn't send that. Try again.";
const ANSWER_FAILED = "Couldn't send your answer. Try again.";

type Shown = { conversationId: string; projectId: string; revision: number | undefined };

/** Creates the controller. `onChange` is called after every change to `state()`. */
export function createConversationController(request: PanelStore["request"], onChange: () => void, clock: ConversationClock = SYSTEM_CLOCK): ConversationController {
  let fallback: ConversationFallbackReason | undefined;
  let target: ChatTarget = { kind: "latest" };
  // Bumped by every target change; an answer that arrives for an older one is dropped.
  let generation = 0;
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
  // Failed reads in a row, since when, and the quiet retry waiting to run.
  let failing: { since: number; count: number } | undefined;
  let retriesUsed = 0;
  let cancelRetry: (() => void) | undefined;

  function failed(result: Extract<PanelResult<unknown>, { ok: false }>, sentence: string, set: (sentence: string) => void): void {
    if (result.unsupported) fallback = "unsupported";
    else if (result.code === "refused") fallback ??= "refused";
    else set(sentence);
  }

  /** A read failed at `step`: retry quietly, and show the notice only once it has lasted. */
  function readFailed(step: ThreadReadStep, result: Extract<PanelResult<unknown>, { ok: false }>): void {
    if (result.unsupported || result.code === "refused") return failed(result, "", () => undefined);
    const at = clock.now();
    failing = { since: failing?.since ?? at, count: (failing?.count ?? 0) + 1 };
    const lasted = failing.count >= READ_RETRY.noticeAfterFailures && at - failing.since >= READ_RETRY.noticeAfterMs;
    // Once shown, the notice follows the newest cause until a read succeeds.
    if (lasted || readError !== undefined) readError = readFailureNotice(step, result);
    scheduleRetry();
  }

  function scheduleRetry(): void {
    if (cancelRetry !== undefined || retriesUsed >= READ_RETRY.delaysMs.length) return;
    const delay = READ_RETRY.delaysMs[retriesUsed]!;
    retriesUsed += 1;
    cancelRetry = clock.schedule(() => {
      cancelRetry = undefined;
      void controller.refresh();
    }, delay);
  }

  /** Forgets every failed read: after a good read, a new target or a dropped connection. */
  function clearReadFailure(): void {
    cancelRetry?.();
    cancelRetry = undefined;
    failing = undefined;
    retriesUsed = 0;
    readError = undefined;
  }

  async function readOnce(): Promise<void> {
    const asked = generation;
    const listed = await request<{ payload?: { conversations?: unknown } }>(threadListRequest(target));
    if (asked !== generation) return;
    if (!listed.ok) return readFailed("list", listed);
    const list = listed.value.payload?.conversations;
    if (!Array.isArray(list)) return readFailed("list", UNREADABLE_LIST);
    const latest = list.length === 0 ? undefined : parseConversation(list[0]);
    if (list.length > 0 && latest === undefined) return readFailed("list", UNREADABLE_LIST);
    if (latest === undefined) return settle(undefined, undefined, []);
    const same = shown?.conversationId === latest.conversationId;
    if (same && shown?.revision === latest.revision) return settle(shown, anchorTurnId, turns);

    const tail = await readThreadTail(request, {
      conversationId: latest.conversationId,
      projectId: latest.projectId,
      anchorTurnId: same ? anchorTurnId : undefined
    });
    if (asked !== generation) return;
    if (!tail.ok) return readFailed("thread", tail);
    if (tail.value.missing) return settle(undefined, undefined, []);
    // An incomplete read leaves the revision unknown, so the next one carries on.
    settle({ ...latest, revision: tail.value.complete ? latest.revision : undefined }, tail.value.anchorTurnId, tail.value.turns);
  }

  function settle(next: Shown | undefined, nextAnchor: string | undefined, nextTurns: readonly CoreTurn[]): void {
    shown = next;
    anchorTurnId = nextAnchor;
    turns = nextTurns;
    loaded = true;
    clearReadFailure();
    const pending = new Set(nextTurns.flatMap((turn) => (turn.ask?.status === "pending" ? [turn.ask.askId] : [])));
    for (const askId of [...answerErrors.keys()]) if (!pending.has(askId)) answerErrors.delete(askId);
  }

  function readable(): boolean {
    return connected && fallback === undefined;
  }

  const controller: ConversationController = {
    setTarget(next) {
      const same = sameThread(next, target);
      target = next;
      if (same) return;
      generation += 1;
      shown = undefined;
      anchorTurnId = undefined;
      turns = [];
      loaded = false;
      clearReadFailure();
      sendError = undefined;
      answerErrors.clear();
      onChange();
      void controller.refresh();
    },
    state() {
      const mode: ConversationMode = fallback !== undefined ? "fallback"
        : !connected ? "offline"
          : turns.length > 0 ? "thread"
            : loaded && readError === undefined ? "empty"
              : "loading";
      return {
        mode,
        fallbackReason: fallback,
        turns,
        conversationId: shown?.conversationId,
        readError,
        reading: inFlight !== undefined,
        sending,
        sendError,
        answering,
        answerErrors
      };
    },
    setConnected(next) {
      if (next === connected) return;
      connected = next;
      if (!next) {
        if (fallback === "refused") fallback = undefined;
        clearReadFailure();
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
        onChange();
      })();
      return inFlight;
    },
    retry() {
      cancelRetry?.();
      cancelRetry = undefined;
      retriesUsed = 0;
      const reading = controller.refresh();
      onChange();
      return reading;
    },
    async send(text) {
      const body = text.trim();
      if (body === "" || sending || !readable()) return false;
      sending = true;
      sendError = undefined;
      onChange();
      const asked = generation;
      const result = await request<{ payload?: { conversation?: unknown } }>(threadSendRequest(target, shown, body));
      sending = false;
      if (asked !== generation) {
        // The person moved to another thread meanwhile; the message went to the one it was written in.
        if (!result.ok) failed(result, SEND_FAILED, () => undefined);
        onChange();
        return result.ok;
      }
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
