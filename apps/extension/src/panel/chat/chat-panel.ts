// The automation chat: FluxIQ Core's conversation and FluxIQ's live activity
// in one window, laid out like a chat app's. It fills the height it is given:
//
//   header    one quiet line: connection dot, FluxIQ, the paced status
//             headline, and the on-page status control
//   stream    the scrolling conversation. The person's turns are bubbles on
//             the right; FluxIQ's are full-width formatted text with the work
//             that led to each folded above it ("Worked for 2m · 46 steps");
//             while FluxIQ works, a live line at the end says what it is
//             doing, updated in place
//   composer  pinned at the bottom: a growing box and a round send button
//
// What is on screen comes from two owners and is merged only for display:
// the thread from `createConversationController` (Core's, read on a 4 s poll
// and 300 ms after an activity event that names a conversation or ends the
// work), and the activity from `createActivityFeed` (the background relay's,
// read on start and pushed after). Neither is written here. The header and
// the live line render the relay's paced `display` only; the folds read every
// event in `recent`.
//
// New content is followed only while the person is at the bottom; scrolled
// up, the view stays put and "Jump to latest" shows (`createScrollFollower`).
//
// Faces follow the controller's mode: `fallback` swaps the stream and
// composer for "Talk to FluxIQ in the FluxIQ window." and Open FluxIQ, while
// the header keeps showing live activity.

import { createElement } from "../dom";
import type { PanelStore } from "../state";
import type { ExtensionStatus } from "../../shared/protocol";
import { createComposer, createConversationController, type ConversationState, type CoreTurn } from "../simple/conversation";
import { createActivityFeed, listenToRuntime, threadRefreshWanted } from "./feed";
import { chatHeaderModel, createChatHeader } from "./header";
import { buildChatStream, buildChatThread, createTurnClock } from "./stream";
import { createScrollFollower, createThreadView, liveLineModel, type TurnControls } from "./view";
import "./chat.css";

const THREAD_POLL_MS = 4_000;
const THREAD_REFRESH_DEBOUNCE_MS = 300;

const EMPTY_LINES: Readonly<Record<ConversationState["mode"], string>> = {
  empty: "Describe what you want done, in your own words. FluxIQ builds it and shows its work here.",
  offline: "Connect to FluxIQ to start a conversation.",
  loading: "Loading the conversation...",
  thread: "",
  fallback: ""
};

/** The mounted chat. */
export type ChatPanel = {
  readonly element: HTMLElement;
  render(status: ExtensionStatus): void;
  /** Starts or stops reading the thread and the activity; starting reads both at once. */
  setActive(active: boolean): void;
  /** Puts the caret in the composer. */
  focusComposer(): void;
};

/** An Open FluxIQ control. */
export type OpenFluxIQControl = { readonly element: HTMLElement; observe(status: ExtensionStatus): void };

/**
 * Makes an Open FluxIQ control. The simple view passes its own
 * (`simple/open-fluxiq-button.ts`), so the chat does not reach into it.
 */
export type OpenFluxIQFactory = (style: { label: string; look: "small" | "link" }) => OpenFluxIQControl;

/**
 * Creates the chat, talking to the background through `request`.
 * `onConversation` hears whether the thread has turns, each time that changes.
 */
