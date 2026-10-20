// The name a person would use for an element, computed in the order the
// accessible-name calculation uses: `aria-labelledby`, `aria-label`, an
// associated `<label>`, `title`/`alt`, an `<svg>`'s own `<title>` child,
// `placeholder`, a button's value, then the element's own content -- its text
// and the names of the drawings in it. Core's fingerprint weights `accessibleName` as
// heavily as a stable id (24 against testId's 28), so a control whose selector
// drifts is still recognisable by its name (Phase 1.3).
//
// Two rules about values, both deliberate. A control's own value is read only
// for a push button (`submit`, `button`, `reset`), whose value *is* its label,
// and never for a field the shared sensitivity rule marks sensitive. Text is
// read only for elements whose role takes its name from content, so a
// container never acquires a name made of the first words inside it.
//
// And one rule about contents (decision D2 of the data-extraction plan). Both
// places this computation reads page text -- each `aria-labelledby` reference,
// and the element's own text -- read through `textOutsideSensitiveControls`
// (`../sensitive-text.ts`), so no name quotes what a sensitive control holds: a
// sensitive `<textarea>`'s text, a sensitive `<select>`'s option labels, the
// words in an element the rule marks. A reference holding one contributes its
// other words, and an element that is, or sits inside, a sensitive control
// takes no name from content. The filter lives here rather than with each
// caller so every caller has it: the descriptor, page evidence, and the
// resolver's candidates. An associated `<label>`'s text is `label.ts`'s, which
// skips nested form controls.
//
// The name is whole (t200): it was cut to 200 characters, so a consent wall's
// long button label or a heading-named region reached the model as a fragment.
// `MAX_LABELLEDBY_IDS` bounds the search for a name, not the name found: a
// reference list longer than eight ids names nothing a person would read.
//
// A name from content takes an embedded drawing's name in its place (l1 D5),
// as the accessible-name calculation does for an embedded graphic: a control
// whose only content is an `<svg aria-label="Like">` or an `<svg>` with a
// `<title>` is named by it. Without this a `div[role=button]` that only drew
// its icon reached the domain with no name at all, so the two states of a
// toggle whose icon's label flips ("Like", "Unlike") read as one. The drawing's
// name is the one this module computes for the `<svg>` itself, in the order
// above, so `aria-label` wins over the `<title>` text. An `<svg>` marked
// `aria-hidden="true"`, or inside an element so marked within the one named,
// gives nothing, its `<title>` included. Content holding no `<svg>` reads
// exactly as before, through `textOutsideSensitiveControls`; content holding
// one is walked, with every sensitive control's subtree left out as that
// reader leaves it out.

import { isSensitiveFormControl } from "../element-traits";
import { isWithinSensitiveControl, textOutsideSensitiveControls } from "../sensitive-text";
import { normalizedText } from "./normalized-text";
import { associatedLabel } from "./label";

const MAX_LABELLEDBY_IDS = 8;
const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
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
    ?? normalizedText(element.getAttribute("aria-label"))
    ?? associatedLabel(element)
    ?? normalizedText(element.getAttribute("title") ?? element.getAttribute("alt"))
    ?? svgTitle(element)
    ?? normalizedText(element.getAttribute("placeholder"))
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

/**
 * The text of the elements `aria-labelledby` points at, in the order it lists
 * them, each less any sensitive control's contents.
 */
function labelledByName(element: Element): string | undefined {
  const ids = (element.getAttribute("aria-labelledby") ?? "").split(/\s+/u).filter(Boolean).slice(0, MAX_LABELLEDBY_IDS);
  if (!ids.length) return undefined;
  const parts = ids.flatMap((id) => {
    const target = document.getElementById(id);
    const text = target && target !== element ? normalizedText(textOutsideSensitiveControls(target)) : undefined;
    return text ? [text] : [];
  });
  return normalizedText(parts.join(" "));
}

/**
 * An `<svg>` is named by its own `<title>` child, as the accessible-name
 * calculation names it: the one way an icon drawn inline says what it is.
 */
function svgTitle(element: Element): string | undefined {
  if (element.tagName.toLowerCase() !== "svg") return undefined;
  for (const child of Array.from(element.children)) {
    if (child.tagName.toLowerCase() === "title") return normalizedText(child.textContent);
  }
  return undefined;
}

/** A push button's value is its label; a sensitive field's value is never a name. */
function buttonValueName(element: Element): string | undefined {
  if (!(element instanceof HTMLInputElement)) return undefined;
  if (!BUTTON_INPUT_TYPES.has(element.type.toLowerCase())) return undefined;
  if (isSensitiveFormControl(element)) return undefined;
  return normalizedText(element.value);
}

/**
 * The element's own text, less any sensitive control's contents, for a role
 * that takes its name from content, with each embedded `<svg>` read as its
 * own name (header).
 */
function nameFromContent(element: Element): string | undefined {
  if (!supportsNameFromContent(element)) return undefined;
  if (!holdsDrawing(element)) return normalizedText(textOutsideSensitiveControls(element));
  if (isWithinSensitiveControl(element)) return undefined;
  return normalizedText(contentWithDrawings(element, false));
}

/**
 * The text under `parent` in document order, each `<svg>` replaced by its
 * name (nothing where it is hidden), each sensitive control's subtree left
 * out. A child holding no `<svg>` is read whole by the shared text reader.
 */
function contentWithDrawings(parent: Element, hidden: boolean): string {
  let text = "";
  const children = parent.childNodes;
  for (let index = 0; index < children.length; index += 1) {
    const node = children[index];
    if (!node) continue;
    if (node.nodeType === TEXT_NODE) {
      text += node.nodeValue ?? "";
      continue;
    }
    if (node.nodeType !== ELEMENT_NODE) continue;
    const child = node as Element;
    const childHidden = hidden || child.getAttribute("aria-hidden")?.trim().toLowerCase() === "true";
    if (isDrawing(child)) {
      const name = childHidden ? undefined : accessibleNameFor(child);
      if (name) text += ` ${name} `;
    } else if (!holdsDrawing(child)) {
      text += textOutsideSensitiveControls(child);
    } else if (!isSensitiveFormControl(child)) {
      text += contentWithDrawings(child, childHidden);
    }
  }
  return text;
}

function isDrawing(element: Element): boolean {
  return element.tagName.toLowerCase() === "svg";
}

/**
 * Whether an `<svg>` sits anywhere under `element`. A stand-in element that
 * lists no children -- a Node test's -- holds none, as `sensitive-text.ts`
 * reads one with no child nodes.
 */
function holdsDrawing(element: Element): boolean {
  const children = element.children;
  const count = children?.length ?? 0;
  for (let index = 0; index < count; index += 1) {
    const child = children[index];
    if (child && (isDrawing(child) || holdsDrawing(child))) return true;
  }
  return false;
}

function supportsNameFromContent(element: Element): boolean {
  if (element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) return false;
  if (element instanceof HTMLElement && element.isContentEditable) return false;
  const role = element.getAttribute("role")?.trim().toLowerCase();
  if (role) return NAME_FROM_CONTENT_ROLES.has(role);
  return NAME_FROM_CONTENT_TAGS.has(element.tagName.toLowerCase());
}
