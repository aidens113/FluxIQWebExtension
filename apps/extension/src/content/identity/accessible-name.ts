// The name a person would use for an element, computed in the order the
// accessible-name calculation uses: `aria-labelledby`, `aria-label`, an
// associated `<label>`, `title`/`alt`, `placeholder`, a button's value, then
// the element's own text. Core's fingerprint weights `accessibleName` as
// heavily as a stable id (24 against testId's 28), so a control whose selector
// drifts is still recognisable by its name (Phase 1.3).
//
// Two rules about values, both deliberate. A control's own value is read only
// for a push button (`submit`, `button`, `reset`), whose value *is* its label,
// and never for a field the shared sensitivity rule marks sensitive. Text is
// read only for elements whose role takes its name from content, so a
// container never acquires a name made of the first words inside it.

import { isSensitiveFormControl } from "../element-traits";
import { boundedText } from "./bounded-text";
import { associatedLabel } from "./label";

const MAX_NAME_LENGTH = 200;
const MAX_LABELLEDBY_IDS = 8;
const BUTTON_INPUT_TYPES = new Set(["submit", "button", "reset"]);
const NAME_FROM_CONTENT_TAGS = new Set([
  "a", "button", "summary", "h1", "h2", "h3", "h4", "h5", "h6",
  "th", "td", "li", "label", "legend", "option", "caption", "figcaption", "dt", "dd"
]);
const NAME_FROM_CONTENT_ROLES = new Set([
  "button", "link", "menuitem", "menuitemcheckbox", "menuitemradio", "option", "tab",
  "heading", "treeitem", "gridcell", "cell", "columnheader", "rowheader", "row",
  "switch", "checkbox", "radio", "tooltip", "listitem"
]);

/** The element's accessible name, or `undefined` when the page gave it none. */
export function accessibleNameFor(element: Element): string | undefined {
  return labelledByName(element)
    ?? boundedText(element.getAttribute("aria-label"), MAX_NAME_LENGTH)
    ?? associatedLabel(element)
    ?? boundedText(element.getAttribute("title") ?? element.getAttribute("alt"), MAX_NAME_LENGTH)
    ?? boundedText(element.getAttribute("placeholder"), MAX_NAME_LENGTH)
    ?? buttonValueName(element)
    ?? nameFromContent(element);
}

/**
 * The name the page wrote on the element itself. This is the narrow signal the
 * snapshot judges an element's identity by, and it is deliberately not the
 * computed name: a snapshot asks whether the author named this element, not
 * whether a name can be derived for it.
 */
export function authoredNameAttribute(element: Element): string | undefined {
  return element.getAttribute("aria-label")
    ?? element.getAttribute("title")
    ?? element.getAttribute("alt")
    ?? undefined;
}

/** The text of the elements `aria-labelledby` points at, in the order it lists them. */
function labelledByName(element: Element): string | undefined {
  const ids = (element.getAttribute("aria-labelledby") ?? "").split(/\s+/u).filter(Boolean).slice(0, MAX_LABELLEDBY_IDS);
  if (!ids.length) return undefined;
  const parts = ids.flatMap((id) => {
    const target = document.getElementById(id);
    const text = target === element ? undefined : boundedText(target?.textContent, MAX_NAME_LENGTH);
    return text ? [text] : [];
  });
  return boundedText(parts.join(" "), MAX_NAME_LENGTH);
}

/** A push button's value is its label; a sensitive field's value is never a name. */
function buttonValueName(element: Element): string | undefined {
  if (!(element instanceof HTMLInputElement)) return undefined;
  if (!BUTTON_INPUT_TYPES.has(element.type.toLowerCase())) return undefined;
  if (isSensitiveFormControl(element)) return undefined;
  return boundedText(element.value, MAX_NAME_LENGTH);
}

function nameFromContent(element: Element): string | undefined {
  return supportsNameFromContent(element) ? boundedText(element.textContent, MAX_NAME_LENGTH) : undefined;
}

function supportsNameFromContent(element: Element): boolean {
  if (element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) return false;
  if (element instanceof HTMLElement && element.isContentEditable) return false;
  const role = element.getAttribute("role")?.trim().toLowerCase();
  if (role) return NAME_FROM_CONTENT_ROLES.has(role);
  return NAME_FROM_CONTENT_TAGS.has(element.tagName.toLowerCase());
}
