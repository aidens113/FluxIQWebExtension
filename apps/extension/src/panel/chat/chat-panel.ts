// The automation chat: FluxIQ Core's conversation and FluxIQ's live activity
// in one window (plan D6: it replaces Simple Mode's conversation card).
//
//   header    phase chip, status sentence, step, live dot, on-page control
//   stream    thread turns and activity rows by time; a row with detail
//             expands; a question's answer controls sit under its turn
//   composer  typed instructions, sent through `panelConversationSend`
//
// What is on screen comes from two owners and is merged only for display:
// the thread from `createConversationController` (Core's, read on a 4 s poll
// and 300 ms after an activity event that names a conversation or ends the
// work), and the activity from `createActivityFeed` (the background relay's,
// read on start and pushed after). Neither is written here.
//
// The stream is reconciled rather than rebuilt: an element whose turn or row
// did not change is kept where it is, so an answer being typed, its focus and
// an expanded row survive every push and poll.
//
// Faces follow the controller's mode, as the card did: `fallback` swaps the
// stream and composer for "Talk to FluxIQ in the FluxIQ window." and Open
// FluxIQ, while the header keeps showing live activity.

import { createElement } from "../dom";
import type { PanelStore } from "../state";
import type { ExtensionStatus } from "../../shared/protocol";
import { createComposer, createConversationController, turnElement, type ConversationState, type CoreTurn } from "../simple/conversation";
import { createActivityFeed, listenToRuntime, threadRefreshWanted } from "./feed";
import { chatHeaderModel, createChatHeader } from "./header";
import { activityRowElement, buildChatStream, createTurnClock, type ActivityRow, type ChatStreamItem } from "./stream";
import "./chat.css";

const THREAD_POLL_MS = 4_000;
const THREAD_REFRESH_DEBOUNCE_MS = 300;

/** The mounted chat. */
export type ChatPanel = {
  readonly element: HTMLElement;
  render(status: ExtensionStatus): void;
  /** Starts or stops reading the thread and the activity; starting reads both at once. */
  setActive(active: boolean): void;
};

/**
 * Makes an Open FluxIQ control. The simple view passes its own
 * (`simple/open-fluxiq-button.ts`), so the chat does not reach into it.
 */
export type OpenFluxIQFactory = (style: { label: string; look: "small" | "link" }) => {
  readonly element: HTMLElement;
  observe(status: ExtensionStatus): void;
};

type Rendered = { element: HTMLElement; signature: unknown; extra: string };

/** Creates the chat, talking to the background through `request`. */
export function createChatPanel(request: PanelStore["request"], openFluxIQ: OpenFluxIQFactory): ChatPanel {
  const controller = createConversationController(request, () => renderAll());
  const feed = createActivityFeed({ request, listen: listenToRuntime }, () => onFeedChange());
  const header = createChatHeader((overlay) => void feed.setOverlay(overlay));
  const clock = createTurnClock();
  const smallOpen = () => openFluxIQ({ label: "open it in FluxIQ", look: "link" }).element;

  const list = createElement("ol", { className: "chat-stream", attrs: { "aria-label": "Conversation with FluxIQ" } });
  const empty = createElement("p", { className: "card-line", text: "No conversation yet. Ask FluxIQ to do something to start one.", hidden: true });
  const readNotice = createElement("p", { className: "notice", hidden: true, attrs: { role: "status" } });
  const composer = createComposer((text) => controller.send(text));
  const footer = openFluxIQ({ label: "Open the full conversation in FluxIQ", look: "link" });
  const body = createElement("div", { className: "chat-body" }, [list, empty, readNotice, composer.element, footer.element]);
  const fallbackOpen = openFluxIQ({ label: "Open FluxIQ", look: "small" });
  const fallback = createElement("div", { className: "chat-fallback", hidden: true }, [
    createElement("p", { className: "card-line", text: "Talk to FluxIQ in the FluxIQ window." }),
    fallbackOpen.element
  ]);
  const element = createElement("section", { className: "card simple-conversation chat-panel", attrs: { "aria-label": "Conversation" } }, [
    header.element,
    body,
    fallback
  ]);

  const rendered = new Map<string, Rendered>();
  const openRows = new Set<string>();
  let connected = false;
  let historyTaken = false;
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
    header.render(chatHeaderModel(snapshot, connected));
    fallback.hidden = state.mode !== "fallback";
    body.hidden = state.mode === "fallback";
    readNotice.textContent = state.readError ?? "";
    readNotice.hidden = state.readError === undefined;
    composer.render(state);
    // The first read's turns are history: they sort before every activity row.
    const stamped = clock.stamp(state.turns, historyTaken ? Date.now() : Number.NEGATIVE_INFINITY);
    if (state.mode === "thread" || state.mode === "empty") historyTaken = true;
    const items = buildChatStream(stamped, snapshot.state.recent);
    empty.hidden = !(state.mode === "empty" && items.length === 0);
    renderStream(items, state);
    // Only an unsupported background is for good; a refused token can come back after pairing again.
    if (state.fallbackReason === "unsupported") stopTimer();
  }

  function renderStream(items: ChatStreamItem[], state: ConversationState): void {
    const nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 24;
    const first = list.childElementCount === 0;
    const wanted = items.map((item) => (item.kind === "turn" ? turnItem(item.key, item.turn, state) : rowItem(item.key, item.row)));
    const keys = new Set(items.map((item) => item.key));
    for (const key of [...rendered.keys()]) if (!keys.has(key)) rendered.delete(key);
    for (const key of [...openRows]) if (!keys.has(key)) openRows.delete(key);
    // Move only what is out of place, so a focused answer box is never detached.
    wanted.forEach((node, index) => {
      if (list.children[index] !== node) list.insertBefore(node, list.children[index] ?? null);
    });
    while (list.childElementCount > wanted.length) list.lastElementChild?.remove();
    list.hidden = wanted.length === 0;
    if (first || nearBottom) list.scrollTop = list.scrollHeight;
  }

  function turnItem(key: string, turn: CoreTurn, state: ConversationState): HTMLElement {
    const askId = turn.ask?.askId;
    const extra = askId === undefined ? "" : `${state.answering.has(askId)}|${state.answerErrors.get(askId) ?? ""}`;
    return reuse(key, turn, extra, () => turnElement(turn, {
      answering: askId !== undefined && state.answering.has(askId),
      error: askId === undefined ? undefined : state.answerErrors.get(askId),
      answer: (kind, value) => {
        if (askId !== undefined) void controller.answer(askId, kind, value);
      },
      openFluxIQ: smallOpen
    }));
  }

  function rowItem(key: string, row: ActivityRow): HTMLElement {
    const extra = `${row.sequence}|${row.status ?? ""}|${row.text ?? ""}`;
    return reuse(key, null, extra, () => activityRowElement(row, openRows.has(key), (open) => {
      if (open) openRows.add(key);
      else openRows.delete(key);
    }));
  }

  // A turn is the same while Core's parsed object is (the controller keeps it
  // across reads that found nothing new); a row while its last event is.
  function reuse(key: string, signature: unknown, extra: string, make: () => HTMLElement): HTMLElement {
    const known = rendered.get(key);
    if (known && known.signature === signature && known.extra === extra) return known.element;
    const made = { element: make(), signature, extra };
    rendered.set(key, made);
    return made.element;
  }

  function stopTimer(): void {
    if (timer !== undefined) clearInterval(timer);
    timer = undefined;
  }

  renderAll();

  return {
    element,
    render(status) {
      footer.observe(status);
      fallbackOpen.observe(status);
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
    }
  };
}
