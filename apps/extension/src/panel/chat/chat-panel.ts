// The chat: the extension's view of FluxIQ Core's conversation, the same
// thread FluxIQ's own chat shows, with FluxIQ's live activity in it. It fills
// the container the panel gives it; the panel's shell owns the top bar, the
// Open FluxIQ link and the settings, so the chat has no header:
//
//   context   a slim line naming the automation, only in an automation's chat,
//             with the way back to the latest chat
//   stream    the scrolling conversation. The person's turns are bubbles on
//             the right; FluxIQ's are full-width formatted text, with the work
//             that led to each folded above it ("Worked for 2m · 46 steps");
//             while FluxIQ works, a live line at the end says what it is
//             doing, updated in place
//   composer  pinned at the bottom: a growing box and a round send button
//
// Which thread (`open`): the latest -- the project's own open thread -- or one
// automation's thread. Sending goes to the thread on screen.
//
// What is on screen comes from two owners and is merged only for display:
// the thread from `createConversationController` (Core's, read on a 4 s poll
// and 300 ms after an activity event that names a conversation or ends the
// work), and the activity from `createActivityFeed` (the background relay's,
// read on start and pushed after). Neither is written here. The live line
// renders the relay's paced `display` only; the folds read every event in
// `recent`, less Core's internal reads, in words.
//
// A read that fails is retried quietly; only one that keeps failing shows the
// read notice, naming what failed, with a Retry (`conversation/read-notice.ts`).
//
// New content is followed only while the person is at the bottom; scrolled
// up, the view stays put and "Jump to latest" shows (`createScrollFollower`).
//
// `fallback` (a background without the conversation relays, or a FluxIQ that
// refuses this browser's token) swaps the stream and composer for "Talk to
// FluxIQ in the FluxIQ window."; the shell's Open FluxIQ is the way there.

import { createElement } from "../dom";
import type { PanelStore } from "../state";
import type { ExtensionStatus } from "../../shared/protocol";
import { createComposer, createConversationController, createReadNotice, type ConversationState, type CoreTurn } from "./conversation";
import { createActivityFeed, listenToRuntime, threadRefreshWanted } from "./feed";
import { activityForTarget, buildChatStream, buildChatThread, createTurnClock } from "./stream";
import type { ChatTarget } from "./target";
import {
  createContextLine,
  createEmptyState,
  createScrollFollower,
  createThreadView,
  emptyStateModel,
  liveLineModel,
  type TurnControls
} from "./view";
import "./chat.css";

const THREAD_POLL_MS = 4_000;
const THREAD_REFRESH_DEBOUNCE_MS = 300;

/** The mounted chat. */
export type ChatPanel = {
  readonly element: HTMLElement;
  render(status: ExtensionStatus): void;
  /** Starts or stops reading the thread and the activity; starting reads both at once. */
  setActive(active: boolean): void;
  /** Puts the caret in the composer. */
  focusComposer(): void;
  /** Shows `target`'s thread; what the person sends from then on goes there. */
  open(target: ChatTarget): void;
  /** The thread shown now. */
  target(): ChatTarget;
  /** Hears every change of target, including the person's own "Latest chat". Answers an unsubscribe. */
  onTargetChange(listener: (target: ChatTarget) => void): () => void;
};

/** An Open FluxIQ control. */
export type OpenFluxIQControl = { readonly element: HTMLElement; observe(status: ExtensionStatus): void };

/**
 * Makes an Open FluxIQ control, for a question or an attachment that only
 * FluxIQ can show. The panel passes its own (`panel/open-fluxiq/`), so the
 * chat does not reach into it.
 */
export type OpenFluxIQFactory = (style: { label: string; look: "small" | "link" }) => OpenFluxIQControl;

