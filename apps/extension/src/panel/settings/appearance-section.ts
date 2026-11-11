// Appearance: Theme, Dark (default), Light or System. Applies at once and is stored per browser
// (`panel/theme-choice`); it is not part of Save, which stores FluxIQ's settings.

import { createElement } from "../dom";
import { applyThemeChoice, readThemeChoice, saveThemeChoice, type ThemeChoice } from "../theme-choice";

const CHOICES: readonly { readonly value: ThemeChoice; readonly label: string }[] = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
  { value: "system", label: "System" }
];

/** Builds the Appearance group; it shows the stored choice as soon as it is read. */
export function createAppearanceSection(): HTMLElement {
  const radios = CHOICES.map(({ value, label }) => {
    const input = createElement("input", { id: `theme-${value}`, attrs: { type: "radio", name: "theme", value } }) as HTMLInputElement;
    input.addEventListener("change", () => {
      if (!input.checked) return;
      applyThemeChoice(value);
      saveThemeChoice(value);
    });
    return { value, input, label: createElement("label", { className: "theme-choice" }, [input, createElement("span", { text: label })]) };
  });
  const check = (choice: ThemeChoice): void => {
    for (const { value, input } of radios) input.checked = value === choice;
  };
  check("dark");
  void readThemeChoice().then(check);
  return createElement("section", { className: "settings-group", attrs: { "aria-label": "Appearance" } }, [
    createElement("h3", { className: "settings-group-title", text: "Appearance" }),
    createElement("div", { className: "theme-choices", attrs: { role: "radiogroup", "aria-label": "Theme" } }, radios.map(({ label }) => label)),
    createElement("p", { className: "field-hint", text: "Dark is the default. System follows your device." })
  ]);
}
