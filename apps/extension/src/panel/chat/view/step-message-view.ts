// One of FluxIQ's step messages, the way it reads in the chat: on FluxIQ's
// side of the conversation, what it decided in bold and why after a dash,
// then each action that led to as a card (`action-card-view.ts`).
//
//   **Clicking “Get a free quote”** — The quote form is behind this button,
//   so I'm opening it.
//   [( icon ) Click · Get a free quote / Done]
//
// A message that is an action itself (an action with no reason before it, a
// check, a question to the person, a run's step) is only its card; a note,
// or anything with no card, is only its words.
//
// While the unit of work is under way or waiting, its newest card says
// "Working on it" or "Waiting for you", and so does any card still waiting on
// the person: only Core's row that settles a wait ends it, so a note or a
// step after the question does not quiet it.
//
// The element lives as long as the message, and each card's element as long
// as its card: a render changes only the words and marks that changed, and
// adds a new card after the others, so nothing remounts, reorders or flickers
// while actions start and end. Text goes in through `textContent` only.

import { createElement } from "../../dom";
import type { StepMessage } from "../stream";
import { createActionCardView, type ActionCardView } from "./action-card-view";
import { placeChildren } from "./place-children";

/** The mounted message. */
export type StepMessageView = {
  readonly element: HTMLElement;
  /** Shows `message`; `current` is true while its unit of work is under way or waiting on the person. */
  update(message: StepMessage, current: boolean): void;
};

/** Messages whose words are shown beside their cards: the reasoning, not the act. */
const SPOKEN: ReadonlySet<StepMessage["kind"]> = new Set<StepMessage["kind"]>(["decision", "repair", "note"]);

/** Creates an empty message. */
export function createStepMessageView(): StepMessageView {
  const title = createElement("strong", { className: "chat-step-title" });
  const text = createElement("span", { className: "chat-step-text" });
  const line = createElement("p", { className: "chat-step-line" }, [title, text]);
  const cards = createElement("div", { className: "chat-cards", hidden: true });
  const element = createElement("li", { className: "chat-entry chat-step-msg" }, [line, cards]);
  const views = new Map<string, ActionCardView>();

  return {
    element,
    update(message, current) {
      setAttr(element, "data-kind", message.kind);
      const spoken = SPOKEN.has(message.kind) || message.actions.length === 0;
      if (line.hidden === spoken) line.hidden = !spoken;
      setText(title, message.title);
      const reason = message.text !== undefined && message.text !== message.title ? ` — ${message.text}` : "";
      setText(text, reason);
      if (text.hidden !== (reason === "")) text.hidden = reason === "";

      const last = message.actions.length - 1;
      const shown = message.actions.map((card, index) => {
        let view = views.get(card.key);
        if (view === undefined) {
          view = createActionCardView();
          views.set(card.key, view);
        }
        // A card waiting on the person waits until Core settles it, wherever it
        // sits; any other card is the action of the moment only as the newest.
        view.update(card, current && (card.outcome === "waiting" || (message.latest && index === last)));
        return view.element;
      });
      const keys = new Set(message.actions.map((card) => card.key));
      for (const key of [...views.keys()]) if (!keys.has(key)) views.delete(key);
      placeChildren(cards, shown);
      if (cards.hidden !== (shown.length === 0)) cards.hidden = shown.length === 0;
    }
  };
}

function setText(node: HTMLElement, value: string): void {
  if (node.textContent !== value) node.textContent = value;
}

function setAttr(node: HTMLElement, name: string, value: string): void {
  if (node.getAttribute(name) !== value) node.setAttribute(name, value);
}
