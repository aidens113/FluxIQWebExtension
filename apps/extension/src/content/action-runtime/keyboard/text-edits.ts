// The edit a key press makes between `keydown` and `keyup`: `beforeinput`, the
// change itself, then `input`.
//
// `beforeinput` is cancelable, and a page that cancels it stops the edit in a
// real browser, so both functions here report whether the edit actually
// happened rather than assuming it did. A field is written through the
// prototype's native value setter (`set-element-value.ts`) so a framework that
// installed its own setter on the element cannot swallow the change; an
// editable host is edited at the caret, because it has no value to set.

import { setElementValue } from "../set-element-value";
import { isTextField } from "./editable-target";

/** Inserts `data` at the caret, replacing whatever is selected. Reports whether the page allowed it. */
export function insertText(element: Element, data: string): boolean {
  if (!acceptsEdits(element)) return false;
  if (!beforeInput(element, "insertText", data)) return false;
  if (isTextField(element)) insertIntoField(element, data);
  else insertIntoHost(element, data);
  afterInput(element, "insertText", data);
  return true;
}

/** Empties the target the way selecting everything and deleting does. Reports whether the page allowed it. */
export function deleteAllContent(element: Element): boolean {
  if (!acceptsEdits(element)) return false;
  if (isTextField(element)) {
    if (!element.value) return true;
    if (!beforeInput(element, "deleteContentBackward")) return false;
    setElementValue(element, "");
  } else {
    if (!element.textContent) return true;
    if (!beforeInput(element, "deleteContentBackward")) return false;
    element.replaceChildren();
  }
  afterInput(element, "deleteContentBackward");
  return true;
}

/**
 * Whether the user could edit this target at all. The native value setter
 * writes to a read-only or disabled field quite happily, which a person typing
 * at the keyboard cannot, so an emulation that used it would report text a
 * real user could never have entered.
 */
function acceptsEdits(element: Element): boolean {
  return !isTextField(element) || (!element.readOnly && !element.disabled);
}

/** The cancelable half of the pair: `false` means the page refused the edit. */
function beforeInput(element: Element, inputType: string, data?: string): boolean {
  return element.dispatchEvent(new InputEvent("beforeinput", {
    bubbles: true, cancelable: true, composed: true, inputType, ...(data === undefined ? {} : { data })
  }));
}

/** The notification half: the edit has happened and the page is told about it. */
function afterInput(element: Element, inputType: string, data?: string): void {
  element.dispatchEvent(new InputEvent("input", {
    bubbles: true, cancelable: false, composed: true, inputType, ...(data === undefined ? {} : { data })
  }));
}

function insertIntoField(element: HTMLInputElement | HTMLTextAreaElement, data: string): void {
  const selection = fieldSelection(element);
  const value = element.value;
  const start = selection?.start ?? value.length;
  const end = selection?.end ?? value.length;
  setElementValue(element, value.slice(0, start) + data + value.slice(end));
  const caret = start + data.length;
  // Types such as number, email and date have no selection; the caret is then the browser's business.
  try { element.setSelectionRange(caret, caret); } catch { /* no selection on this input type */ }
}

/** The field's selection, or nothing when this input type does not have one. */
function fieldSelection(element: HTMLInputElement | HTMLTextAreaElement): { start: number; end: number } | undefined {
  try {
    const start = element.selectionStart;
    const end = element.selectionEnd;
    return start === null || end === null ? undefined : { start, end };
  } catch {
    return undefined;
  }
}

function insertIntoHost(element: Element, data: string): void {
  const selection = document.getSelection();
  const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : undefined;
  if (!selection || !range || !element.contains(range.commonAncestorContainer)) {
    element.append(data);
    return;
  }
  range.deleteContents();
  const text = document.createTextNode(data);
  range.insertNode(text);
  range.setStartAfter(text);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}
