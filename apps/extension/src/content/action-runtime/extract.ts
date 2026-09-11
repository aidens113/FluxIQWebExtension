// Reads the value an extract action returns: inner HTML, one attribute, a
// field's value, or the element's whitespace-collapsed text.

import type { JsonObject, JsonValue } from "../types";

export function extractElement(element: Element, options?: JsonObject): JsonValue {
  const mode = options?.mode;
  if (mode === "html") return element.innerHTML;
  if (mode === "attribute" && typeof options?.attribute === "string") return element.getAttribute(options.attribute) ?? "";
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) return element.value;
  return element.textContent?.replace(/\s+/g, " ").trim() ?? "";
}
