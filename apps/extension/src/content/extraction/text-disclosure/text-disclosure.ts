import { WEB_AUTOMATION_FAILURE_CODES, webAutomationFailureRecord } from "@fluxiq-web-extension/domain/client";

// Positive expansion controls only. Plain prose and unrelated row controls do
// not establish that the selected field omits text. Reading never presses one.
const EXPAND_CAPTION = /^(?:(?:see|read|show) more(?: (?:text|details))?|(?:show|read|view) (?:full|complete) (?:text|message|description))$/iu;

/** Refuse a text field whose own visible disclosure still hides its remainder. */
export function assertTextDisclosed(element: Element, name: string): void {
  const control = [element, ...element.querySelectorAll("*")].find((candidate) => {
    if (candidate.tagName !== "BUTTON" && candidate.getAttribute("role") !== "button") return false;
    if (candidate.getAttribute("aria-expanded") === "true" || hidden(candidate)) return false;
    const caption = candidate.getAttribute("aria-label") ?? candidate.textContent ?? "";
    return EXPAND_CAPTION.test(caption.replace(/\s+/gu, " ").trim());
  });
  if (!control) return;
  const expected = `field ${name} contains fully disclosed text`;
  const actual = `incomplete_text: field ${name} contains an unexpanded text disclosure; expand it with an explicit registered row-bound click before reading the field again`;
  throw Object.assign(new Error(actual), {
    failure: webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED, { expected, actual })
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
