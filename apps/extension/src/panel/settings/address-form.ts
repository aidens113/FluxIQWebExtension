// The settings screen's connection form: two addresses and four switches, each with its
// hint. The hint sits outside the label and is linked by `aria-describedby`, so
// a field's accessible name is exactly its label -- the name the Lab fills.
//
// A switch Core's recording-capture policy forbids is disabled, shows the
// reason as its hint, and reads and fills as off (`allow`, `toggle-view.ts`).

import type { ExtensionCaptureAllowed, FluxIQSettings } from "../../shared/protocol";
import { createElement } from "../dom";
import { SETTING_FIELDS, type AddressKey } from "./form-fields";
import { toggleView } from "./toggle-view";

/** The form, a way to read and fill it, and to point at the field that stopped a save. */
export type SettingsForm = {
  readonly element: HTMLElement;
  read(): FluxIQSettings;
  fill(settings: FluxIQSettings): void;
  /** Applies what Core's policy allows; undefined is Core's default. A switch it forbids turns off. */
  allow(allowed: ExtensionCaptureAllowed | undefined): void;
  /** Marks `field` as the one to fix and focuses it; undefined clears every mark. */
  markInvalid(field: AddressKey | undefined): void;
  /** Calls `listener` on every edit the viewer makes. */
  onEdit(listener: () => void): void;
};

/** Builds the form, empty until `fill` is called. */
export function createSettingsForm(): SettingsForm {
  const addresses = SETTING_FIELDS.addresses.map((field) => ({
    field,
    input: createElement("input", {
      id: field.id,
      attrs: { type: "url", spellcheck: "false", autocomplete: "off", "aria-describedby": `${field.id}Hint` }
    })
  }));
  const toggles = SETTING_FIELDS.toggles.map((field) => ({
    field,
    input: createElement("input", { id: field.id, attrs: { type: "checkbox", "aria-describedby": `${field.id}Hint`, ...(field.disabled ? { disabled: "" } : {}) } }),
    hint: createElement("p", { id: `${field.id}Hint`, className: "field-hint", text: field.hint })
  }));
  // Whether each switch is forbidden now; starts as Core's default lists it.
  const forbiddenNow = new Map(toggles.map(({ field }) => [field.key, field.disabled === true]));

  const element = createElement("div", { className: "settings-form" }, [
    ...addresses.map(({ field, input }) => createElement("div", { className: "field" }, [
      createElement("label", { text: field.label, attrs: { for: field.id } }),
      input,
      createElement("p", { id: `${field.id}Hint`, className: "field-hint", text: field.hint })
    ])),
    createElement("div", { className: "toggles" }, toggles.map(({ field, input, hint }) => createElement("div", { className: "toggle" }, [
      createElement("label", {}, [input, createElement("span", { text: field.label })]),
      hint
    ])))
  ]);

  return {
    element,
    read() {
      const values = {} as FluxIQSettings;
      for (const { field, input } of addresses) values[field.key] = input.value;
      for (const { field, input } of toggles) values[field.key] = forbiddenNow.get(field.key) ? false : input.checked;
      return values;
    },
    fill(settings) {
      for (const { field, input } of addresses) input.value = settings[field.key];
      for (const { field, input } of toggles) input.checked = forbiddenNow.get(field.key) ? false : settings[field.key];
    },
    allow(allowed) {
      for (const { field, input, hint } of toggles) {
        const view = toggleView(field, allowed);
        forbiddenNow.set(field.key, view.disabled);
        input.disabled = view.disabled;
        if (view.disabled) {
          input.setAttribute("disabled", "");
          input.checked = false;
        } else input.removeAttribute("disabled");
        if (hint.textContent !== view.hint) hint.textContent = view.hint;
      }
    },
    markInvalid(invalid) {
      for (const { field, input } of addresses) {
        if (field.key === invalid) {
          input.setAttribute("aria-invalid", "true");
          input.focus();
        } else {
          input.removeAttribute("aria-invalid");
        }
      }
    },
    onEdit(listener) {
      for (const { input } of [...addresses, ...toggles]) {
        input.addEventListener("input", listener);
        input.addEventListener("change", listener);
      }
    }
  };
}
