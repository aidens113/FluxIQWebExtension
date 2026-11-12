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
//
// **A person's cadence, at a humanness above 0.** Given `gapsMs` -- the gap
// before each character after the first, planned and fitted within the
// command's time by `../humanness/` -- the same characters are typed with an
// awaited pause between them: the same events, in the same order, to the same
// final value. Without them, as at humanness 0, typing is synchronous and
// returns nothing, exactly as before. Number and date controls commit their
// whole value at once either way: their native setter discards a prefix.

import { typeSanitizedInput } from "./sanitized-input";
import { dispatchKeyEvent } from "./key-event";
import { deleteAllContent, insertText } from "./text-edits";
import { isEditableHost, isTextField } from "./editable-target";
import { pauseFor } from "../humanness";

/**
 * Types `text` as the target's whole content. With `gapsMs` (humanness above
 * 0), the typing pauses before each character after the first and the promise
 * settles once the last event is dispatched; without, it is synchronous.
 */
export function typeText(element: Element, text: string, gapsMs?: readonly number[] | undefined): void | Promise<void> {
  if (!isTextField(element) && !isEditableHost(element)) return;
  if (element instanceof HTMLElement) element.focus();
  // Number/calendar/time controls sanitize incomplete prefixes to empty strings.
  // Text and autocomplete controls retain the established per-character path.
  if (element instanceof HTMLInputElement && ["number", "date", "time", "datetime-local", "month", "week"].includes(element.type)) {
    typeSanitizedInput(element, text);
    return;
  }
  deleteAllContent(element);
  if (gapsMs) return typeAtCadence(element, text, gapsMs);
  for (const character of text) typeCharacter(element, character);
  finishTyping(element);
}

/** The per-character path with an awaited gap before each character after the first. */
async function typeAtCadence(element: Element, text: string, gapsMs: readonly number[]): Promise<void> {
  let index = 0;
  for (const character of text) {
    const gap = index > 0 ? gapsMs[index - 1] ?? 0 : 0;
    if (gap > 0) await pauseFor(gap);
    typeCharacter(element, character);
    index += 1;
  }
  finishTyping(element);
}

/** One character's keydown, edit and keyup; a keydown the page cancels suppresses the edit. */
function typeCharacter(element: Element, character: string): void {
  if (dispatchKeyEvent(element, "keydown", character)) insertText(element, character);
  dispatchKeyEvent(element, "keyup", character);
}

/** The commit a field fires once the typing is done; an editable host's text is merged instead. */
function finishTyping(element: Element): void {
  if (isTextField(element)) element.dispatchEvent(new Event("change", { bubbles: true }));
  else element.normalize();
}
