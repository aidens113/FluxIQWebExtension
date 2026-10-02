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
  /**
   * A link, button, field, menu or other thing a person operates -- and an
   * element the page gave a cursor of its own that says "press here" or
   * "this refuses a press", which is how a page that draws its controls as
   * `<div>`s shows a person they are controls (t229). A `<label>` given a
   * pointer is not one: it presses the control it names, which has its own line.
   */
  control: boolean;
  /**
   * A control only by what the page bound or drew -- a press listener, a
   * cursor of its own -- and not by its tag, role or editability. Its `text`
   * is every word under it, a closed flyout's included, so its line says its
   * own words (`./words.ts`).
   */
  drawn: boolean;
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

/**
 * Everything the page view's line rules ask of one element.
 *
 * `delegate` says the element holds a control of its own (`../line-choice.ts`).
 * Then a click handler or a cursor does not make it a control: a feed list that
 * listens for presses on the "…see more" buttons inside it, or a card with a
 * pointer whose title is a link, is where presses are heard, and what a person
 * presses is inside it (t229). Its link, button, field or role still does.
 */
export function webLlmViewTraits(element: WebLlmEvidenceElement, delegate = false): WebLlmViewTraits {
  const role = pageRole(element);
  const box = element.box;
  const visible = element.hidden !== true && (box === undefined || (box.x + box.width > 0 && box.y + box.height > 0));
  const strong = isControl(element, role);
  const drawn = !strong && !delegate && isDrawnControl(element);
  const control = strong || drawn;
  const layer = element.isDialog !== undefined || element.covers !== undefined || element.coversCount !== undefined;
  const semantic = SEMANTIC_TAGS.has(element.tag);
  const image = element.tag === "img" || role === "img";
  const ownWords = element.ownText ?? element.text ?? (semantic ? element.name : undefined);
  return { visible, control, drawn, layer, semantic, image, ownWords, lineRole: lineRole({ control, layer, image, ownWords }, element) };
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
  const editable = attributeValue(element, "contenteditable");
  return editable !== undefined && editable.trim().toLowerCase() !== "false";
}

/** A control only by what the page bound or drew: a press listener, or a cursor of its own. */
function isDrawnControl(element: WebLlmEvidenceElement): boolean {
  return element.hasClickHandler === true || (element.cursor !== undefined && element.tag !== "label");
}

function lineRole(traits: Pick<WebLlmViewTraits, "control" | "layer" | "image" | "ownWords">, element: WebLlmEvidenceElement): WebLlmLineRole | undefined {
  if (traits.control) return "control";
  if (traits.layer) return "layer";
  if (meaningfulWords(traits.ownWords)) return "text";
  if (traits.image && meaningfulWords(element.name)) return "image";
  return undefined;
}
