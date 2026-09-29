// One turn of the thread: the speaker in bold, "You" or "FluxIQ", then the
// words (UI audit, section 4, "3. Conversation card"). An attachment is not
// rendered here -- the extension shows no diffs or graphs -- but named, with a
// way to open it in FluxIQ. A question shows its answer controls.

import { createElement } from "../../dom";
import { askControls, type AskControlsContext } from "./ask-controls";
import type { CoreTurn } from "./core-thread";

/** The turn's element. `ask` is used only when the turn carries a question. */
export function turnElement(turn: CoreTurn, ask: AskControlsContext): HTMLElement {
  const speaker = turn.author === "person" ? "You" : "FluxIQ";
  const children: HTMLElement[] = [
    createElement("p", { className: "turn-text" }, [createElement("strong", { text: `${speaker}: ` }), turn.text])
  ];
  if (turn.attachment) {
    const open = ask.openFluxIQ();
    children.push(createElement("p", { className: "turn-note" }, ["FluxIQ attached something: ", open]));
  }
  if (turn.ask !== null) children.push(askControls(turn.ask, ask));
  return createElement("li", { className: "turn", attrs: { "data-author": turn.author === "person" ? "person" : "fluxiq" } }, children);
}
