// The chat's message list: every turn, every stand-alone fold of work, and
// the live line last. Reconciled, never rebuilt: each turn, fold and the
// live line keep their element for as long as they exist, and move only when
// they are out of place (`placeChildren`), so nothing on screen flickers,
// loses focus or closes while pushes and polls arrive.

import { createElement } from "../../dom";
import type { AskControlsContext, CoreTurn } from "../../simple/conversation";
import type { ChatThread, WorkGroup } from "../stream";
import { createLiveLine } from "./live-line";
import type { LiveLineModel } from "./live-line-model";
import { createMessageView, type MessageView } from "./message-view";
import { placeChildren } from "./place-children";
import { createWorkDisclosure, type WorkDisclosure } from "./work-disclosure";

/** What a turn's controls are given, and what makes them change. */
export type TurnControls = { ask: AskControlsContext; state: string };

/** The mounted list. */
export type ThreadView = {
  readonly element: HTMLElement;
  /** Shows `thread`, and `live` as the live line (null hides it). Answers whether anything shows. */
  render(thread: ChatThread, live: LiveLineModel | null, controls: (turn: CoreTurn) => TurnControls): boolean;
};

/** Creates the list; `onToggle` hears the person open or close a fold. */
export function createThreadView(onToggle: () => void): ThreadView {
  const liveLine = createLiveLine();
  const element = createElement("ol", { className: "chat-stream", attrs: { "aria-label": "Conversation with FluxIQ" } }, [liveLine.element]);
  const messages = new Map<string, MessageView>();
  const folds = new Map<string, WorkDisclosure>();
  const standing = new Map<string, HTMLElement>();

  function fold(group: WorkGroup, working: boolean, seen: Set<string>): HTMLElement {
    seen.add(group.key);
    let made = folds.get(group.key);
    if (made === undefined) {
      made = createWorkDisclosure(onToggle);
      folds.set(group.key, made);
    }
    made.update(group, working);
    return made.element;
  }

  return {
    element,
    render(thread, live, controls) {
      const seenFolds = new Set<string>();
      const seenEntries = new Set<string>();
      const nodes = thread.entries.map((entry) => {
        seenEntries.add(entry.key);
        if (entry.kind === "work") {
          let holder = standing.get(entry.key);
          if (holder === undefined) {
            holder = createElement("li", { className: "chat-entry chat-work-entry" });
            standing.set(entry.key, holder);
          }
          placeChildren(holder, [fold(entry.group, false, seenFolds)]);
          return holder;
        }
        let view = messages.get(entry.key);
        if (view === undefined) {
          view = createMessageView(entry.turn.author);
          messages.set(entry.key, view);
        }
        const given = controls(entry.turn);
        view.update(entry.turn, signature(entry.turn, given.state), given.ask);
        placeChildren(view.workSlot, entry.work.map((group) => fold(group, false, seenFolds)));
        return view.element;
      });
      liveLine.update(live);
      placeChildren(liveLine.workSlot, live === null ? [] : thread.live.map((group) => fold(group, true, seenFolds)));
      placeChildren(element, [...nodes, liveLine.element]);
      for (const key of [...messages.keys()]) if (!seenEntries.has(key)) messages.delete(key);
      for (const key of [...standing.keys()]) if (!seenEntries.has(key)) standing.delete(key);
      for (const key of [...folds.keys()]) if (!seenFolds.has(key)) folds.delete(key);
      return nodes.length > 0 || live !== null;
    }
  };
}

// A turn looks the same while what Core said in it, its question, and the
// state of its answer do; a re-read that parsed a new but equal object keeps it.
function signature(turn: CoreTurn, state: string): string {
  return [turn.text, JSON.stringify(turn.ask), turn.attachment ? "1" : "0", state].join("\u0000");
}
