// One of FluxIQ's step messages, the way it reads in the chat: what it is
// doing in bold and why after a dash, on FluxIQ's side of the conversation,
// with a quiet line beneath saying how the action went.
//
//   **Clicking “Get a free quote”** — The quote form is behind this button,
//   so I'm opening it.
//   ✓ Done
//
// The element lives as long as the message. A render changes only the words
// and marks that changed, so a message never remounts or flickers while its
// action starts and ends. Text goes in through `textContent` only.

import { createElement } from "../../dom";
import { outcomeWords, type StepMessage } from "../stream";

/** The mounted message. */
export type StepMessageView = {
  readonly element: HTMLElement;
  /** Shows `message`; `working` is true while its unit of work runs. */
  update(message: StepMessage, working: boolean): void;
};

const MARKS: Readonly<Record<string, string>> = { succeeded: "✓", failed: "✕", working: "" };

/** Creates an empty message. */
export function createStepMessageView(): StepMessageView {
  const title = createElement("strong", { className: "chat-step-title" });
  const text = createElement("span", { className: "chat-step-text" });
  const mark = createElement("span", { className: "chat-step-mark", attrs: { "aria-hidden": "true" } });
  const outcomeLabel = createElement("span", { className: "chat-step-outcome-label" });
  const outcome = createElement("p", { className: "chat-step-outcome", hidden: true }, [mark, outcomeLabel]);
  const line = createElement("p", { className: "chat-step-line" }, [title, text]);
  const element = createElement("li", { className: "chat-entry chat-step-msg" }, [line, outcome]);

  return {
    element,
    update(message, working) {
      setAttr(element, "data-kind", message.kind);
      setText(title, message.title);
      const reason = message.text !== undefined && message.text !== message.title ? ` — ${message.text}` : "";
      setText(text, reason);
      if (text.hidden !== (reason === "")) text.hidden = reason === "";
      const said = outcomeWords(message, working);
      if (outcome.hidden !== (said === null)) outcome.hidden = said === null;
      setAttr(element, "data-outcome", said?.state ?? "none");
      if (said === null) return;
      setAttr(outcome, "data-state", said.state);
      setText(mark, MARKS[said.state] ?? "");
      setText(outcomeLabel, said.label);
    }
  };
}

function setText(node: HTMLElement, value: string): void {
  if (node.textContent !== value) node.textContent = value;
}

function setAttr(node: HTMLElement, name: string, value: string): void {
  if (node.getAttribute(name) !== value) node.setAttribute(name, value);
}
