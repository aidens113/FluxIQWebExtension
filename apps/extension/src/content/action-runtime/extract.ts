// Reads the value an extract action returns: inner HTML, one attribute, a
// field's value, or the element's whitespace-collapsed text -- and never a
// sensitive control's (decision D2).
//
// The four modes are the domain's `WebAutomationExtractReadMode` vocabulary.
// `actions/extract.ts` decides what to read from the command's structured
// `extract` (contract C3) and falls back to its `options`, then hands the
// result here as one shape, so this reader has one bag to read whichever way
// the command was recorded.
//
// A target that is sensitive by the one shared rule (`isSensitiveFormControl`),
// or sits inside an element that is, is refused in every mode, before anything
// is read: its live value, any attribute, and its HTML alike. An element inside
// a sensitive control -- an `<option>` of a sensitive select, a span in a
// marked editable region -- holds that control's contents, so it is refused as
// the control is (`isWithinSensitiveControl`). The refusal is a value the verb
// has to handle, not a blank string, so a caller cannot mistake "withheld" for
// "empty".
//
// A container is not refused -- a form or a table row is ordinary page content
// -- but what it holds is filtered by the same rule. A text read skips the
// contents of every sensitive control inside it (a sensitive `<textarea>`'s
// text, a sensitive `<select>`'s option labels), and an HTML read removes every
// sensitive descendant's `value` attribute and contents. Both ask the rule of
// the descendants rather than pre-selecting candidates by tag or attribute,
// which would be a second copy of the rule's inputs to keep in step with it.
//
// The text read is `textOutsideSensitiveControls` (`content/sensitive-text.ts`),
// the one reader element descriptors and accessible names also go through, so
// what extraction leaves out of a text and what a snapshot leaves out cannot
// drift apart.
//
// A container holding no sensitive descendant is read exactly as before, so
// the filtering costs one scan and changes nothing for ordinary content.

import { isSensitiveFormControl } from "../element-traits";
import { isWithinSensitiveControl, textOutsideSensitiveControls } from "../sensitive-text";
import type { JsonObject, JsonValue } from "../types";

/** A read that happened, or the reason it was refused. */
export type ExtractedElementValue =
  | { ok: true; value: JsonValue }
  | { ok: false; refusal: "sensitive_value" };

export function extractElement(element: Element, options?: JsonObject): ExtractedElementValue {
  if (isWithinSensitiveControl(element)) return { ok: false, refusal: "sensitive_value" };
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
 * sensitive control inside it left out. An element that sits inside a
 * sensitive control -- an `<option>` of a sensitive select -- reads as nothing,
 * because its text is that control's contents. `extractElement` refuses such a
 * target before it gets here; a caller reading fields inside a container asks
 * the rule of each field element itself first, and refuses rather than reading.
 */
export function readableText(element: Element): string {
  return textOutsideSensitiveControls(element).replace(/\s+/gu, " ").trim();
}

function hasSensitiveDescendant(root: Element): boolean {
  for (const descendant of root.querySelectorAll("*")) {
    if (isSensitiveFormControl(descendant)) return true;
  }
  return false;
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
