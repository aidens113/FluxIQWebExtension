// The empty chat, centred in the stream: a title, one line, and example
// prompts as quiet buttons that fill the composer when chosen. Built once;
// the examples are rebuilt only when the set of them changes.

import { createElement } from "../../dom";
import type { EmptyStateModel } from "./empty-state-model";
import { placeChildren } from "./place-children";

/** The mounted empty state. */
export type EmptyState = {
  readonly element: HTMLElement;
  /** Shows `model`, or hides when it is null or `covered` (something else is on screen). */
  update(model: EmptyStateModel | null, covered: boolean): void;
};

/** Creates it; `choose` receives an example the person picked. */
export function createEmptyState(choose: (text: string) => void): EmptyState {
  const title = createElement("p", { className: "chat-empty-title" });
  const line = createElement("p", { className: "chat-empty-line" });
  const examples = createElement("div", { className: "chat-examples", attrs: { role: "list", "aria-label": "Examples" } });
  const element = createElement("div", { className: "chat-empty", hidden: true }, [title, line, examples]);
  let shownExamples = "";
  return {
    element,
    update(model, covered) {
      const hidden = model === null || covered;
      if (element.hidden !== hidden) element.hidden = hidden;
      if (model === null) return;
      if (title.textContent !== model.title) title.textContent = model.title;
      if (title.hidden !== (model.title === "")) title.hidden = model.title === "";
      if (line.textContent !== model.line) line.textContent = model.line;
      const signature = model.examples.join("\u0000");
      if (signature === shownExamples) return;
      shownExamples = signature;
      placeChildren(examples, model.examples.map((text) => {
        const button = createElement("button", { className: "chat-example", text, attrs: { type: "button", role: "listitem" } });
        button.addEventListener("click", () => choose(text));
        return button;
      }));
    }
  };
}
