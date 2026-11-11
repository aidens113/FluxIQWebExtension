// The Humanness slider: 0 is the fastest, higher adds human-like timing, click positions and
// occasional harmless misclicks. Read and filled like a form field; `onEdit` fires on input.

import { createElement } from "../../dom";
import { HUMANNESS_LIMITS } from "./limits";
import { normaliseHumanness } from "./normalise-humanness";

export type HumannessControl = {
  readonly element: HTMLElement;
  read(): number;
  fill(value: number): void;
  onEdit(listener: () => void): void;
};

export function createHumannessControl(): HumannessControl {
  const input = createElement("input", {
    id: "humanness",
    className: "humanness-slider",
    attrs: { type: "range", min: String(HUMANNESS_LIMITS.min), max: String(HUMANNESS_LIMITS.max), step: String(HUMANNESS_LIMITS.step), value: String(HUMANNESS_LIMITS.default), "aria-describedby": "humannessHint", "aria-valuetext": "0" }
  }) as HTMLInputElement;
  const readout = createElement("output", { id: "humannessValue", className: "humanness-value", text: String(HUMANNESS_LIMITS.default), attrs: { for: "humanness" } });
  const show = (): void => {
    const value = String(normaliseHumanness(input.value));
    readout.textContent = value;
    input.setAttribute("aria-valuetext", value);
  };
  input.addEventListener("input", show);
  const element = createElement("div", { className: "field humanness" }, [
    createElement("div", { className: "humanness-head" }, [createElement("label", { text: "Humanness", attrs: { for: "humanness" } }), readout]),
    input,
    createElement("div", { className: "humanness-ends", attrs: { "aria-hidden": "true" } }, [createElement("span", { text: "Fastest" }), createElement("span", { text: "Most human-like" })]),
    createElement("p", { id: "humannessHint", className: "field-hint", text: "0 is the fastest. Higher adds human-like timing, click positions and occasional harmless misclicks, for sites that limit robots. Robot checks always pause for you." })
  ]);
  return {
    element,
    read: () => normaliseHumanness(input.value),
    fill(value) {
      input.value = String(normaliseHumanness(value));
      show();
    },
    onEdit(listener) {
      input.addEventListener("input", listener);
      input.addEventListener("change", listener);
    }
  };
}
