// Where typed characters can go: a field whose text is its `value`, or a
// `contenteditable` host that has no value and is edited at the caret.
//
// The two are told apart everywhere in this directory because they take the
// edit differently -- a field is written through the prototype's native value
// setter, a host through the DOM at the selection -- while a checkbox, a radio,
// a file picker, or a button holds no typed text at all and must never be
// written to as though it did.

/** Input types whose `value` is not text the user types: state, a file, or a button's label. */
const NON_TEXT_INPUT_TYPES = new Set([
  "checkbox", "radio", "file", "submit", "reset", "button", "image", "range", "color", "hidden"
]);

/** A control whose typed text is its `value`. */
export function isTextField(element: Element): element is HTMLInputElement | HTMLTextAreaElement {
  if (element instanceof HTMLTextAreaElement) return true;
  return element instanceof HTMLInputElement && !NON_TEXT_INPUT_TYPES.has(element.type);
}

/** An element the page has made editable, whose text lives in its child nodes. */
export function isEditableHost(element: Element): element is HTMLElement {
  return element instanceof HTMLElement && element.isContentEditable;
}
