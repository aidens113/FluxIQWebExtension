// The on-page status setting, ready for the panel's settings: a label, a
// short explanation and a Full / Small / Off choice. It reads and changes the
// preference through its own activity feed (the background relay owns the
// value), so it works wherever it is mounted, whether or not the chat is on
// screen. Built once and updated in place; text goes in through `textContent`
// only.

import type { ActivityOverlayPreference } from "../../../shared/activity/index";
import { createElement } from "../../dom";
import type { PanelStore } from "../../state";
import { createActivityFeed, listenToRuntime, type ActivityFeedDeps } from "../feed";
import { onPageStatusModel } from "./on-page-status-model";

/** The mounted setting. */
export type OnPageStatusSetting = {
  readonly element: HTMLElement;
  /** Starts reading the preference (and listening for changes to it), or stops. */
  setActive(active: boolean): void;
};

/** Creates the setting; `listen` defaults to the extension runtime's messages. */
export function createOnPageStatusSetting(request: PanelStore["request"], listen: ActivityFeedDeps["listen"] = listenToRuntime): OnPageStatusSetting {
  const feed = createActivityFeed({ request, listen }, () => render());
  const buttons = new Map<ActivityOverlayPreference, HTMLButtonElement>();
  const group = createElement("div", { className: "chat-setting-choice", attrs: { role: "group", "aria-label": "Status on the page" } });
  const notice = createElement("p", { className: "notice", hidden: true, attrs: { role: "status" } });
  const element = createElement("div", { className: "chat-setting" }, [
    createElement("div", { className: "chat-setting-copy" }, [
      createElement("p", { className: "chat-setting-title", text: "Status on the page" }),
      createElement("p", { className: "chat-setting-help", text: "How FluxIQ shows what it is doing on the website itself." })
    ]),
    group,
    notice
  ]);
  let active = false;

  function button(value: ActivityOverlayPreference, text: string): HTMLButtonElement {
    const existing = buttons.get(value);
    if (existing) return existing;
    const made = createElement("button", { className: "chat-setting-option", text, attrs: { type: "button", "data-overlay": value } });
    made.addEventListener("click", () => void feed.setOverlay(value));
    buttons.set(value, made);
    group.append(made);
    return made;
  }

  function render(): void {
    const model = onPageStatusModel(feed.snapshot());
    for (const option of model.options) {
      const made = button(option.value, option.label);
      if (made.disabled !== model.disabled) made.disabled = model.disabled;
      const pressed = option.selected ? "true" : "false";
      if (made.getAttribute("aria-pressed") !== pressed) made.setAttribute("aria-pressed", pressed);
    }
    const error = model.error ?? "";
    if (notice.textContent !== error) notice.textContent = error;
    if (notice.hidden !== (model.error === undefined)) notice.hidden = model.error === undefined;
  }

  render();
  return {
    element,
    setActive(next) {
      if (next === active) return;
      active = next;
      if (!next) {
        feed.stop();
        return;
      }
      feed.start();
      void feed.read();
    }
  };
}
