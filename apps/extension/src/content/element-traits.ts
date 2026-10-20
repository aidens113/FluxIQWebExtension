// What kind of thing an element is: whether a user can act on it, whether it
// carries text or media worth recording, and whether its value is sensitive
// enough that it must never leave the page. Every predicate here answers from
// the element alone, so nothing in this file depends on recorder state.

import { isSensitiveFieldSignature } from "../shared/sensitive-field";

/** True when the element is one a user can click, type into, or toggle. */
export function isActionableElement(element: Element): boolean {
  const tagName = element.tagName.toLowerCase();
  const role = element.getAttribute("role")?.toLowerCase();
  return tagName === "a" ||
    tagName === "button" ||
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    tagName === "summary" ||
    tagName === "label" ||
    role === "button" ||
    role === "link" ||
    role === "menuitem" ||
    role === "checkbox" ||
    role === "radio" ||
    role === "tab" ||
    role === "switch" ||
    hasClickHandler(element) ||
    element instanceof HTMLElement && element.isContentEditable;
}

/** Actionable, or dressed like something actionable: pointer cursor, tabindex, ARIA state. */
export function isInteractableUiElement(element: Element): boolean {
  return isActionableElement(element) ||
    element instanceof HTMLElement && getComputedStyle(element).cursor === "pointer" ||
    element.hasAttribute("tabindex") ||
    element.hasAttribute("aria-expanded") ||
    element.hasAttribute("aria-controls") ||
    element.hasAttribute("aria-pressed") ||
    element.hasAttribute("aria-selected");
}

export function hasClickHandler(element: Element): boolean {
  const htmlElement = element as HTMLElement & { onclick?: unknown };
  return element.hasAttribute("onclick") || typeof htmlElement.onclick === "function";
}

export function isSemanticTextElement(element: Element): boolean {
  const tagName = element.tagName.toLowerCase();
  return tagName === "p" ||
    tagName === "li" ||
    tagName === "td" ||
    tagName === "th" ||
    tagName === "dt" ||
    tagName === "dd" ||
    tagName === "figcaption" ||
    tagName === "blockquote" ||
    /^h[1-6]$/.test(tagName);
}

/** A control whose typing is debounced into one `dom.input` event rather than recorded per keystroke. */
export function isTextEntryElement(element: Element): boolean {
  if (element instanceof HTMLTextAreaElement) return true;
  if (element instanceof HTMLElement && element.isContentEditable) return true;
  if (!(element instanceof HTMLInputElement)) return false;
  const type = element.type.toLowerCase();
  return type === "" ||
    type === "text" ||
    type === "search" ||
    type === "email" ||
    type === "password" ||
    type === "tel" ||
    type === "url" ||
    type === "number";
}

/** A control whose meaningful change arrives as `change`, not as `input`. */
export function shouldRecordChangeEvent(element: Element): boolean {
  if (element instanceof HTMLSelectElement) return true;
  if (!(element instanceof HTMLInputElement)) return true;
  const type = element.type.toLowerCase();
  return type === "checkbox" ||
    type === "radio" ||
    type === "file" ||
    type === "date" ||
    type === "datetime-local" ||
    type === "month" ||
    type === "time" ||
    type === "week" ||
    type === "color" ||
    type === "range";
}

/**
 * Passwords, one-time codes, card fields -- a card security code named only by
 * its `name`, `id` or label among them -- and anything marked `data-sensitive`,
 * by the shared rule. The element alone: whether it sits inside a marked
 * element is `isWithinSensitiveControl` (`sensitive-text.ts`), which every path
 * that reads what a control holds asks.
 *
 * An input's names and label words are handed to the rule because a real card
 * form often writes no `autocomplete`: bigbox-retail's `<input name="cvc">`
 * under "Security code" leaked what was typed into it (t730 c2). The rule
 * consults them for a text-entry input only.
 */
export function isSensitiveFormControl(element: Element): boolean {
  const input = element instanceof HTMLInputElement ? element : undefined;
  return isSensitiveFieldSignature({
    inputType: input?.type,
    autocomplete: element.getAttribute("autocomplete") ?? undefined,
    dataSensitive: element.getAttribute("data-sensitive") ?? undefined,
    names: input ? [element.getAttribute("name") ?? undefined, element.getAttribute("id") ?? undefined] : undefined,
    labels: input ? labelWords(input) : undefined
  });
}

/**
 * The words that label an input, as the page wrote them: its `aria-label`,
 * `placeholder`, every `<label>` of it, and what `aria-labelledby` points at.
 * Read raw rather than through `identity/`, whose readers ask this predicate
 * of what they read; the words are only inspected by the rule, never carried.
 * A page without a document -- a Node test's stand-in -- has no labelled-by
 * targets to find, and an input the platform gives no `labels` has none.
 */
function labelWords(input: HTMLInputElement): Array<string | undefined> {
  const words: Array<string | undefined> = [input.getAttribute("aria-label") ?? undefined, input.getAttribute("placeholder") ?? undefined];
  for (const label of input.labels ?? []) words.push(label.textContent ?? undefined);
  const labelledBy = input.getAttribute("aria-labelledby");
  const document = labelledBy ? input.ownerDocument : undefined;
  if (labelledBy && typeof document?.getElementById === "function") {
    for (const id of labelledBy.split(/\s+/u)) if (id) words.push(document.getElementById(id)?.textContent ?? undefined);
  }
  return words;
}

/** Input types whose `value` is not something a user entered, so its presence says nothing. */
const VALUELESS_INPUT_TYPES = new Set(["hidden", "button", "submit", "reset", "image", "checkbox", "radio"]);

/**
 * Whether a value-bearing control currently holds a value, or `undefined` when
 * the element has no value to speak of.
 *
 * Presence only: the value itself is never returned, which is what makes this
 * safe for a sensitive field, whose content must never leave the page. There is
 * no sensitivity test here on purpose -- a boolean carries nothing to redact,
 * and `isSensitiveFieldSignature` in `shared/sensitive-field.ts` stays the one
 * rule that decides which values may be read.
 */
export function hasEnteredValue(element: Element): boolean | undefined {
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) return element.value.length > 0;
  if (element instanceof HTMLInputElement) {
    return VALUELESS_INPUT_TYPES.has(element.type.toLowerCase()) ? undefined : element.value.length > 0;
  }
  if (element instanceof HTMLElement && element.isContentEditable) return (element.textContent ?? "").trim().length > 0;
  return undefined;
}

/** Whether a text-ish value is worth recording at all. Used wherever an element's identity is judged. */
export function meaningfulText(value: string | undefined | null): boolean {
  return typeof value === "string" && value.trim().length > 0;
}
