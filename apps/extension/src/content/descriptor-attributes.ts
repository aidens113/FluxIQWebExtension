// Every attribute the page wrote on an element, as the descriptor's
// `attributes` carries them (t200).
//
// The descriptor used to carry a 25-name allow-list, each value cut to 500
// characters. Whatever a page said about an element in any other attribute --
// a `data-state="open"`, an `aria-checked`, a `role` on a consent vendor's
// widget, a `srcdoc` -- never reached a reader, and nothing said it had been
// left out. Now every attribute travels, whole, keyed by its name in the order
// the page wrote them.
//
// What an attribute can hold of a control's contents follows the rule
// `readElementValue` follows (`describe-element.ts`). On a control that is, or
// sits inside, a sensitive one (`isWithinSensitiveControl`,
// `sensitive-text.ts`), the attributes that state what it holds -- `value`,
// `checked`, `selected`, an option's `label`, `aria-valuenow` and
// `aria-valuetext` -- are withheld. And with input-value capture off
// (`capture-settings.ts`), a text control's `value` is withheld as its live
// value is: a framework that mirrors the live value into the attribute would
// otherwise publish exactly what that setting turned off.

import { captureSettings } from "./capture-settings";
import { isWithinSensitiveControl } from "./sensitive-text";

/** Attributes that state what a control holds rather than what it is. */
const HELD_VALUE_ATTRIBUTES = new Set(["value", "checked", "selected", "label", "aria-valuenow", "aria-valuetext"]);

/** Input types whose `value` is the words on a button, not something a person entered. */
const BUTTON_INPUT_TYPES = new Set(["button", "submit", "reset", "image"]);

/** Every attribute of the element, in source order, less what it holds when that may not leave the page; `undefined` when none is left. */
export function elementAttributes(element: Element): Record<string, string> | undefined {
  const withinSensitive = isWithinSensitiveControl(element);
  const entries: Array<[string, string]> = [];
  for (const attribute of element.attributes) {
    const name = attribute.name;
    if (HELD_VALUE_ATTRIBUTES.has(name) && (withinSensitive || (name === "value" && holdsEnteredValue(element)))) continue;
    entries.push([name, attribute.value]);
  }
  // `fromEntries` defines each name as the object's own key, so an attribute a
  // page named `__proto__` is carried rather than swallowed by assignment.
  return entries.length ? Object.fromEntries(entries) : undefined;
}

/** A text control whose `value` attribute may mirror what a person typed, while input-value capture is off. */
function holdsEnteredValue(element: Element): boolean {
  if (captureSettings.inputValues) return false;
  if (element instanceof HTMLTextAreaElement) return true;
  return element instanceof HTMLInputElement && !BUTTON_INPUT_TYPES.has(element.type.toLowerCase());
}
