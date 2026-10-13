// Which of a capture's elements a type step has nowhere to type into (t486).
//
// Round 12 build 1 (`run-mv62icw0-2be384b4`): revision 1's s9 typed into
// `t932 "1"`, a quantity the page view printed as plain text. The submission
// was accepted, and only the trial found that a `<span>` holds no typed text.
// So a candidate's type step on such an element is refused at submission
// (`resolve-plan-node.ts`, `web.handle.not_a_field`), naming what the element
// is (`web.handle.target_kind.<kind>`).
//
// The extension types into a text-valued `<input>`, a `<textarea>`, or an
// element the page made editable -- by its own `contenteditable` or by an
// editable host around it (`apps/extension/src/content/actions/type.ts`,
// `holdsText`). Read here from the capture as the page view reads it: an
// element is a field when the view's kind for it is one (`field`,
// `field[search]`, `field:<type>`, a role such as `combobox` included), save a
// file input, or when the nearest element at or above it that says
// `contenteditable` says anything but `false`. A role the view prints as a
// field is taken at its word, so this refuses only what is known wrong.
//
// Everything else is not a field, and says what it is in a closed word
// (`WEB_LLM_NOT_A_FIELD_KINDS`): the view's own kind, `heading` for `h1`-`h6`,
// `file_input` for `field:file`, and `text` for a line with no kind. A kind
// word this list does not know is left alone, as a field.

import type { WebLlmEvidenceElement } from "../elements";
import { attributeValue, webLlmElementKind, webLlmPageTree } from "../page-view";

/** What an element a type step cannot type into is, in the words a refusal names it by (header). */
export const WEB_LLM_NOT_A_FIELD_KINDS = [
  "text", "heading", "link", "button", "select", "checkbox", "radio", "switch", "toggle", "tab",
  "menuitem", "option", "slider", "treeitem", "img", "clickable", "dialog", "layer", "file_input"
] as const;

export type WebLlmNotAFieldKind = (typeof WEB_LLM_NOT_A_FIELD_KINDS)[number];

const KNOWN: ReadonlySet<string> = new Set(WEB_LLM_NOT_A_FIELD_KINDS);
const HEADING = /^h[1-6]$/u;

/** Each element of one capture a type step has nowhere to type into, by handle, with what it is; an element left out is a field (header). */
export function webLlmNotAFieldTargets(elements: readonly WebLlmEvidenceElement[]): ReadonlyMap<string, WebLlmNotAFieldKind> {
  const tree = webLlmPageTree(elements);
  const notFields = new Map<string, WebLlmNotAFieldKind>();
  for (const element of elements) {
    const kind = webLlmElementKind(element);
    if (kind !== undefined && kind.startsWith("field") && kind !== "field:file") continue;
    if (editableHere(element, tree.ancestors(element))) continue;
    const word = kind === undefined ? "text" : HEADING.test(kind) ? "heading" : kind === "field:file" ? "file_input" : kind;
    if (KNOWN.has(word)) notFields.set(element.target, word as WebLlmNotAFieldKind);
  }
  return notFields;
}

/** Whether the nearest of `element` and its ancestors that says `contenteditable` makes it editable. */
function editableHere(element: WebLlmEvidenceElement, ancestors: readonly WebLlmEvidenceElement[]): boolean {
  for (const at of [element, ...ancestors]) {
    const editable = attributeValue(at, "contenteditable");
    if (editable !== undefined) return editable.trim().toLowerCase() !== "false";
  }
  return false;
}
