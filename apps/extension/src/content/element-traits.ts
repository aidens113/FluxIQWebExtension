// What kind of thing an element is: whether a user can act on it, whether it
// carries text or media worth recording, and whether its value is sensitive
// enough that it must never leave the page. Every predicate here answers from
// the element alone, so nothing in this file depends on recorder state.

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

/** The controls a snapshot should rank first: buttons, links, menu items, tabs. */
export function isPrimaryControlElement(element: Element): boolean {
  const tagName = element.tagName.toLowerCase();
  const role = element.getAttribute("role")?.toLowerCase();
  return tagName === "button" ||
    tagName === "a" ||
    tagName === "summary" ||
    role === "button" ||
    role === "link" ||
    role === "menuitem" ||
    role === "tab";
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

export function hasVisualMedia(element: Element): boolean {
  return element.matches("svg,img,picture,canvas,video") ||
    Boolean(element.querySelector("svg,img,picture,canvas,video"));
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

/** Passwords, one-time codes, card fields and anything marked `data-sensitive`. */
export function isSensitiveFormControl(element: Element): boolean {
  if (element instanceof HTMLInputElement && element.type.toLowerCase() === "password") return true;
  const autocomplete = (element.getAttribute("autocomplete") ?? "").toLowerCase();
  return autocomplete === "current-password" || autocomplete === "new-password" || autocomplete === "one-time-code" || autocomplete.startsWith("cc-") || element.getAttribute("data-sensitive") === "true";
}

/** A plain fill control whose emptiness may be reported without reporting its value. */
export function isOrdinaryNonSensitiveFillControl(element: Element): element is HTMLInputElement | HTMLTextAreaElement {
  if (isSensitiveFormControl(element)) return false;
  if (element instanceof HTMLTextAreaElement) return true;
  return element instanceof HTMLInputElement && ["text", "search", "email", "tel", "url", "number"].includes(element.type.toLowerCase());
}

/** Whether a text-ish value is worth recording at all. Used wherever an element's identity is judged. */
export function meaningfulText(value: string | undefined | null): boolean {
  return typeof value === "string" && value.trim().length > 0;
}
