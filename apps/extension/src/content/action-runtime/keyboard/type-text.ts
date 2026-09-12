// Typing text one character at a time (decision D5), so a widget that listens
// for keystrokes reacts the way it does for a real user.
//
// Writing a field's value in one assignment fires at most one `input` event,
// and an autocomplete or combobox that filters per keystroke never runs. So
// each character is a full `keydown`, `beforeinput`, the edit, `input`,
// `keyup` sequence, and a `keydown` the page cancels suppresses its character
// exactly as it would in the browser.
//
// `typeText` enters `text` as the target's whole content: what was there is
// deleted first, as selecting a field and typing over it does. That is the
// `web.dom.type` verb's established meaning, and it is the only caller.
// The trailing `change` event is what a field fires when the user commits an
// edit, and pages that autosave on `change` depend on it.

import { dispatchKeyEvent } from "./key-event";
import { deleteAllContent, insertText } from "./text-edits";
import { isEditableHost, isTextField } from "./editable-target";

export function typeText(element: Element, text: string): void {
  if (!isTextField(element) && !isEditableHost(element)) return;
  if (element instanceof HTMLElement) element.focus();
  deleteAllContent(element);
  for (const character of text) {
    if (dispatchKeyEvent(element, "keydown", character)) insertText(element, character);
    dispatchKeyEvent(element, "keyup", character);
  }
  if (isTextField(element)) element.dispatchEvent(new Event("change", { bubbles: true }));
  else element.normalize();
}
