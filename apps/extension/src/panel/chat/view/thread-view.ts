// The chat's message list: every turn and every one of FluxIQ's step
// messages, in time order, and the live line last. Reconciled, never rebuilt:
// each turn, step message and the live line keep their element for as long
// as they exist, and move only when they are out of place (`placeChildren`),
// so nothing on screen flickers, loses focus or jumps while pushes and polls
// arrive. A step message is updated in place as its action starts and ends.

import { createElement } from "../../dom";
import type { AskControlsContext, CoreTurn } from "../conversation";
import type { ChatStream } from "../stream";
import { createLiveLine } from "./live-line";
import type { LiveLineModel } from "./live-line-model";
import { createMessageView, type MessageView } from "./message-view";
import { placeChildren } from "./place-children";
import { createStepMessageView, type StepMessageView } from "./step-message-view";

/** What a turn's controls are given, and what makes them change. */
export type TurnControls = { ask: AskControlsContext; state: string };

/** The mounted list. */
export type ThreadView = {
  readonly element: HTMLElement;
  /**
   * Shows `stream`, and `live` as the live line (null hides it). `working` is
   * the unit of work still running, if any, so only its newest action says it
   * is under way. Answers whether anything shows.
   */
  render(stream: ChatStream, live: LiveLineModel | null, controls: (turn: CoreTurn) => TurnControls, working?: string | null): boolean;
  /** Forgets every turn and step message, for a thread that replaces this one. */
  clear(): void;
};

/** Creates the list; `onLiveAction` hears the live line's button. */
export function createThreadView(onLiveAction: () => void = () => undefined): ThreadView {
  const liveLine = createLiveLine(onLiveAction);
  const element = createElement("ol", { className: "chat-stream", attrs: { "aria-label": "Conversation with FluxIQ" } }, [liveLine.element]);
  const turns = new Map<string, MessageView>();
  const steps = new Map<string, StepMessageView>();

  return {
    element,
    render(stream, live, controls, working = null) {
      const seen = new Set<string>();
      const nodes = stream.items.map((item) => {
        seen.add(item.key);
        if (item.kind === "step") {
          let view = steps.get(item.key);
          if (view === undefined) {
            view = createStepMessageView();
            steps.set(item.key, view);
          }
          view.update(item.message, working !== null && item.message.activityId === working);
          return view.element;
        }
        let view = turns.get(item.key);
        if (view === undefined) {
          view = createMessageView(item.turn.author);
          turns.set(item.key, view);
        }
        const given = controls(item.turn);
        view.update(item.turn, signature(item.turn, given.state), given.ask);
        return view.element;
      });
      liveLine.update(live);
      placeChildren(element, [...nodes, liveLine.element]);
      for (const key of [...turns.keys()]) if (!seen.has(key)) turns.delete(key);
      for (const key of [...steps.keys()]) if (!seen.has(key)) steps.delete(key);
      return nodes.length > 0 || live !== null;
    },
    clear() {
      turns.clear();
      steps.clear();
      liveLine.update(null);
      placeChildren(element, [liveLine.element]);
    }
  };
}

// A turn looks the same while what Core said in it, its question, and the
// state of its answer do; a re-read that parsed a new but equal object keeps it.
function signature(turn: CoreTurn, state: string): string {
  return [turn.text, JSON.stringify(turn.ask), turn.attachment ? "1" : "0", state].join("\u0000");
}
