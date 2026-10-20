// The attributes an element is written into the capture with, and for a
// `<textarea>` the text it is written holding.
//
// Every attribute is kept as the page wrote it -- URLs relative, names in
// source order -- because the capture is served at the address it was taken
// from, and a read that matches an attribute's raw value (`a[href^="/p/"]`)
// must match offline as it did live (lane T U3, decision 4). Two things change:
//
// - Inline handlers (`on*`) are dropped: the capture runs no page script.
// - What a control holds is written as it holds it now, so the capture shows
//   the live form state rather than the markup's defaults: a text field's
//   value as `value`, a checked box as `checked`, a chosen option as
//   `selected`, a textarea's text as its content.
//
// What may not leave the page follows the rule the action results follow,
// asked rather than restated. The raw attributes come through
// `elementAttributes` (`descriptor-attributes.ts`), which withholds what a
// sensitive control holds (`value`, `checked`, `selected`, an option's
// `label`, `aria-valuenow`, `aria-valuetext`) and, with input-value capture
// off, a text control's `value`. The live state is written only where
// `readElementValue` and `checkedState` (`describe-element.ts`) would read it:
// never on a control that is, or sits inside, a sensitive one (`within`, which
// the serializer carries down the tree, across shadow roots), never a file
// input's chosen file, and a typed value only while input-value capture is on.

import { captureSettings } from "../capture-settings";
import { elementAttributes } from "../descriptor-attributes";

const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";

/** An attribute that holds a script the page runs on an event. */
const INLINE_HANDLER = /^on/iu;

/** Input types whose `value` is the page's words or the page's data, not something a person typed: kept as written. */
const MARKUP_VALUE_INPUT_TYPES = new Set(["button", "submit", "reset", "image", "hidden"]);

export type ElementMarkupState = {
  /** The attributes to write, in the page's order, a live value in place of the written one. */
  attributes: Map<string, string>;
  /** The text the element is written holding in place of its children: a textarea's live text. */
  content: string | undefined;
};

export function elementMarkupState(element: Element, within: boolean): ElementMarkupState {
  const attributes = new Map<string, string>();
  for (const [name, value] of Object.entries(elementAttributes(element) ?? {})) {
    if (!INLINE_HANDLER.test(name)) attributes.set(name, value);
  }
  if (element.namespaceURI !== HTML_NAMESPACE) return { attributes, content: undefined };
  const tag = element.localName;
  if (tag === "input") writeInputState(element as HTMLInputElement, attributes, within);
  if (tag === "option") setFlag(attributes, "selected", !within && (element as HTMLOptionElement).selected);
  if (tag !== "textarea") return { attributes, content: undefined };
  const area = element as HTMLTextAreaElement;
  return { attributes, content: !within && captureSettings.inputValues ? area.value : "" };
}

function writeInputState(input: HTMLInputElement, attributes: Map<string, string>, within: boolean): void {
  const type = input.type.toLowerCase();
  if (type === "checkbox" || type === "radio") {
    setFlag(attributes, "checked", !within && input.checked);
    return;
  }
  if (type === "file") {
    // Its value is the chosen file's local name, which is the person's.
    attributes.delete("value");
    return;
  }
  if (MARKUP_VALUE_INPUT_TYPES.has(type)) return;
  const live = !within && captureSettings.inputValues ? input.value : "";
  if (live === "") attributes.delete("value");
  else attributes.set("value", live);
}

/** Writes a boolean attribute as `on` says, keeping its place and written value when it is already there. */
function setFlag(attributes: Map<string, string>, name: string, on: boolean): void {
  if (!on) attributes.delete(name);
  else if (!attributes.has(name)) attributes.set(name, "");
}
