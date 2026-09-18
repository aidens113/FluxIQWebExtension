// Whether pressing a control would reveal something or commit something.
//
// Exploration exists to see the page a Flow will act on, and some of that page
// only exists after a press: the composer behind "New post", the bulk actions
// that appear once a row is ticked, a row's menu, the page an order link opens.
// Pressing those changes what is visible and nothing that persists. Pressing
// Send, Save, Delete, Confirm, Refund, Dispatch, Assign or Resolve changes
// state that persists, on somebody's real account. The line is drawn there,
// and only there.
//
// It is decided from what the control is and what it says to a person -- its
// tag and role, whether it submits a form, whether it sits in one, whether a
// dialog is up, and its accessible name -- and never from a selector. The
// parameter type says so: this takes a packet element, which has no selector
// to read.
//
// The order is refusal first. A control whose type submits a form commits
// whatever it says; one whose words commit is refused whatever shape it has, so
// a disclosure named "Delete" is still refused. Only then is the shape asked
// for, and a shape nothing here recognises is `unclear`, which the reveal tool
// refuses too: the allowlist is what keeps an unknown button unpressed, and the
// committing words are a second line, not the only one.

import type { WebLlmEvidenceElement } from "../elements";
import type { WebLlmPageEvidence } from "../sanitize";
import { webControlWording, type WebControlWording } from "./wording";

/** Why a press only reveals. */
export type WebRevealBasis =
  /** A `<summary>`, or a button that says it expands and collapses something (`aria-expanded`, `aria-controls`). */
  | "disclosure"
  /** A tab or tree item: it changes which view is shown. */
  | "view_switch"
  /** A button or menu item whose label opens something: "New post", "Reply", "Edit", "Open order". */
  | "opener"
  /** A checkbox labelled "Select ...": it marks a row, so the actions for chosen rows appear. */
  | "row_selection"
  /** A link to another page of this site: a GET, with no committing word in its label or path. */
  | "page_link"
  /** A control that puts away what it names, or a bare "Close" / "Cancel" while a dialog is up. */
  | "dismissal";

/** Why a press would commit, or might. */
export type WebCommitBasis =
  /** Its label or, for a link, its path says it commits. */
  | "committing_wording"
  /** Its type submits or resets a form. */
  | "submit_control"
  /** It sits in a form, where a button with no type is a submit and a press drives the form. */
  | "form_owned"
  /** A dialog is up, and a button pressed then is one that completes it. */
  | "dialog_open";

export type WebControlIntent =
  | { effect: "reveals"; basis: WebRevealBasis }
  | { effect: "commits"; basis: WebCommitBasis }
  | { effect: "unclear" };

/** What pressing this control would do, read from what it is and what it says. */
export function webControlIntent(element: WebLlmEvidenceElement, page: WebLlmPageEvidence): WebControlIntent {
  if (submitsForm(element)) return { effect: "commits", basis: "submit_control" };
  const leavesPage = linksToAnotherPage(element, page);
  const wording = webControlWording(element, leavesPage ? "destination" : "command");
  if (wording === "commits") return { effect: "commits", basis: "committing_wording" };
  const basis = leavesPage ? "page_link" : revealBasis(element, wording, page);
  if (basis === undefined) return { effect: "unclear" };
  if (element.form !== undefined && !safeInsideForm(element, basis)) return { effect: "commits", basis: "form_owned" };
  // In a dialog, or with a modal one up, only a disclosure, a tab or a
  // dismissal is pressed: a dialog's other buttons are the ones that finish
  // what it asked.
  if (askedToFinishADialog(element, page) && (basis === "opener" || basis === "row_selection" || basis === "page_link")) return { effect: "commits", basis: "dialog_open" };
  return { effect: "reveals", basis };
}

function revealBasis(element: WebLlmEvidenceElement, wording: WebControlWording, page: WebLlmPageEvidence): WebRevealBasis | undefined {
  if (element.tag === "summary") return "disclosure";
  if (element.revealKind === "disclosure" && pressable(element)) return "disclosure";
  if (element.role === "tab" || element.role === "treeitem") return "view_switch";
  if (isCheckbox(element)) return wording === "selects" ? "row_selection" : undefined;
  if (!pressable(element) && element.role !== "menuitem" && !linksToThisPage(element, page)) return undefined;
  if (wording === "opens") return "opener";
  if (wording === "dismisses" || (wording === "dismisses_whatever_is_open" && somethingIsOverThePage(page))) return "dismissal";
  return undefined;
}

/** `type="submit"`, `"reset"` or an image input, which submits where it is clicked. */
function submitsForm(element: WebLlmEvidenceElement): boolean {
  return [element.controlType, element.inputType].some((type) => type === "submit" || type === "reset" || type === "image") || element.role === "submit";
}

/**
 * Inside a form only a link, or a disclosure or tab that says it is not a
 * submit, is safe to press. A `<button>` with no `type` in a form is a submit
 * button, whatever it looks like.
 */
function safeInsideForm(element: WebLlmEvidenceElement, basis: WebRevealBasis): boolean {
  if (basis === "page_link") return true;
  if (basis !== "disclosure" && basis !== "view_switch") return false;
  return element.tag !== "button" || element.controlType === "button";
}

function pressable(element: WebLlmEvidenceElement): boolean {
  if (element.tag === "button" || element.role === "button") return true;
  return element.tag === "input" && (element.controlType === "button" || element.inputType === "button");
}

function isCheckbox(element: WebLlmEvidenceElement): boolean {
  return (element.tag === "input" && element.inputType === "checkbox") || element.role === "checkbox";
}

function isLink(element: WebLlmEvidenceElement): boolean {
  return element.tag === "a" || element.role === "link";
}

/**
 * A link the packet says goes to another page of this site. The packet keeps a
 * link's `href` only when it stays on the page's origin, as origin and path.
 */
function linksToAnotherPage(element: WebLlmEvidenceElement, page: WebLlmPageEvidence): boolean {
  return isLink(element) && element.href !== undefined && element.href !== page.location;
}

/** `href="#"` and the like: an anchor that stays here, and so behaves as a button does. */
function linksToThisPage(element: WebLlmEvidenceElement, page: WebLlmPageEvidence): boolean {
  return isLink(element) && element.href === page.location;
}

/**
 * A modal dialog is up, or this control is inside a dialog.
 *
 * `page.blockedBy` is deliberately not read. It says some ranked control is
 * painted over by something, which a sticky header or a sidebar does on an
 * ordinary dashboard; the recovery ladder reads it as one weak signal among
 * several that a dismissal is wanted, and reading it here as "a dialog is up"
 * would refuse every opener on every page that has a fixed header.
 */
function askedToFinishADialog(element: WebLlmEvidenceElement, page: WebLlmPageEvidence): boolean {
  return dialogIsOpen(page) || element.landmark === "dialog" || element.landmark === "alertdialog";
}

function dialogIsOpen(page: WebLlmPageEvidence): boolean {
  return page.dialogs?.some((dialog) => dialog.modal === true) === true;
}

/**
 * Something really is painted over the page: a dialog, or the blocker the
 * capture hit-tested. Read only to let a bare "Close" through, which is the
 * direction this fact honestly supports -- there is something to close.
 */
function somethingIsOverThePage(page: WebLlmPageEvidence): boolean {
  return dialogIsOpen(page) || page.blockedBy !== undefined;
}
