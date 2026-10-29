// The controls a covering layer has of its own, worded for the refusal that
// names it, icon-only ones included.
//
// **Why.** A press refused as covered by a dock named only the dock's close-word
// controls, and the model, told nothing else, read the dock's message-thread
// rows as its controls and pressed them (`run-mvswfjbq-d0a95f6e`, the covered
// feedback). The dock's own collapse control was an icon button in its header
// with no words, so no word list could ever find it. A layer's own controls are
// the buttons and pressable parts a person uses to operate the layer, the
// header's first; a link inside it is its content and is not listed.
//
// Each entry is the handle and a few of this domain's own words about it, never
// the page's: `t1509 (a control with no words in the layer's header)`. The page
// view shows each control's name beside its handle.

import type { WebLlmEvidenceElement } from "../../elements";
import type { WebLlmPageEvidence } from "../../sanitize";
import { webInLayer } from "./member";

/** The most own controls named, so a layer full of buttons does not fill the refusal. */
const MOST_CONTROLS = 6;
/** The top band of a layer where its close or collapse control lives: at least this many pixels, or this share of its height. */
const HEADER_MIN_BAND = 56;
const HEADER_BAND_SHARE = 0.2;
const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;
const FIELD_TAGS = new Set(["textarea", "select"]);
const BUTTON_INPUTS = new Set(["button", "submit", "reset", "checkbox", "radio"]);

/**
 * The own controls of the layer `cover` on `page`, as `handle (words)` entries:
 * header controls first, then the rest, each in page order. `skip` are handles
 * already named another way (the layer's closers). Empty when it has none.
 */
export function webLayerOwnControls(page: WebLlmPageEvidence, cover: string, skip: readonly string[] = []): string[] {
  const byHandle = new Map(page.elements.map((element) => [element.target, element] as const));
  const layer = byHandle.get(cover);
  if (layer === undefined) return [];
  const candidates = page.elements.filter((element) => element.target !== cover && !skip.includes(element.target)
    && element.hidden !== true && isControl(element) && webInLayer(byHandle, element, cover));
  // A pressable that holds another is a row of the layer's content; the part inside it is the control.
  const holders = new Set<string>();
  for (const element of candidates) {
    for (let at = element.parent, depth = 0; at !== undefined && depth < 40; depth += 1, at = byHandle.get(at)?.parent) holders.add(at);
  }
  const own = candidates.filter((element) => !holders.has(element.target));
  const header = own.filter((element) => inHeader(layer, element));
  const rest = own.filter((element) => !header.includes(element));
  return [...header, ...rest].slice(0, MOST_CONTROLS).map((element) => `${element.target} (${describe(element, header.includes(element))})`);
}

function describe(element: WebLlmEvidenceElement, header: boolean): string {
  if (isIconOnly(element)) return header ? "a control with no words in the layer's header" : "an icon-only control";
  const role = element.role ?? element.implicitRole;
  const what = element.tag === "button" || role === "button" ? "a button" : "a pressable control";
  return header ? `${what} in the layer's header` : what;
}

/** Whether it shows no letter or digit of its own: an icon, a glyph, nothing. A label the page gave it names it, and does not make it words. */
function isIconOnly(element: WebLlmEvidenceElement): boolean {
  if (element.text !== undefined) return !LETTER_OR_DIGIT.test(element.text);
  if (element.name === undefined) return true;
  return (element.attributes ?? []).some(([key]) => key === "aria-label" || key === "title");
}

/** A button or other pressable part, never a link (content) and never a field. */
function isControl(element: WebLlmEvidenceElement): boolean {
  const role = element.role ?? element.implicitRole;
  if (element.tag === "a" || role === "link") return false;
  if (FIELD_TAGS.has(element.tag) || (element.tag === "input" && !BUTTON_INPUTS.has(element.inputType ?? ""))) return false;
  return element.tag === "button" || role === "button" || element.hasClickHandler === true || element.cursor === "pointer";
}

function inHeader(layer: WebLlmEvidenceElement, element: WebLlmEvidenceElement): boolean {
  if (!layer.box || !element.box) return false;
  const bottom = layer.box.y + Math.max(HEADER_MIN_BAND, layer.box.height * HEADER_BAND_SHARE);
  return element.box.y + element.box.height / 2 <= bottom;
}
