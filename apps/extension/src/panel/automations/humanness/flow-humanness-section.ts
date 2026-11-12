// The open Flow's own humanness on its strip, folded behind a small "Humanness · 40"
// button so the strip stays slim, like a task's on its answer card. It reads the Flow's
// level when the strip first shows the Flow, and again each time it is opened, so a level
// changed elsewhere is not shown stale. The person's starting value comes from the latest
// status each time one arrives, so a change in Settings shows on a control already open.
// It stays hidden where this extension cannot carry the read at all (`unsupported`); a
// read that failed otherwise says so inside, in the background's words.

import { createHumannessControl, type ChatResult, type HumannessControl, type HumannessLevel } from "@fluxiq/ui-components";
// The control's own sheet (`controls/humanness/humanness.css`) comes with the chat's, after the panel's tokens (`theme/tokens.css`).
import "@fluxiq/ui-components/styles/chat.css";
import type { ExtensionStatus } from "../../../shared/protocol";
// From its own directory, not the ports barrel, whose results port leads back to the automations.
import { startingHumanness } from "../../chat/transport/ports/task-settings";
import { createElement } from "../../dom";
import type { FlowHumannessPort } from "./flow-humanness-port";

/** The section on the strip. */
export type FlowHumannessSection = {
  readonly element: HTMLElement;
  /** Shows `flowId`'s humanness, reading it the first time this Flow is shown; undefined puts it away. */
  show(flowId: string | undefined): void;
  /** Takes the person's starting value from the latest status. */
  render(status: ExtensionStatus): void;
};

let made = 0;

async function asked(call: () => Promise<ChatResult<{ humanness?: number }>>): Promise<ChatResult<{ humanness?: number }>> {
  try {
    return await call();
  } catch {
    return { ok: false, sentence: "Something went wrong. Try again." };
  }
}

/** Creates the section over `port`. */
export function createFlowHumannessSection(port: FlowHumannessPort): FlowHumannessSection {
  const id = `fluxiq-flow-humanness-${++made}`;
  let flowId: string | undefined;
  let control: HumannessControl | undefined;
  let open = false;
  let starting = 0;
  // Which read is the latest, so an older reply changes nothing.
  let reading = 0;
  const toggle = createElement("button", { className: "small-button flow-humanness-toggle", text: "Humanness", attrs: { type: "button", "aria-expanded": "false", "aria-controls": id } });
  const problem = createElement("p", { className: "flow-humanness-problem", hidden: true, attrs: { role: "alert" } });
  const panel = createElement("div", { id, className: "flow-humanness-panel", hidden: true }, [problem]);
  const element = createElement("div", { className: "flow-humanness", hidden: true }, [toggle, panel]);

  /** "Humanness · N": the level the Flow runs at, as saved. */
  function label(level: HumannessLevel): void {
    toggle.textContent = `Humanness · ${level.own ?? level.starting}`;
  }

  function putAway(): void {
    control?.dispose();
    control?.element.remove();
    control = undefined;
    reading += 1;
    open = false;
    panel.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
    problem.hidden = true;
    problem.textContent = "";
    element.hidden = true;
  }

  function settle(answer: ChatResult<{ humanness?: number }>, about: string): void {
    if (answer.ok) {
      const level: HumannessLevel = answer.value.humanness === undefined ? { starting } : { own: answer.value.humanness, starting };
      problem.hidden = true;
      problem.textContent = "";
      if (control === undefined) {
        control = createHumannessControl({
          level,
          label: "Humanness for this Flow",
          commit: (humanness) => port.set(about, humanness),
          onLevel: label
        });
        panel.append(control.element);
      } else {
        control.show(level);
      }
      // A read while a change is on its way is not shown, so the label says what the control holds.
      label(control.level());
      element.hidden = false;
      return;
    }
    if (answer.unsupported === true && control === undefined) {
      element.hidden = true;
      return;
    }
    problem.textContent = `I could not read this Flow's humanness. ${answer.sentence}`;
    problem.hidden = false;
    element.hidden = false;
  }

  async function read(): Promise<void> {
    const about = flowId;
    if (about === undefined) return;
    const mine = ++reading;
    const answer = await asked(() => port.read(about));
    if (mine !== reading || about !== flowId) return;
    settle(answer, about);
  }

  toggle.addEventListener("click", () => {
    open = !open;
    panel.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    if (open) void read();
  });

  return {
    element,
    show(next) {
      if (next === flowId) return;
      // Another Flow, or none: its own control, so no level of the last one is sent for it.
      putAway();
      flowId = next;
      void read();
    },
    render(status) {
      const next = startingHumanness(status);
      if (next === starting) return;
      starting = next;
      if (control === undefined) return;
      const saved = control.level();
      // Ignored by the control while the person's own change is waiting or on its way.
      control.show(saved.own === undefined ? { starting } : { own: saved.own, starting });
      label(control.level());
    }
  };
}
