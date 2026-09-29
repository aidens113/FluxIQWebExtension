// The conversation card: FluxIQ Core's conversation, shown and fed, never
// owned (UI audit, section 4, "3. Conversation card"). What it knows and asks
// for is `createConversationController`; this file renders it.
//
// Faces, by `ConversationState.mode`:
//   thread       the last turns (about three visible, the rest scroll inside)
//   empty        "No conversation yet. Ask FluxIQ to do something to start one."
//   loading      nothing yet, or only the read error
//   offline      what was on screen, with the composer disabled
//   fallback     the whole card is "Talk to FluxIQ in the FluxIQ window." and
//                Open FluxIQ: this extension's background does not relay the
//                conversation, or FluxIQ refused this browser's token, so the
//                card falls back instead of failing
//
// The thread is read on a timer while the card is shown and the page is
// visible (`setActive`), and not at all otherwise.

import type { ExtensionStatus } from "../../../shared/protocol";
import { createElement } from "../../dom";
import type { PanelStore } from "../../state";
import { createOpenFluxIQButton } from "../open-fluxiq-button";
import { createComposer } from "./composer";
import { createConversationController, type ConversationState } from "./controller";
import { turnElement } from "./turn";

/** How often the thread is re-read while the card is visible. */
export const CONVERSATION_REFRESH_MS = 4_000;

/** The mounted conversation card. */
export type ConversationCard = {
  readonly element: HTMLElement;
  render(status: ExtensionStatus): void;
  /** Starts or stops reading the thread; starting reads it at once. */
  setActive(active: boolean): void;
};

/** Creates the conversation card, talking to FluxIQ through `request`. */
export function createConversationCard(request: PanelStore["request"]): ConversationCard {
  const controller = createConversationController(request, () => renderState());
  const smallOpen = () => createOpenFluxIQButton(request, { label: "open it in FluxIQ", look: "link" }).element;

  const list = createElement("ol", { className: "turns", attrs: { "aria-label": "Conversation with FluxIQ" } });
  const empty = createElement("p", { className: "card-line", text: "No conversation yet. Ask FluxIQ to do something to start one.", hidden: true });
  const readNotice = createElement("p", { className: "notice", hidden: true, attrs: { role: "status" } });
  const composer = createComposer((text) => controller.send(text));
  const footer = createOpenFluxIQButton(request, { label: "Open the full conversation in FluxIQ", look: "link" });
  const live = createElement("div", { className: "conversation-live" }, [list, empty, readNotice, composer.element, footer.element]);

  const fallbackOpen = createOpenFluxIQButton(request, { label: "Open FluxIQ", look: "small" });
  const fallback = createElement("div", { className: "conversation-fallback", hidden: true }, [
    createElement("p", { className: "card-line", text: "Talk to FluxIQ in the FluxIQ window." }),
    fallbackOpen.element
  ]);
  const element = createElement("section", { className: "card simple-conversation", attrs: { "aria-label": "Conversation" } }, [live, fallback]);

  let renderedTurns: ConversationState["turns"] | undefined;
  let renderedAsks = "";
  let active = false;
  let timer: ReturnType<typeof setInterval> | undefined;

  function renderState(): void {
    const state = controller.state();
    fallback.hidden = state.mode !== "fallback";
    live.hidden = state.mode === "fallback";
    empty.hidden = state.mode !== "empty";
    readNotice.textContent = state.readError ?? "";
    readNotice.hidden = state.readError === undefined;
    composer.render(state);
    renderTurns(state);
    // Only an unsupported background is for good; a refused token can come back after pairing again.
    if (state.fallbackReason === "unsupported") stopTimer();
  }

  // Turns are rebuilt only when Core's answer or an answer in flight changed,
  // so a poll that found nothing new never resets an answer being typed.
  function renderTurns(state: ConversationState): void {
    const asks = `${[...state.answering].join(",")}|${[...state.answerErrors].map(([id, error]) => `${id}=${error}`).join(",")}`;
    if (state.turns === renderedTurns && asks === renderedAsks) return;
    const nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 24;
    const first = renderedTurns === undefined || renderedTurns.length === 0;
    renderedTurns = state.turns;
    renderedAsks = asks;
    list.replaceChildren(...state.turns.map((turn) => turnElement(turn, {
      answering: turn.ask !== null && state.answering.has(turn.ask.askId),
      error: turn.ask === null ? undefined : state.answerErrors.get(turn.ask.askId),
      answer: (kind, value) => {
        if (turn.ask !== null) void controller.answer(turn.ask.askId, kind, value);
      },
      openFluxIQ: smallOpen
    })));
    list.hidden = state.turns.length === 0;
    if (first || nearBottom) list.scrollTop = list.scrollHeight;
  }

  function stopTimer(): void {
    if (timer !== undefined) clearInterval(timer);
    timer = undefined;
  }

  renderState();

  return {
    element,
    render(status) {
      footer.observe(status);
      fallbackOpen.observe(status);
      controller.setConnected(status.connectionState === "connected");
    },
    setActive(next) {
      if (next === active) return;
      active = next;
      stopTimer();
      if (!next) return;
      void controller.refresh();
      timer = setInterval(() => {
        if (document.visibilityState === "visible") void controller.refresh();
      }, CONVERSATION_REFRESH_MS);
    }
  };
}
