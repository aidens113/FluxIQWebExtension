// The one word the page view prints for what an element is (t223, "Kinds"):
// `link`, `button`, `field` (`field:<type>` for an input that is not text or
// search), `select`, `checkbox`, `radio`, `switch`, `toggle`, `tab`,
// `menuitem`, `option`, `slider`, `treeitem`, `h1`-`h6`, `img`, `clickable`,
// `dialog` and `layer`. Plain text has no kind.
//
// The role the page wrote decides first, so a link styled as a button and
// marked `role="button"` is a button. Three roles the format does not name are
// given the nearest kind it does: `combobox` and `spinbutton` are fields a
// person types into, and a `listbox` is chosen from, as a select is.

import type { WebLlmEvidenceElement } from "../../elements";
import { attributeValue } from "./attribute-value";

const ROLE_KINDS: Readonly<Record<string, string>> = {
  link: "link",
  button: "button",
  checkbox: "checkbox",
  radio: "radio",
  switch: "switch",
  textbox: "field",
  searchbox: "field",
  combobox: "field",
  spinbutton: "field",
  listbox: "select",
  tab: "tab",
  menuitem: "menuitem",
  menuitemcheckbox: "menuitem",
  menuitemradio: "menuitem",
  option: "option",
  slider: "slider",
  treeitem: "treeitem",
  img: "img"
};
const BUTTON_INPUT_TYPES: ReadonlySet<string> = new Set(["submit", "button", "reset", "image"]);
const HEADING_TAG = /^h[1-6]$/u;

/** The element's kind word, or `undefined` for plain text. */
export function webLlmElementKind(element: WebLlmEvidenceElement): string | undefined {
  const role = element.role?.trim().split(/\s+/u)[0]?.toLowerCase();
  const byRole = role === undefined ? undefined : ROLE_KINDS[role];
  if (byRole !== undefined) return byRole;
  const byTag = tagKind(element);
  if (byTag !== undefined) return byTag;
  if (element.hasClickHandler === true) return "clickable";
  if (element.isDialog !== undefined) return "dialog";
  if (element.covers !== undefined || element.coversCount !== undefined) return "layer";
  return undefined;
}

function tagKind(element: WebLlmEvidenceElement): string | undefined {
  const tag = element.tag;
  if (tag === "input") return inputKind(element.inputType ?? "text");
  if (tag === "a" && (element.href !== undefined || attributeValue(element, "href") !== undefined)) return "link";
  if (tag === "button") return "button";
  if (tag === "select") return "select";
  if (tag === "textarea") return "field";
  if (tag === "summary") return "toggle";
  if (HEADING_TAG.test(tag)) return tag;
  if (tag === "img") return "img";
  const editable = attributeValue(element, "contenteditable");
  if (editable !== undefined && editable.trim().toLowerCase() !== "false") return "field";
  return undefined;
}

function inputKind(type: string): string | undefined {
  if (type === "hidden") return undefined;
  if (type === "checkbox" || type === "radio") return type;
  if (BUTTON_INPUT_TYPES.has(type)) return "button";
  return type === "text" || type === "search" ? "field" : `field:${type}`;
}
