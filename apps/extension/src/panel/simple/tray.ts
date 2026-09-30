// The tray: Simple Mode's cards that are not the conversation -- the ways in
// (describe, record, extract) and the recent automations -- folded into one
// line above the chat, so the chat keeps most of the panel.
//
// It starts open while there is no conversation yet, like a chat app's home
// screen, and folds once the thread has turns. The moment the person opens or
// folds it themselves, that choice wins and is remembered for this viewer
// (`localStorage`, a per-viewer convenience; storage that is refused only
// costs the memory).

import { createElement } from "../dom";

/** The mounted tray. */
export type SimpleTray = {
  readonly element: HTMLElement;
  /** Tells the tray whether the conversation has turns. */
  conversationChanged(hasTurns: boolean): void;
};

const TRAY_KEY = "fluxiq.ui.simpleTray";

/** Folds `cards` under one summary line. */
export function createSimpleTray(cards: readonly HTMLElement[]): SimpleTray {
  const summary = createElement("summary", { className: "simple-tray-summary" }, [
    createElement("span", { className: "simple-tray-title", text: "Record, extract, automations" })
  ]);
  const element = createElement("details", { className: "simple-tray" }, [summary, createElement("div", { className: "simple-tray-body" }, cards)]);
  let remembered = readChoice();
  let applying = false;
  element.open = remembered ?? true;

  element.addEventListener("toggle", () => {
    if (applying) return;
    remembered = element.open;
    writeChoice(element.open);
  });

  return {
    element,
    conversationChanged(hasTurns) {
      if (remembered !== undefined) return;
      const open = !hasTurns;
      if (element.open === open) return;
      applying = true;
      element.open = open;
      // The toggle event is dispatched after this task; ignore that one.
      setTimeout(() => (applying = false), 0);
    }
  };
}

function readChoice(): boolean | undefined {
  try {
    const stored = globalThis.localStorage?.getItem(TRAY_KEY);
    return stored === "open" ? true : stored === "closed" ? false : undefined;
  } catch (error) {
    // Storage refused: nothing was remembered, so the tray follows the conversation.
    if (error instanceof DOMException) return undefined;
    throw error;
  }
}

function writeChoice(open: boolean): void {
  try {
    globalThis.localStorage?.setItem(TRAY_KEY, open ? "open" : "closed");
  } catch (error) {
    if (!(error instanceof DOMException)) throw error;
    /* best-effort: a refused store only means the tray forgets the choice next time */
  }
}
