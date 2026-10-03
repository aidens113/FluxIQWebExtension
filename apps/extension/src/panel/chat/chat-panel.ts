// The chat: the extension's view of FluxIQ Core's conversation, the same
// thread FluxIQ's own chat shows, with FluxIQ's live activity in it. It fills
// the container the panel gives it; the panel's shell owns the top bar, the
// Open FluxIQ link and the settings, so the chat has no header:
//
//   context   a slim line naming the automation, only in an automation's chat,
//             with the way back to the latest chat
//   stream    the scrolling conversation. The person's turns are bubbles on
//             the right; FluxIQ's are full-width formatted text. Every step
//             of FluxIQ's work is its own message on FluxIQ's side, in order:
//             what it did and why ("**Clicking “Get a free quote”** — The
//             quote form is behind this button, so I'm opening it."), with a
//             quiet line saying how the action went. No folds, no counts.
//             While FluxIQ works, a live line at the end says what it is
//             doing now ("Thinking about the next step"), updated in place
//   composer  pinned at the bottom: a growing box and a round send button
//
// Which thread (`open`): the latest -- the project's own open thread -- or one
// automation's thread, or the thread a build or a run put its question in.
// Sending goes to the thread on screen.
//
// A question is never left where nobody sees it. Core asks in the thread of
// the work's own subject (a build in its Flow's, a run in its own), which is
// often not the thread on screen: a run started from the automations tab asks
// in a thread no chat shows. So while the paced display says the work waits
// for the person, every chat shows the waiting live line, and when the
// question is in another thread the line's one button, "Show the question",
// opens that thread here (`stream/ask-thread.ts`), where its Continue and
// Stop (or its other answers) are the thread's own ask controls, answered
// through the same relay as any other. "‹ Latest chat" goes back.
//
// What is on screen comes from two owners and is merged only for display:
// the thread from `createConversationController` (Core's, read on a 4 s poll
// and 300 ms after an activity event that names a conversation or ends the
// work), and the activity from `createActivityFeed` (the background relay's,
// read on start and pushed after). Neither is written here. The live line
// renders the relay's paced `display` only; the step messages come from the
// relay's `history`, which holds each recent unit of work whole, so a long
// build's first decisions are still there after it settles, placed by time
// among the thread's turns.
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
import { sameThread } from "./same-thread";
import { createChatOwnerContext, type ChatOwner } from "./owner-context";
import { activityForTarget, buildChatStream, createTurnClock, type QuestionTarget } from "./stream";
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
  /** Updates only the current automation's name, preserving the reading position. */
  updateAutomationName(automation: { readonly flowId: string; readonly name: string }): void;
  /** The thread shown now. */
  target(): ChatTarget;
  /** Hears every change of target, including the person's own "Latest chat". Answers an unsubscribe. */
  onTargetChange(listener: (target: ChatTarget) => void): () => void;
};

/** An Open FluxIQ control. */
export type OpenFluxIQControl = { readonly element: HTMLElement; observe(status: ExtensionStatus): void };

/**
 * Makes an Open FluxIQ control, for a question that only FluxIQ can show. The panel passes its own (`panel/open-fluxiq/`), so the
 * chat does not reach into it.
 */
