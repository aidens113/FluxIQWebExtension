// The text-disclosure control a field's element shows: a button (or an element
// with the button role) whose caption is a positive expansion phrase, neither
// expanded nor hidden. Plain prose and unrelated row controls do not establish
// that the field omits text. Moved out of `text-disclosure.ts` on 2026-10-20
// (t752), unchanged, when a read that presses the control (`press-disclosure.ts`)
// needed the same recognition the refusal uses.

// Positive expansion controls only.
const EXPAND_CAPTION = /^(?:(?:see|read|show) more(?: (?:text|details))?|(?:show|read|view) (?:full|complete) (?:text|message|description))$/iu;

/** The first collapsed disclosure control in `element` or inside it, the element itself checked first, or `undefined`. */
export function textDisclosureControl(element: Element): Element | undefined {
  return [element, ...element.querySelectorAll("*")].find((candidate) => {
    if (candidate.tagName !== "BUTTON" && candidate.getAttribute("role") !== "button") return false;
    if (candidate.getAttribute("aria-expanded") === "true" || hidden(candidate)) return false;
    const caption = candidate.getAttribute("aria-label") ?? candidate.textContent ?? "";
    return EXPAND_CAPTION.test(caption.replace(/\s+/gu, " ").trim());
  });
}

function hidden(control: Element): boolean {
  for (let current: Element | null = control; current; current = current.parentElement) {
    if (current.hasAttribute("hidden") || current.getAttribute("aria-hidden") === "true") return true;
    const style = current.ownerDocument?.defaultView?.getComputedStyle(current);
    if (style?.display === "none" || style?.visibility === "hidden" || style?.visibility === "collapse") return true;
  }
  return false;
}
