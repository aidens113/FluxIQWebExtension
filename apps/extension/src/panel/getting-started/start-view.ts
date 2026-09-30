// The getting-started screen: plain numbered steps with their buttons, drawn
// from `startGuide`, in place of the chat until the browser is connected.
//
// Ids and names the Lab and older journeys use are kept: `#connectButton`
// ("Connect", "Try again", "Try now") and `#pairingReferenceCode` (the
// "Approval code"). A failed Connect or Cancel stays on screen until its cause
// is gone or the person presses again.

import { RUNTIME_MESSAGES } from "../../shared/constants";
import type { ExtensionStatus } from "../../shared/protocol";
import { createElement } from "../dom";
import { createOpenFluxIQButton } from "../open-fluxiq";
import type { PanelContext } from "../shell";
import { createStickyError } from "../state";
import type { StartGuide, StartStep } from "./start-steps";
import "./getting-started.css";

/** The mounted screen. */
export type StartView = { readonly element: HTMLElement; render(guide: StartGuide, status: ExtensionStatus | undefined): void };

const MARKS: Readonly<Record<StartStep["key"], string>> = { open: "1", connect: "2", approve: "3" };
const STATE_WORDS: Readonly<Record<StartStep["state"], string>> = { done: "Done", current: "Next", waiting: "In progress", problem: "Needs attention", todo: "To do" };

/** Builds the screen; `openSettings` opens settings (the connection address). */
export function createStartView(context: PanelContext, openSettings: () => void): StartView {
  const { store } = context;
  const error = createStickyError<ExtensionStatus>();
  const title = createElement("h2", { className: "start-title" });
  const line = createElement("p", { className: "start-line" });
  const open = createOpenFluxIQButton(store.request, { label: "Open FluxIQ", look: "small" });
  const connectButton = createElement("button", { id: "connectButton", className: "primary-button", text: "Connect", attrs: { type: "button" } });
  const addressLink = createElement("button", { className: "link-button", text: "Check the connection address", attrs: { type: "button" } });
  const code = createElement("p", { id: "pairingReferenceCode", className: "pairing-code", attrs: { "aria-label": "Approval code" } });
  const approveOpen = createOpenFluxIQButton(store.request, { label: "Open FluxIQ", look: "primary" });
  const cancelPairing = createElement("button", { className: "small-button", text: "Cancel", attrs: { type: "button" } });
  const notice = createElement("p", { className: "notice", hidden: true, attrs: { role: "status" } });

  const actions: Readonly<Record<StartStep["key"], HTMLElement>> = {
    open: createElement("div", { className: "start-actions" }, [open.element]),
    connect: createElement("div", { className: "start-actions" }, [connectButton, addressLink]),
    approve: createElement("div", { className: "start-approve" }, [code, createElement("div", { className: "start-actions" }, [approveOpen.element, cancelPairing])])
  };
  const rows = (["open", "connect", "approve"] as const).map((key) => {
    const mark = createElement("span", { className: "start-mark", text: MARKS[key], attrs: { "aria-hidden": "true" } });
    const name = createElement("strong", { className: "start-step-title" });
    const state = createElement("span", { className: "start-state" });
    const text = createElement("p", { className: "start-step-line" });
    const item = createElement("li", { className: "start-step" }, [
      mark,
      createElement("div", { className: "start-step-body" }, [createElement("div", { className: "start-step-head" }, [name, state]), text, actions[key]])
    ]);
    return { key, item, mark, name, state, text };
  });
  const list = createElement("ol", { className: "start-steps", attrs: { "aria-label": "Steps" } }, rows.map((row) => row.item));
  const element = createElement("section", { className: "start-screen", hidden: true, attrs: { "aria-label": "Get started", "aria-live": "polite" } }, [
    createElement("div", { className: "start-column" }, [
      createElement("div", { className: "start-brand", text: "F", attrs: { "aria-hidden": "true" } }),
      title,
      line,
      list,
      notice
    ])
  ]);

  connectButton.addEventListener("click", () => void press(connectButton.dataset.action === "disconnect" ? "disconnect" : "connect"));
  cancelPairing.addEventListener("click", () => void press("disconnect"));
  addressLink.addEventListener("click", openSettings);

  async function press(action: "connect" | "disconnect"): Promise<void> {
    error.clear();
    drawNotice();
    connectButton.disabled = true;
    cancelPairing.disabled = true;
    const result = await store.request({ type: action === "connect" ? RUNTIME_MESSAGES.connect : RUNTIME_MESSAGES.disconnect });
    connectButton.disabled = false;
    cancelPairing.disabled = false;
    if (!result.ok) error.show(result.sentence, (status) => status.connectionState === (action === "connect" ? "connected" : "disconnected"), result.detail);
    drawNotice();
  }

  function drawNotice(): void {
    const shown = error.current();
    notice.textContent = shown?.sentence ?? "";
    notice.title = shown?.detail ?? "";
    notice.hidden = shown === undefined;
  }

  return {
    element,
    render(guide, status) {
      title.textContent = guide.heading;
      line.textContent = guide.line;
      list.hidden = guide.steps.length === 0;
      for (const row of rows) {
        const step = guide.steps.find((candidate) => candidate.key === row.key);
        row.item.hidden = step === undefined;
        if (step === undefined) continue;
        row.item.dataset.state = step.state;
        row.mark.textContent = step.state === "done" ? "✓" : MARKS[row.key];
        row.name.textContent = step.title;
        row.state.textContent = STATE_WORDS[step.state];
        row.text.textContent = step.line ?? "";
        row.text.hidden = step.line === undefined;
      }
      actions.open.hidden = rows[0]!.item.dataset.state === "done";
      connectButton.hidden = guide.connect === undefined;
      connectButton.textContent = guide.connect?.label ?? "Connect";
      connectButton.dataset.action = guide.connect?.action ?? "connect";
      connectButton.className = guide.connect?.action === "disconnect" ? "small-button" : "primary-button";
      addressLink.hidden = !guide.addressLink;
      actions.connect.hidden = connectButton.hidden && addressLink.hidden;
      actions.approve.hidden = guide.pairingCode === undefined;
      code.textContent = guide.pairingCode ?? "";
      if (status !== undefined) {
        open.observe(status);
        approveOpen.observe(status);
        if (error.observe(status)) drawNotice();
      }
    }
  };
}