export type OpenFluxIQFactory = (style: { label: string; look: "small" | "link"; canOpen?: () => boolean }) => OpenFluxIQControl;

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
  const owners = createChatOwnerContext(request);
  let owner = owners.capture();
  let controller = makeController(owner);
  let feed = makeFeed(owner);
  let clock = createTurnClock();
  let actionScope = {};
  let backScope = {};

  const context = createContextLine(() => undefined);
  // The thread holding the question the work waits on, while it is not the one on screen.
  let answerIn: QuestionTarget | null = null;
  let thread = createThreadView();
  let empty = createEmptyState(() => undefined);
  let readNotice = createReadNotice(() => undefined);
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
    if (!actionsAllowed()) return Promise.resolve(false);
    const destination = controller;
    follower.followNow();
    return destination.send(text);
  });
  const main = createElement("div", { className: "chat-main" }, [scroller, jump]);
  const dock = createElement("div", { className: "chat-dock" }, [composer.element]);
  const fallback = createElement("div", { className: "chat-fallback", hidden: true }, [
    createElement("p", { className: "chat-empty-title", text: "Talk to FluxIQ in the FluxIQ window." }),
    createElement("p", { className: "chat-empty-line", text: "This browser can't hold the conversation here. Open FluxIQ from the top of this panel." })
  ]);
  const element = createElement("section", { className: "chat-panel", attrs: { "aria-label": "Chat with FluxIQ", tabindex: "-1" } }, [
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
  let activationObserved = false;
  let replaced = false;
  let unsupported = false;
  let feedUnsupported = false;
  let questionKey = "";
  let timer: ReturnType<typeof setInterval> | undefined;
  let debounce: ReturnType<typeof setTimeout> | undefined;

  function actionsAllowed(): boolean { return owner.current() && (active || (!activationObserved && !replaced)); }
  function makeController(captured: ChatOwner) {
    return createConversationController(captured.request, () => { if (captured === owner && captured.current()) renderAll(); });
  }
  function makeFeed(captured: ChatOwner) {
    return createActivityFeed({ request: captured.request, listen: listenToRuntime }, () => { if (captured === owner && captured.current()) onFeedChange(); });
  }
  function refreshControls(renewBack = false): void {
    const scope = actionScope = {}, captured = owner, destination = controller;
    const eligible = () => captured === owner && captured.current() && actionScope === scope && actionsAllowed();
    if (renewBack) {
      const backLease = backScope = {};
      const oldBack = context.element.children[0]!;
      const back = createElement("button", { className: "chat-context-back", attrs: { type: "button", "aria-label": "Back to the latest chat", title: "Back to the latest chat" } });
      back.append(...Array.from(oldBack.childNodes));
      back.addEventListener("click", () => {
        if (captured !== owner || !captured.current() || backLease !== backScope || !actionsAllowed() || shownTarget.kind === "latest") return;
        const handoff = document.activeElement === back && navigationVisible(back) && document.hasFocus() && document.visibilityState === "visible";
        open({ kind: "latest" });
        if (!handoff || !document.hasFocus() || document.visibilityState !== "visible" || !navigationVisible(element)) return;
        const box = composer.element.querySelector<HTMLTextAreaElement>("#conversationInput");
        if (box && !box.disabled && navigationVisible(box)) composer.focus(); else element.focus({ preventScroll: true });
      });
      context.element.insertBefore(back, oldBack); oldBack.remove();
    }
    empty = createEmptyState((text) => { if (eligible()) composer.fill(text); });
    readNotice = createReadNotice(() => { if (eligible()) void destination.retry(); });
    thread = createThreadView(() => { if (eligible() && answerIn !== null) open(answerIn); });
    column.replaceChildren(empty.element, thread.element, readNotice.element);
  }
  function startReads(): void {
    if (!active || timer !== undefined) return;
    if (!feedUnsupported) { feed.start(); void feed.read(); }
    if (unsupported) return;
    void controller.refresh();
    const captured = owner, destination = controller, currentFeed = feed;
    const handle = timer = setInterval(() => {
      if (timer !== handle || captured !== owner || !captured.current() || document.visibilityState !== "visible" || !active) return;
      if (!unsupported) void destination.refresh();
      if (!feedUnsupported && currentFeed.snapshot().reach === "failed") void currentFeed.read();
    }, THREAD_POLL_MS);
  }
  function resetOwner(next: ChatOwner, initial: boolean): void {
    stopTimer(); if (debounce !== undefined) clearTimeout(debounce); debounce = undefined;
    feed.stop(); controller.setConnected(false);
    owner = next; replaced ||= !initial;
    controller = makeController(owner); feed = makeFeed(owner);
    shownTarget = { kind: "latest" }; answerIn = null; questionKey = "";
    clock = createTurnClock(); historyTaken = false; seen = undefined; turnOpeners = [];
    composer.setOwner(owner); composer.setPlaceholder("Message FluxIQ"); context.update(shownTarget); refreshControls(true);
    renderAll();
    if (!initial) for (const listener of [...targetListeners]) listener(shownTarget);
  }

  function open(next: ChatTarget, follow = true): void {
    if (sameTarget(next, shownTarget)) return;
    const threadChanges = !sameThread(next, shownTarget);
    shownTarget = next;
    if (threadChanges) {
      // Another thread: its first read is history again, and nothing of the last one stays.
      clock = createTurnClock();
      historyTaken = false;
      refreshControls();
    }
    context.update(next);
    composer.setPlaceholder(next.kind === "automation" ? `Message FluxIQ about ${next.name.trim() || "this automation"}` : "Message FluxIQ");
    controller.setTarget(next);
    if (follow) follower.followNow();
    renderAll();
    for (const listener of [...targetListeners]) listener(next);
  }

  function onFeedChange(): void {
    if (feed.snapshot().reach === "unsupported") feedUnsupported = true;
    const decision = threadRefreshWanted(seen, feed.snapshot().state);
    seen = decision.seen;
    if (decision.refresh) scheduleThreadRefresh();
    renderAll();
  }

  function scheduleThreadRefresh(): void {
    if (debounce !== undefined || !active) return;
    const captured = owner, destination = controller;
    const handle = debounce = setTimeout(() => {
      if (debounce !== handle || captured !== owner || !captured.current() || !active) return;
      debounce = undefined;
      void destination.refresh();
    }, THREAD_REFRESH_DEBOUNCE_MS);
  }

  function renderAll(): void {
    let state = controller.state();
    if (state.fallbackReason === "unsupported") unsupported = true;
    if (unsupported) state = { ...state, mode: connected ? "fallback" : "offline", fallbackReason: "unsupported" };
    const activity = activityForTarget(feed.snapshot().state, shownTarget, state.conversationId);
    answerIn = activity.answerIn;
    const nextQuestion = answerIn === null ? "" : JSON.stringify([answerIn.subjectKind, answerIn.subjectId, answerIn.activityId]);
    if (nextQuestion !== questionKey) { questionKey = nextQuestion; refreshControls(); }
    const fallbackShown = state.mode === "fallback";
    if (fallback.hidden === fallbackShown) fallback.hidden = !fallbackShown;
    if (main.hidden !== fallbackShown) main.hidden = fallbackShown;
    if (dock.hidden !== fallbackShown) dock.hidden = fallbackShown;
    readNotice.render(state);
    composer.render(state);

    // The first read's unstamped turns are history: they sort before every step message.
    const stamped = clock.stamp(state.turns, historyTaken ? Date.now() : Number.NEGATIVE_INFINITY);
    if (state.mode === "thread" || state.mode === "empty") historyTaken = true;
    // The unit of work of the moment: running, or waiting on the person, whose
    // newest action card says "Working on it", and whose cards Core has not
    // settled a wait for say "Waiting for you". Once the unit ends, a wait
    // Core never settled says nothing rather than claiming how it went.
    const display = activity.display;
    const working = display && (display.working || display.outcome === "waiting") ? display.activityId : null;
    const anything = thread.render(
      buildChatStream(stamped, activity.events),
      liveLineModel(activity.display, state.sending, answerIn !== null),
      (turn) => turnControls(turn, state),
      working
    );
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
    const captured = owner, scope = actionScope, destination = controller;
    const askSignature = JSON.stringify(turn.ask);
    const eligible = () => captured === owner && captured.current() && scope === actionScope && actionsAllowed()
      && destination.state().conversationId === state.conversationId
      && destination.state().turns.some((current) => current.turnId === turn.turnId && current.text === turn.text && JSON.stringify(current.ask) === askSignature);
    const askId = turn.ask?.askId;
    const answering = askId !== undefined && state.answering.has(askId);
    const error = askId === undefined ? undefined : state.answerErrors.get(askId);
    return {
      state: `${answering}|${error ?? ""}`,
      ask: {
        answering,
        error,
        answer: (kind, value) => {
          if (eligible() && askId !== undefined) void destination.answer(askId, kind, value);
        },
        openFluxIQ: () => {
          if (!eligible()) return createElement("span");
          const made: OpenFluxIQControl = openFluxIQ({ label: "Open FluxIQ", look: "link", canOpen: () => eligible() && made.element.isConnected });
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

  refreshControls(true); context.update(shownTarget);
  if (!showContext) context.element.remove();
  renderAll();

  return {
    element,
    render(status) {
      latestStatus = status;
      const next = status.connectionState === "connected";
      const changed = next !== connected;
      connected = next;
      const observation = owners.observe(status);
      if (observation.changed) resetOwner(owners.capture(), observation.initial);
      else composer.setOwner(owner);
      for (const opener of turnOpeners) opener.observe(status);
      controller.setConnected(next && actionsAllowed() && !unsupported);
      if (changed) renderAll();
      if (observation.changed || changed) startReads();
    },
    setActive(next) {
      const first = !activationObserved; activationObserved = true;
      if (next === active && !first) return;
      active = next;
      stopTimer();
      if (debounce !== undefined) clearTimeout(debounce);
      debounce = undefined;
      if (!next) {
        feed.stop();
        controller.setConnected(false);
        refreshControls(true); renderAll();
        return;
      }
      refreshControls(true); controller.setConnected(connected && !unsupported); renderAll(); startReads();
    },
    focusComposer() {
      composer.focus();
    },
    open,
    updateAutomationName(automation) {
      if (shownTarget.kind !== "automation" || shownTarget.flowId !== automation.flowId) return;
      open({ kind: "automation", ...automation }, false);
    },
    target() {
      return shownTarget;
    },
    onTargetChange(listener) {
      targetListeners.add(listener);
      return () => targetListeners.delete(listener);
    }
  };
}

/** True when `a` and `b` are the same target: the same thread, under the same name, about the same work. */
function sameTarget(a: ChatTarget, b: ChatTarget): boolean {
  if (!sameThread(a, b)) return false;
  if (a.kind === "automation" && b.kind === "automation") return a.name === b.name;
  if (a.kind === "question" && b.kind === "question") return a.activityId === b.activityId && a.title === b.title;
  return true;
}

function navigationVisible(element: HTMLElement): boolean {
  return element.isConnected && !element.closest("[hidden], [inert]") && element.getClientRects().length > 0;
}
