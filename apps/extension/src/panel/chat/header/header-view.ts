// The chat's one quiet header line: the connection dot, "FluxIQ", the paced
// status headline, and the on-page status control (Full, Small, Off).
//
// Built once and updated in place: every render writes only what changed, to
// the same nodes, so a status that moves does not remount anything, and the
// line keeps its height (the headline is one ellipsized line), so nothing
// below it shifts. Text goes in through `textContent` only.

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
  const dot = createElement("span", { className: "chat-conn", attrs: { role: "img" } });
  const status = createElement("span", { className: "chat-status", attrs: { "aria-live": "polite" } });
  const buttons = new Map<ActivityOverlayPreference, HTMLButtonElement>();
  const control = createElement("div", { className: "chat-overlay", attrs: { role: "group", "aria-label": "Status on the page", title: "Status on the page" } }, [
    createElement("span", { className: "chat-overlay-title", text: "Page", attrs: { "aria-hidden": "true" } })
  ]);
  const overlayNotice = createElement("p", { className: "notice chat-header-notice", hidden: true, attrs: { role: "status" } });
  const line = createElement("div", { className: "chat-header-line" }, [
    dot,
    createElement("span", { className: "chat-name", text: "FluxIQ" }),
    status,
    control
  ]);
  const element = createElement("header", { className: "chat-header" }, [line, overlayNotice]);

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
      setAttr(dot, "data-live", model.live ? "true" : "false");
      setAttr(dot, "aria-label", model.liveLabel);
      setAttr(dot, "title", model.liveLabel);
      setText(status, model.status);
      setAttr(status, "data-tone", model.tone);
      setAttr(status, "data-working", model.working ? "true" : "false");
      setAttr(status, "title", model.status);
      for (const option of model.overlay.options) {
        const made = button(option.value, option.label);
        if (made.disabled !== model.overlay.disabled) made.disabled = model.overlay.disabled;
        setAttr(made, "aria-pressed", option.selected ? "true" : "false");
      }
      setText(overlayNotice, model.overlay.error ?? "");
      if (overlayNotice.hidden !== (model.overlay.error === undefined)) overlayNotice.hidden = model.overlay.error === undefined;
    }
  };
}

function setText(node: HTMLElement, text: string): void {
  if (node.textContent !== text) node.textContent = text;
}

function setAttr(node: HTMLElement, name: string, value: string): void {
  if (node.getAttribute(name) !== value) node.setAttribute(name, value);
}
