// Whether one element would do something when a person clicks it, as far as
// the page shows (W2 H4, `before.ts`).
//
// A misclick is made only on a point no part of the page answers, and a page's
// delegated handlers are invisible, so this errs wide: an element is taken for
// interactive on any sign at all that it is a control, holds a control's role
// or state, takes focus or text, carries a handler of its own, or shows a hand
// (or any pointer that means "this moves") under the mouse. The caller asks it
// of the hit element and every ancestor, across shadow roots
// (`inert-point.ts`), so a click that would bubble into a control is refused.

/** Elements that are controls, or whose content a click reaches into, by tag. */
const INTERACTIVE_TAGS = new Set([
  "A", "AREA", "AUDIO", "BUTTON", "CANVAS", "DETAILS", "DIALOG", "EMBED", "FRAME", "IFRAME", "INPUT",
  "LABEL", "MAP", "OBJECT", "OPTGROUP", "OPTION", "SELECT", "SUMMARY", "TEXTAREA", "VIDEO"
]);

/** ARIA roles a control or a layer holds. */
const INTERACTIVE_ROLES = new Set([
  "alertdialog", "button", "checkbox", "columnheader", "combobox", "dialog", "grid", "gridcell", "link", "listbox",
  "menu", "menubar", "menuitem", "menuitemcheckbox", "menuitemradio", "option", "radio", "radiogroup", "row",
  "rowheader", "scrollbar", "searchbox", "slider", "spinbutton", "switch", "tab", "tablist", "textbox", "tooltip",
  "tree", "treegrid", "treeitem"
]);

/** Attributes that say an element takes focus, text, a drag, or opens or controls something. */
const INTERACTIVE_ATTRIBUTES = ["tabindex", "aria-haspopup", "aria-expanded", "aria-pressed", "aria-checked", "aria-selected", "aria-controls", "aria-owns"];

/** Handler properties a script may set without an attribute. */
const HANDLER_PROPERTIES = ["onclick", "onmousedown", "onmouseup", "onpointerdown", "onpointerup", "onauxclick", "ondblclick", "oncontextmenu"];

/** Pointers that say the element answers the mouse. */
const INTERACTIVE_CURSORS = new Set(["pointer", "grab", "grabbing", "move", "zoom-in", "zoom-out", "crosshair", "cell", "col-resize", "row-resize", "all-scroll"]);

/** Whether a click on `element` itself may be answered by the page. */
export function isInteractiveElement(element: Element): boolean {
  if (INTERACTIVE_TAGS.has(element.tagName.toUpperCase())) return true;
  const role = element.getAttribute("role");
  if (role && role.toLowerCase().split(/\s+/).some((name) => INTERACTIVE_ROLES.has(name))) return true;
  if (INTERACTIVE_ATTRIBUTES.some((name) => element.hasAttribute(name))) return true;
  if (element.getAttribute("draggable") === "true" || editable(element)) return true;
  if (element.getAttributeNames().some((name) => name.toLowerCase().startsWith("on"))) return true;
  const handlers = element as unknown as Record<string, unknown>;
  if (HANDLER_PROPERTIES.some((name) => typeof handlers[name] === "function")) return true;
  const view = element.ownerDocument.defaultView;
  const cursor = (view ? view.getComputedStyle(element).cursor : "") ?? "";
  // A drawn cursor (`url(...)`) is the page saying something special happens here.
  if (/url\(/i.test(cursor)) return true;
  return INTERACTIVE_CURSORS.has((cursor.split(",").pop() ?? "").trim().toLowerCase());
}

/** Whether the element, or its inherited editing state, takes typed text. */
function editable(element: Element): boolean {
  if ((element as HTMLElement).isContentEditable === true) return true;
  const attribute = element.getAttribute("contenteditable");
  return attribute !== null && attribute.toLowerCase() !== "false";
}
