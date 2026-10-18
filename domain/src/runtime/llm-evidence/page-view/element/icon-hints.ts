// What a control drawn only as an icon says when it has no words (lane 4,
// `run-mvcwf9u2-28bb44fd`): a pressable `<span>` holding an unlabelled `<svg>`
// has no name, no text and no title, and a line of only its handle and kind
// gives the model nothing to tell it from any other icon. So a control with no
// words says what the page drew and wrote on it instead, the same generic
// signals the element's fingerprint is made of:
//
//   [icon] [class="<class tokens>"] [use="<symbol>"]
//
// `icon` when it is, or holds, a picture: an `<svg>`, an `<img>`, a
// `<picture>`, a `<canvas>`, an `<i>` (an icon font's glyph) or an element
// whose role is `img`. A wordless link laid over a card holds none, and is
// not called one.
//
// `class` is every class token of the control and of the elements under it,
// in page order and each once -- an icon font's glyph class sits on an `<i>`
// inside its button. `use` is the symbol each `<svg><use>` under it draws,
// the part of its `href` from `#` on. Nothing is cut and nothing is guessed:
// a token is printed as the page wrote it, or not at all.
//
// A control with words anywhere under it gets none of this, and neither does a
// control whose kind is a value or a choice (a field, a select, a checkbox): an
// unnamed field is not drawn as a picture of what it does.

import type { WebLlmEvidenceElement } from "../../elements";
import { attributeValue } from "./attribute-value";
import { webLlmElementKind } from "./kind";
import { meaningfulWords } from "./meaningful";
import { quotedWords } from "./quoted";

const NOT_ICON_KINDS = /^(field|select|listbox|checkbox|radio|switch|slider)/u;

/** The tokens a wordless control's line prints, or `undefined` when it has words under it, is a field or choice, or the page gave it nothing to print. */
export function webLlmIconHints(control: WebLlmEvidenceElement, insides: readonly WebLlmEvidenceElement[]): string[] | undefined {
  const kind = webLlmElementKind(control);
  if (kind !== undefined && NOT_ICON_KINDS.test(kind)) return undefined;
  const all = [control, ...insides];
  if (all.some(holdsWords)) return undefined;
  const classes = unique(all.flatMap((element) => (attributeValue(element, "class") ?? "").split(/\s+/u)));
  const symbols = unique(insides.filter((element) => element.tag === "use").map(symbolOf));
  const hints = all.some(isPicture) ? ["icon"] : [];
  if (classes.length > 0) hints.push(`class=${quotedWords(classes.join(" "))}`);
  if (symbols.length > 0) hints.push(`use=${quotedWords(symbols.join(" "))}`);
  return hints.length === 0 ? undefined : hints;
}

const PICTURE_TAGS: ReadonlySet<string> = new Set(["svg", "img", "picture", "canvas", "i", "use"]);

function isPicture(element: WebLlmEvidenceElement): boolean {
  return PICTURE_TAGS.has(element.tag) || element.role?.trim().split(/\s+/u)[0]?.toLowerCase() === "img";
}

function holdsWords(element: WebLlmEvidenceElement): boolean {
  return [element.name, element.text, element.ownText, element.label].some((words) => meaningfulWords(words));
}

/** The symbol a `<use>` draws: its `href` (or `xlink:href`) from `#` on, or the whole of it without one. */
function symbolOf(use: WebLlmEvidenceElement): string {
  const href = (attributeValue(use, "href") ?? attributeValue(use, "xlink:href") ?? "").trim();
  const at = href.indexOf("#");
  return at < 0 ? href : href.slice(at);
}

function unique(tokens: readonly string[]): string[] {
  return [...new Set(tokens.map((token) => token.trim()).filter((token) => token !== ""))];
}
