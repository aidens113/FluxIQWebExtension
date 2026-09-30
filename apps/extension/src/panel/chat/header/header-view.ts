// The chat's status header: the phase chip, Core's status sentence, the step,
// the live/offline dot, and the on-page status control (Full, Small, Off).
// Renders a `ChatHeaderModel`; text goes in through `textContent` only.

import type { ActivityOverlayPreference } from "../../../shared/activity/index";
import { createElement } from "../../dom";
import type { ChatHeaderModel } from "./header-model";

/** The mounted header. */
export type ChatHeader = {
  readonly element: HTMLElement;
  render(model: ChatHeaderModel): void;
};

/** Creates the header; `chooseOverlay` is called when the person picks an overlay option. */
export function createChatHeader(chooseOverlay: (overlay: ActivityOverlayPreference) => void): ChatHeader {
  const chip = createElement("span", { className: "chat-phase" });
  const dot = createElement("span", { className: "dot", attrs: { "aria-hidden": "true" } });
  const liveText = createElement("span", { className: "chat-live-text" });
  const live = createElement("span", { className: "chat-live" }, [dot, liveText]);
  const label = createElement("p", { className: "chat-label", attrs: { "aria-live": "polite" } });
  const step = createElement("p", { className: "chat-step", hidden: true });
  const buttons = new Map<ActivityOverlayPreference, HTMLButtonElement>();
  const control = createElement("div", { className: "chat-overlay", attrs: { role: "group", "aria-label": "Status on the page" } }, [
    createElement("span", { className: "chat-overlay-title", text: "On page" })
  ]);
  const overlayNotice = createElement("p", { className: "notice", hidden: true, attrs: { role: "status" } });
  const element = createElement("header", { className: "chat-header" }, [
    createElement("div", { className: "chat-header-row" }, [chip, live]),
    label,
    step,
    control,
    overlayNotice
  ]);

  function button(value: ActivityOverlayPreference, text: string): HTMLButtonElement {
    const existing = buttons.get(value);
    if (existing) return existing;
    const made = createElement("button", { className: "chat-overlay-option", text, attrs: { type: "button", "data-overlay": value } });
    made.addEventListener("click", () => chooseOverlay(value));
    buttons.set(value, made);
    control.append(made);
    return made;
  }

  return {
    element,
    render(model) {
      chip.textContent = model.phaseLabel;
      chip.dataset.tone = model.tone;
      chip.dataset.phase = model.phase;
      dot.className = model.live ? "dot dot-green" : "dot";
      liveText.textContent = model.live ? "Live" : "Offline";
      live.title = model.liveLabel;
      live.setAttribute("aria-label", model.liveLabel);
      label.textContent = model.label;
      step.textContent = model.step ?? "";
      step.hidden = model.step === undefined;
      for (const option of model.overlay.options) {
        const made = button(option.value, option.label);
        made.disabled = model.overlay.disabled;
        made.setAttribute("aria-pressed", option.selected ? "true" : "false");
      }
      overlayNotice.textContent = model.overlay.error ?? "";
      overlayNotice.hidden = model.overlay.error === undefined;
    }
  };
}
