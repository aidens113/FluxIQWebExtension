// Which dialog a control sits in, and whether a candidate sits in the same one.
//
// ## The defect this closes (t469)
//
// Lane D round 8 (`run-mv5jnc5m-a47c3e59`, playback step 0062): a step saved
// against the chat panel's "Close chat" ✕ was replayed after the chat had gone
// and the notifications prompt had come up. Its selector missed, and Level 2
// scored the page's buttons against the saved fingerprint -- `div`, role
// `button`, text "✕", name "Close chat". The prompt's own ✕ (name "Close")
// agreed on the tag, the role, the class family and the text exactly, scored
// 0.729 against a runner-up of 0.113, passed corroboration on its "✕", and was
// pressed (t465's headed replay proved it). Nothing in the fingerprint said the
// control belonged to a chat panel: a dialog is not a landmark
// (`context.ts`), so the saved `context` carried nothing about it at all.
//
// Two dialogs' close buttons are the same control by every signal a
// fingerprint holds, the way two rows' actions are (`record.ts`). What tells
// them apart is what is around them -- here, which dialog. So a control that
// sits in a dialog carries that dialog's name as `context.dialog`, and both
// acting paths refuse a candidate in a dialog of another name, or in none.
//
// ## A gate, not a weight
//
// As `record.ts` argues for rows: two dialogs either are the same dialog or
// they are not, and a candidate in another one is not the recorded control at
// any score. Core's matcher has no structural signal to weigh it by, and a
// weight would only have to be outscored -- which the ✕ above did by 0.6.
//
// ## What names a dialog
//
// Its accessible name, as the page gave it (`aria-labelledby`, `aria-label`,
// `title`): "Chat with Elena Sokolova", "Turn on notifications?". Failing one,
// the words of the first heading inside it, which is how a person names a
// dialog its author never labelled. A dialog with neither gets no name and the
// control records nothing: there is nothing to compare, and inventing a name
// -- a position, a class -- would refuse a re-render that is right.
//
// A re-rendered dialog keeps its name, so a control in it still resolves: the
// name is read from the page each time, never from the element's identity in
// memory. A dialog whose name changes between capture and replay -- a count in
// its title -- is refused; that refusal reaches the automation loop, which can
// look at the page and repair the step, where a press on another dialog's
// control reports success and reaches nobody.
//
// ## What counts as a dialog
//
// A `<dialog>`, an element whose role is `dialog` or `alertdialog`, or one the
// author marked `aria-modal="true"` -- the same three the page evidence lists
// as dialogs (`../evidence/dialogs.ts`). Read by tag and attribute rather than
// by a selector, so a hand-built tree in a unit test answers the same way a
// page does. The nearest one wins, across open shadow roots, and the element
// itself counts: a recorded press on a dialog *is* in that dialog.
//
// ## Who is unaffected
//
// A control in no dialog records nothing, so its replay is gated by nothing
// here -- the same as before t469. A recording made before t469 carries no
// `dialog`, and is gated by nothing either.

import { composedParent } from "../shadow-dom";
import { textOutsideSensitiveControls } from "../sensitive-text";
import { accessibleNameFor } from "./accessible-name";
import { normalizedText } from "./normalized-text";

/** How far up a dialog may be. A control is inside its dialog's body, not forty levels below it. */
const MAX_DIALOG_DEPTH = 40;
/** Nodes walked looking for an unlabelled dialog's first heading. A dialog's title comes early in it. */
const MAX_HEADING_NODES = 200;

const DIALOG_ROLES: ReadonlySet<string> = new Set(["dialog", "alertdialog"]);
const HEADING_TAGS: ReadonlySet<string> = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);

/**
 * The name of the dialog the element sits in, or `undefined` when it sits in
 * none, or in one that names nothing a person would read.
 */
export function dialogName(element: Element): string | undefined {
  const dialog = enclosingDialog(element);
  return dialog ? nameOfDialog(dialog) : undefined;
}

/**
 * Whether `element` sits in the dialog the recording named. `true` when the
 * recording named none -- there is no question to answer -- and `false` when
 * the candidate is in a dialog of another name or in no named dialog at all,
 * which is the fail-closed half: "I cannot tell which dialog this is" is not
 * "it is the right one".
 */
export function agreesWithRecordedDialog(recorded: string | undefined, element: Element): boolean {
  const wanted = normalizedText(recorded);
  if (!wanted) return true;
  return dialogName(element) === wanted;
}

/** The nearest dialog at or above the element, across open shadow roots. */
function enclosingDialog(element: Element): Element | undefined {
  let current: Element | null = element;
  for (let depth = 0; current && depth < MAX_DIALOG_DEPTH; depth += 1) {
    if (isDialog(current)) return current;
    current = composedParent(current);
  }
  return undefined;
}

/** Whether the element is a dialog by its tag, its role, or the author's `aria-modal`. */
function isDialog(element: Element): boolean {
  if (tagOf(element) === "dialog") return true;
  if (attribute(element, "aria-modal")?.trim().toLowerCase() === "true") return true;
  const role = attribute(element, "role")?.trim().toLowerCase().split(/\s+/u)[0];
  return role !== undefined && DIALOG_ROLES.has(role);
}

/** The dialog's accessible name, or failing one, its first heading's words. */
function nameOfDialog(dialog: Element): string | undefined {
  return accessibleNameFor(dialog) ?? firstHeadingWords(dialog);
}

/** The words of the first heading inside the dialog, in document order, less any sensitive control's contents. */
function firstHeadingWords(dialog: Element): string | undefined {
  let budget = MAX_HEADING_NODES;
  const pending: Element[] = elementChildrenInReverse(dialog);
  for (let next = pending.pop(); next && budget > 0; next = pending.pop()) {
    budget -= 1;
    if (HEADING_TAGS.has(tagOf(next)) || attribute(next, "role")?.trim().toLowerCase() === "heading") {
      const words = normalizedText(textOutsideSensitiveControls(next));
      if (words) return words;
    }
    for (const child of elementChildrenInReverse(next)) pending.push(child);
  }
  return undefined;
}

/** An element's element children, last first, so a stack walks them in document order. */
function elementChildrenInReverse(element: Element): Element[] {
  const children = element.children ? [...element.children] : [];
  return children.reverse();
}

/** `getAttribute`, or nothing on a node that has none. */
function attribute(element: Element, name: string): string | undefined {
  return typeof element.getAttribute === "function" ? element.getAttribute(name) ?? undefined : undefined;
}

function tagOf(element: Element): string {
  return element.localName ?? element.tagName?.toLowerCase() ?? "";
}