/** How the panel mounts the chat. */
export type ChatPanelOptions = {
  /** Hears whether the thread has turns, each time that changes. */
  onConversation?: (hasTurns: boolean) => void;
  /**
   * Whether the chat shows its own line naming the automation, with "Latest
   * chat" (default true). A panel that shows the open automation above the
   * chat itself passes false, so the name is not said twice.
   */
  contextLine?: boolean;
};

/** Creates the chat, talking to the background through `request`. */
export function createChatPanel(request: PanelStore["request"], openFluxIQ: OpenFluxIQFactory, options: ChatPanelOptions = {}): ChatPanel {
  const onConversation = options.onConversation ?? (() => undefined);
  const showContext = options.contextLine !== false;
  let shownTarget: ChatTarget = { kind: "latest" };
  const targetListeners = new Set<(target: ChatTarget) => void>();
  const controller = createConversationController(request, () => renderAll());
  const feed = createActivityFeed({ request, listen: listenToRuntime }, () => onFeedChange());
  let clock = createTurnClock();

  const context = createContextLine(() => open({ kind: "latest" }));
  const thread = createThreadView(() => follower.recheck());
  const empty = createEmptyState((text) => composer.fill(text));
  const readNotice = createReadNotice(() => void controller.retry());
  const column = createElement("div", { className: "chat-column" }, [empty.element, thread.element, readNotice.element]);
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
  const fallback = createElement("div", { className: "chat-fallback", hidden: true }, [
    createElement("p", { className: "chat-empty-title", text: "Talk to FluxIQ in the FluxIQ window." }),
    createElement("p", { className: "chat-empty-line", text: "This browser can't hold the conversation here. Open FluxIQ from the top of this panel." })
  ]);
  const element = createElement("section", { className: "chat-panel", attrs: { "aria-label": "Chat with FluxIQ" } }, [
    context.element,
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

  function open(next: ChatTarget): void {
    const same = next.kind === shownTarget.kind && (next.kind === "latest" || (shownTarget.kind === "automation" && next.flowId === shownTarget.flowId && next.name === shownTarget.name));
    if (same) return;
    const threadChanges = next.kind !== shownTarget.kind || next.kind === "latest" || (shownTarget.kind === "automation" && next.flowId !== shownTarget.flowId);
    shownTarget = next;
    if (threadChanges) {
      // Another thread: its first read is history again, and nothing of the last one stays.
      clock = createTurnClock();
      historyTaken = false;
      thread.clear();
    }
    context.update(next);
    composer.setPlaceholder(next.kind === "automation" ? `Message FluxIQ about ${next.name.trim() || "this automation"}` : "Message FluxIQ");
    controller.setTarget(next);
    follower.followNow();
    renderAll();
    for (const listener of [...targetListeners]) listener(next);
  }

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
    const activity = activityForTarget(feed.snapshot().state, shownTarget, state.conversationId);
    const fallbackShown = state.mode === "fallback";
    if (fallback.hidden === fallbackShown) fallback.hidden = !fallbackShown;
    if (main.hidden !== fallbackShown) main.hidden = fallbackShown;
    if (dock.hidden !== fallbackShown) dock.hidden = fallbackShown;
    readNotice.render(state);
    composer.render(state);

    // The first read's turns are history: they sort before every activity row.
    const stamped = clock.stamp(state.turns, historyTaken ? Date.now() : Number.NEGATIVE_INFINITY);
    if (state.mode === "thread" || state.mode === "empty") historyTaken = true;
    const chat = buildChatThread(buildChatStream(stamped, activity.recent), activity.display?.working === true);
    const anything = thread.render(chat, liveLineModel(activity.display, state.sending), (turn) => turnControls(turn, state));
    empty.update(emptyStateModel(state.mode, shownTarget), anything);
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

  context.update(shownTarget);
  if (!showContext) context.element.remove();
  renderAll();

  return {
    element,
    render(status) {
      latestStatus = status;
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
    },
    open,
    target() {
      return shownTarget;
    },
    onTargetChange(listener) {
      targetListeners.add(listener);
      return () => targetListeners.delete(listener);
    }
  };
}
