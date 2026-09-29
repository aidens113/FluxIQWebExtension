// The header's Simple / Advanced control: a radiogroup named "View" (UI audit,
// section 4, "Switching"), with arrow, Home and End keys moving the choice.

import { createElement } from "../dom";

type Mode = "simple" | "advanced";

/** The control's element, and a way to reflect the current mode without firing `onSelect`. */
export type ModeSwitch = { readonly element: HTMLElement; set(mode: Mode): void };

/** Creates the switch; `onSelect` fires when the viewer picks a mode. */
export function createModeSwitch(onSelect: (mode: Mode) => void): ModeSwitch {
  const options: Array<{ mode: Mode; button: HTMLButtonElement }> = (["simple", "advanced"] as const).map((mode) => ({
    mode,
    button: createElement("button", {
      className: "mode-option",
      text: mode === "simple" ? "Simple" : "Advanced",
      attrs: { type: "button", role: "radio", "data-mode": mode }
    })
  }));
  const element = createElement("div", { className: "mode-switch", attrs: { role: "radiogroup", "aria-label": "View" } }, options.map((option) => option.button));

  function set(mode: Mode): void {
    for (const option of options) {
      const selected = option.mode === mode;
      option.button.setAttribute("aria-checked", String(selected));
      option.button.tabIndex = selected ? 0 : -1;
      option.button.classList.toggle("active", selected);
    }
  }

  options.forEach((option, index) => {
    option.button.addEventListener("click", () => onSelect(option.mode));
    option.button.addEventListener("keydown", (event) => {
      const next = event.key === "ArrowRight" || event.key === "ArrowDown" ? (index + 1) % options.length
        : event.key === "ArrowLeft" || event.key === "ArrowUp" ? (index - 1 + options.length) % options.length
          : event.key === "Home" ? 0
            : event.key === "End" ? options.length - 1
              : undefined;
      if (next === undefined) return;
      event.preventDefault();
      const target = options[next]!;
      target.button.focus();
      onSelect(target.mode);
    });
  });

  set("simple");
  return { element, set };
}