export function createChatPanel(
  request: PanelStore["request"],
  openFluxIQ: OpenFluxIQFactory,
  onConversation: (hasTurns: boolean) => void = () => undefined
): ChatPanel {
  const controller = createConversationController(request, () => renderAll());
  const feed = createActivityFeed({ request, listen: listenToRuntime }, () => onFeedChange());
  const header = createChatHeader((overlay) => void feed.setOverlay(overlay));
  const clock = createTurnClock();

  const thread = createThreadView(() => follower.recheck());
  const emptyLine = createElement("p", { className: "chat-empty-line" });
  const empty = createElement("div", { className: "chat-empty", hidden: true }, [
    createElement("p", { className: "chat-empty-title", text: "What can FluxIQ do for you?" }),
    emptyLine
  ]);
  const readNotice = createElement("p", { className: "notice", hidden: true, attrs: { role: "status" } });
  const column = createElement("div", { className: "chat-column" }, [empty, thread.element, readNotice]);
  const scroller = createElement("div", { className: "chat-scroll" }, [column]);
  const jump = createElement("button", {
    className: "chat-jump",
    hidden: true,
    attrs: { type: "button", "aria-label": "Jump to latest", title: "Jump to latest" }
  }, ["↓"]);
  const follower = createScrollFollower(scroller, (show) => (jump.hidden = !show));
  jump.addEventListener("click", () => follower.followNow());
  const composer = createComposer((text) => {
    follower.followNow();
    return controller.send(text);
  });
  const main = createElement("div", { className: "chat-main" }, [scroller, jump]);
  const dock = createElement("div", { className: "chat-dock" }, [composer.element]);
  const fallbackOpen = openFluxIQ({ label: "Open FluxIQ", look: "small" });
  const fallback = createElement("div", { className: "chat-fallback", hidden: true }, [
    createElement("p", { className: "card-line", text: "Talk to FluxIQ in the FluxIQ window." }),
    fallbackOpen.element
  ]);
  const element = createElement("section", { className: "simple-conversation chat-panel", attrs: { "aria-label": "Conversation" } }, [
    header.element,
    main,
    dock,
    fallback
  ]);

  // Open FluxIQ links inside turns, kept only while their turn is on screen.
  let turnOpeners: OpenFluxIQControl[] = [];
  let latestStatus: ExtensionStatus | undefined;
  let connected = false;
  let historyTaken = false;
  let hadTurns: boolean | undefined;
  let seen: ReadonlySet<string> | undefined;
  let active = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  let debounce: ReturnType<typeof setTimeout> | undefined;

  function onFeedChange(): void {
    const decision = threadRefreshWanted(seen, feed.snapshot().state);
    seen = decision.seen;
    if (decision.refresh) scheduleThreadRefresh();
    renderAll();
  }

  function scheduleThreadRefresh(): void {
    if (debounce !== undefined || !active) return;
    debounce = setTimeout(() => {
      debounce = undefined;
      void controller.refresh();
    }, THREAD_REFRESH_DEBOUNCE_MS);
  }

  function renderAll(): void {
    const state = controller.state();
    const snapshot = feed.snapshot();
    const display = snapshot.state.display ?? null;
    header.render(chatHeaderModel(snapshot, connected));
    const fallbackShown = state.mode === "fallback";
    if (fallback.hidden === fallbackShown) fallback.hidden = !fallbackShown;
    if (main.hidden !== fallbackShown) main.hidden = fallbackShown;
    if (dock.hidden !== fallbackShown) dock.hidden = fallbackShown;
    readNotice.textContent = state.readError ?? "";
    readNotice.hidden = state.readError === undefined;
    composer.render(state);

    // The first read's turns are history: they sort before every activity row.
    const stamped = clock.stamp(state.turns, historyTaken ? Date.now() : Number.NEGATIVE_INFINITY);
    if (state.mode === "thread" || state.mode === "empty") historyTaken = true;
    const chat = buildChatThread(buildChatStream(stamped, snapshot.state.recent), display?.working === true);
    const anything = thread.render(chat, liveLineModel(display, state.sending), (turn) => turnControls(turn, state));
    if (emptyLine.textContent !== EMPTY_LINES[state.mode]) emptyLine.textContent = EMPTY_LINES[state.mode];
    empty.hidden = anything || EMPTY_LINES[state.mode] === "";
    turnOpeners = turnOpeners.filter((opener) => opener.element.isConnected);
    follower.contentChanged();

    const hasTurns = state.turns.length > 0;
    if (hasTurns !== hadTurns) {
      hadTurns = hasTurns;
      onConversation(hasTurns);
    }
    // Only an unsupported background is for good; a refused token can come back after pairing again.
    if (state.fallbackReason === "unsupported") stopTimer();
  }

  function turnControls(turn: CoreTurn, state: ConversationState): TurnControls {
    const askId = turn.ask?.askId;
    const answering = askId !== undefined && state.answering.has(askId);
    const error = askId === undefined ? undefined : state.answerErrors.get(askId);
    return {
      state: `${answering}|${error ?? ""}`,
      ask: {
        answering,
        error,
        answer: (kind, value) => {
          if (askId !== undefined) void controller.answer(askId, kind, value);
        },
        openFluxIQ: () => {
          const made = openFluxIQ({ label: "Open FluxIQ", look: "link" });
          if (latestStatus !== undefined) made.observe(latestStatus);
          turnOpeners.push(made);
          return made.element;
        }
      }
    };
  }

  function stopTimer(): void {
    if (timer !== undefined) clearInterval(timer);
    timer = undefined;
  }

  renderAll();

  return {
    element,
    render(status) {
      latestStatus = status;
      fallbackOpen.observe(status);
      for (const opener of turnOpeners) opener.observe(status);
      const next = status.connectionState === "connected";
      const changed = next !== connected;
      connected = next;
      controller.setConnected(next);
      if (changed) renderAll();
    },
    setActive(next) {
      if (next === active) return;
      active = next;
      stopTimer();
      if (debounce !== undefined) clearTimeout(debounce);
      debounce = undefined;
      if (!next) {
        feed.stop();
        return;
      }
      feed.start();
      void feed.read();
      void controller.refresh();
      timer = setInterval(() => {
        if (document.visibilityState !== "visible") return;
        void controller.refresh();
        // A worker restart fails a read; the next tick asks again.
        if (feed.snapshot().reach === "failed") void feed.read();
      }, THREAD_POLL_MS);
    },
    focusComposer() {
      composer.focus();
    }
  };
}
