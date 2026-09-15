// Reads the value an extract action returns: inner HTML, one attribute, a
// field's value, or the element's whitespace-collapsed text -- and never a
// sensitive control's (decision D2).
//
// A target that is sensitive by the one shared rule (`isSensitiveFormControl`)
// is refused in every mode, before anything is read: its live value, any
// attribute, and its HTML alike. The refusal is a value the verb has to handle,
// not a blank string, so a caller cannot mistake "withheld" for "empty".
//
// A container is not refused -- a form or a table row is ordinary page content
// -- but what it holds is filtered by the same rule. A text read skips the
// contents of every sensitive control inside it (a sensitive `<textarea>`'s
// text, a sensitive `<select>`'s option labels), and an HTML read removes every
// sensitive descendant's `value` attribute and contents. Both ask the rule of
// every descendant rather than pre-selecting candidates by tag or attribute,
// which would be a second copy of the rule's inputs to keep in step with it.
//
// A container holding no sensitive descendant is read exactly as before, so
// the filtering costs one scan and changes nothing for ordinary content.

import { isSensitiveFormControl } from "../element-traits";
import type { JsonObject, JsonValue } from "../types";

/** A read that happened, or the reason it was refused. */
export type ExtractedElementValue =
  | { ok: true; value: JsonValue }
  | { ok: false; refusal: "sensitive_value" };

export function extractElement(element: Element, options?: JsonObject): ExtractedElementValue {
  if (isSensitiveFormControl(element)) return { ok: false, refusal: "sensitive_value" };
  const mode = options?.mode;
  if (mode === "html") return { ok: true, value: htmlWithoutSensitiveContent(element) };
  if (mode === "attribute" && typeof options?.attribute === "string") return { ok: true, value: element.getAttribute(options.attribute) ?? "" };
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
    return { ok: true, value: element.value };
  }
  return { ok: true, value: readableText(element) };
}

/**
 * The element's whitespace-collapsed text, with the contents of every
 * sensitive control inside it left out. The element itself is not judged: a
 * caller that reads a control asks the rule of it first.
 */
export function readableText(element: Element): string {
  const text = hasSensitiveDescendant(element) ? textOutsideSensitiveControls(element) : element.textContent ?? "";
  return text.replace(/\s+/gu, " ").trim();
}

function hasSensitiveDescendant(root: Element): boolean {
  for (const descendant of root.querySelectorAll("*")) {
    if (isSensitiveFormControl(descendant)) return true;
  }
  return false;
}

/** `textContent`, less every subtree rooted at a sensitive control. */
function textOutsideSensitiveControls(root: Element): string {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (node.nodeType === Node.TEXT_NODE) return NodeFilter.FILTER_ACCEPT;
      return isSensitiveFormControl(node as Element) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP;
    }
  });
  let text = "";
  for (let node = walker.nextNode(); node; node = walker.nextNode()) text += node.nodeValue ?? "";
  return text;
}

/**
 * `innerHTML`, with every sensitive descendant's `value` attribute and contents
 * removed. The copy is made in a document with no browsing context, so nothing
 * in it loads, runs, or upgrades while it is filtered, and the live page is
 * never touched.
 */
function htmlWithoutSensitiveContent(element: Element): string {
  if (!hasSensitiveDescendant(element)) return element.innerHTML;
  const copy = document.implementation.createHTMLDocument("").importNode(element, true);
  for (const descendant of copy.querySelectorAll("*")) {
    if (!isSensitiveFormControl(descendant)) continue;
    descendant.removeAttribute("value");
    descendant.replaceChildren();
  }
  return copy.innerHTML;
}
