// What the page view asks of one element before it decides whether the
// element gets a line (t223, "Which elements get a line"): whether it is
// visible, a control, a layer, a semantic text element, an image, and which
// words are its own.
//
// `control` is the view's own predicate. `actionableEvidenceElement`
// (`../../elements.ts`) is a different question asked by other callers and is
// not changed by this one.

import type { WebLlmEvidenceElement } from "../../elements";
import { attributeValue } from "./attribute-value";
import { meaningfulWords } from "./meaningful";

/** Which kind of line an element gets when it gets one: a control's, a layer's, text, or an image's alt. */
export type WebLlmLineRole = "control" | "layer" | "text" | "image";

export type WebLlmViewTraits = {
  /**
   * It is not a hidden element a search capture added, and its box, when it has
   * one, reaches into the document. An element with no box is still visible:
   * the capture lists one only when it is drawn or pressed without a box of its
   * own (an image map `area`, a `display: contents` wrapper), and a box that
   * failed to measure must not take a control off the page (t223, "no caps").
   */
  visible: boolean;
  /** A link, button, field, menu or other thing a person operates. */
  control: boolean;
  /** An open dialog, or something painted over other controls. */
  layer: boolean;
  /** A paragraph, list item, table cell, definition, caption, quotation or heading: its `text` is all of its descendants' words. */
  semantic: boolean;
  /** An `img`, or an element whose role is `img`. */
  image: boolean;
  /** The words that are the element's own: `ownText`, else `text`, else, for a semantic element only, its `name`. */
  ownWords: string | undefined;
  /** The kind of line it gets if it is visible and no fold applies, or `undefined` for none. */
  lineRole: WebLlmLineRole | undefined;
};

const CONTROL_TAGS: ReadonlySet<string> = new Set(["button", "select", "textarea", "summary"]);
const CONTROL_ROLES: ReadonlySet<string> = new Set([
  "button", "link", "checkbox", "radio", "switch", "tab", "menuitem", "menuitemcheckbox", "menuitemradio",
  "option", "combobox", "textbox", "searchbox", "slider", "spinbutton", "listbox", "treeitem"
]);
const SEMANTIC_TAGS: ReadonlySet<string> = new Set(["p", "li", "td", "th", "dt", "dd", "figcaption", "blockquote", "h1", "h2", "h3", "h4", "h5", "h6"]);

/** Everything the page view's line rules ask of one element. */
export function webLlmViewTraits(element: WebLlmEvidenceElement): WebLlmViewTraits {
  const role = pageRole(element);
  const box = element.box;
  const visible = element.hidden !== true && (box === undefined || (box.x + box.width > 0 && box.y + box.height > 0));
  const control = isControl(element, role);
  const layer = element.isDialog !== undefined || element.covers !== undefined || element.coversCount !== undefined;
  const semantic = SEMANTIC_TAGS.has(element.tag);
  const image = element.tag === "img" || role === "img";
  const ownWords = element.ownText ?? element.text ?? (semantic ? element.name : undefined);
  return { visible, control, layer, semantic, image, ownWords, lineRole: lineRole({ control, layer, image, ownWords }, element) };
}

/** The first token of the role the page wrote, lower-cased. */
function pageRole(element: WebLlmEvidenceElement): string | undefined {
  return element.role?.trim().split(/\s+/u)[0]?.toLowerCase() || undefined;
}

function isControl(element: WebLlmEvidenceElement, role: string | undefined): boolean {
  if (element.tag === "a" && (element.href !== undefined || attributeValue(element, "href") !== undefined)) return true;
  if (CONTROL_TAGS.has(element.tag)) return true;
  if (element.tag === "input") return element.inputType !== "hidden";
  if (role !== undefined && CONTROL_ROLES.has(role)) return true;
  if (element.hasClickHandler === true) return true;
  const editable = attributeValue(element, "contenteditable");
  return editable !== undefined && editable.trim().toLowerCase() !== "false";
}

function lineRole(traits: Pick<WebLlmViewTraits, "control" | "layer" | "image" | "ownWords">, element: WebLlmEvidenceElement): WebLlmLineRole | undefined {
  if (traits.control) return "control";
  if (traits.layer) return "layer";
  if (meaningfulWords(traits.ownWords)) return "text";
  if (traits.image && meaningfulWords(element.name)) return "image";
  return undefined;
}
