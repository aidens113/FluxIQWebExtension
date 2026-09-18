// Whether the exploration may click this, decided semantically.
//
// Decision L3, and it is not negotiable: the destructive refusal is about
// **meaning** -- does this control submit, delete, commit, or send -- and never
// about how closely a candidate resembles something recorded earlier. A
// similarity score can be high for a "Delete" button that sits where "Details"
// used to, and that is precisely the click that must never happen. So there is
// no score here at all: a candidate passes a fixed ladder of rungs, each one a
// statement about what the control is for, and the ladder refuses by default.
//
// The rungs, in the order they are applied and for the reason given:
//
// 1. **Wording that commits.** Submit, delete, remove, pay, send, publish and
//    their relatives, read from the words the control says to a person and
//    decided by `../control-intent/wording.ts`, which the reveal tools ask too,
//    so the two refuse the same words the same way. First, because a control
//    whose own label says it commits is refused whatever else is true of it --
//    including a "Delete" styled as a plain button inside a dialog, which every
//    later rung would wave through.
//
//    It reads the label and never the selector. A selector is this domain's
//    address for an element, assembled from the test ids of every ancestor
//    above it, and reading it made an order-management fixture impossible to
//    explore: every row sits under `[data-testid="order-rows"]`, so the word
//    "order" refused every control in the table.
// 2. **A control that submits.** `type="submit"`, an input of that type, or a
//    submit role. Structural, not verbal: an unlabelled submit button carries
//    no committing word to catch at rung 1.
// 3. **A control the page has put in a form.** Exploration never drives a form.
//    A button inside one is a submit candidate by default, and the exception --
//    a close button that happens to live inside the form element -- is not
//    worth the class of accident the allowance would open.
// 4. **Something that is actually a control for showing or dismissing.** An
//    allowlist of tags and roles, so anything unrecognised is refused rather
//    than reasoned about.
// 5. **Identity, with corroboration (L3's second clause).** A candidate with an
//    identifier -- an accessible name or visible text -- needs one agreeing
//    signal. A candidate **missing only that identifier** needs two. An
//    unlabelled button is the shape an accident takes: there is nothing to read,
//    so the only honest basis for clicking it is several independent things
//    about the page agreeing that it dismisses something.
//
// Nothing here consults a fingerprint, a score or a recorded element.

import { webControlWording } from "../control-intent";
import type { ResolvedWebLlmEvidenceElement } from "../elements";
import type { WebLlmPageEvidence } from "../sanitize";
import type { WebLlmToolRejectionCode } from "../tool-rejection";

/** Wording that means the control puts something away without committing it. */
export const WEB_RECOVERY_DISMISSAL_WORDS = /\b(?:close|dismiss|cancel|back|later|skip|no thanks|not now|got it|understood|continue browsing)\b/iu;

/**
 * One independent thing about the page that agrees this control dismisses or
 * reveals.
 *
 * "It is a button" is deliberately **not** on this list, although it was on the
 * first draft. Rung 4 already requires an actionable control, so counting it
 * again would let every named button in the document clear rung 5 on a fact
 * that had already been used -- a corroboration requirement that corroborates
 * nothing. Each signal here is something rung 4 does not already know.
 */
export type WebRecoveryActionSignal =
  | "dismissal_wording"
  | "modal_dialog"
  | "dialog_landmark"
  | "reversible_disclosure"
  | "view_switch";

/** Which rung refused, so a refusal says what about the candidate was wrong. */
export type WebRecoverySafetyRung =
  | "committing_wording"
  | "submit_control"
  | "form_owned"
  | "not_an_actionable_control"
  | "unidentified_without_corroboration";

export type WebRecoveryActionVerdict =
  | { ok: true; identified: boolean; signals: WebRecoveryActionSignal[] }
  | { ok: false; code: WebLlmToolRejectionCode; rung: WebRecoverySafetyRung };

const ACTIONABLE_ROLES = new Set(["button", "tab", "menuitem", "treeitem"]);
const ACTIONABLE_TAGS = new Set(["button", "summary"]);

/**
 * Whether the exploration may click this element, and on what basis.
 *
 * The verdict carries the signals that cleared it rather than only a boolean,
 * so a caller -- and a reader of a Lab transcript a week later -- can see what
 * the decision rested on. A refusal carries the rung, never the element.
 */
export function webRecoverySafeActionVerdict(element: ResolvedWebLlmEvidenceElement, page: WebLlmPageEvidence): WebRecoveryActionVerdict {
  // A command given to the page, whatever it is: this option never presses a
  // link, so a label is read as an instruction rather than as a destination.
  if (webControlWording(element, "command") === "commits") return { ok: false, code: "target_unsafe", rung: "committing_wording" };
  if (element.controlType === "submit" || element.inputType === "submit" || element.role === "submit") {
    return { ok: false, code: "target_unsafe", rung: "submit_control" };
  }
  if (element.form !== undefined || element.tag === "form") return { ok: false, code: "target_unsafe", rung: "form_owned" };
  if (!isActionableControl(element)) return { ok: false, code: "target_unsafe", rung: "not_an_actionable_control" };

  const identified = Boolean(element.name) || Boolean(element.text);
  const signals = agreeingSignals(element, page);
  // L3: an identifier alone is not a licence, and its absence raises the bar
  // rather than lowering it. One agreeing signal normally; two when there is
  // nothing to read on the control itself.
  if (signals.length < (identified ? 1 : 2)) return { ok: false, code: "target_unsafe", rung: "unidentified_without_corroboration" };
  return { ok: true, identified, signals };
}

function isActionableControl(element: ResolvedWebLlmEvidenceElement): boolean {
  if (ACTIONABLE_TAGS.has(element.tag)) return true;
  if (element.role !== undefined && ACTIONABLE_ROLES.has(element.role)) return true;
  return element.tag === "input" && (element.controlType === "button" || element.inputType === "button");
}

function agreeingSignals(element: ResolvedWebLlmEvidenceElement, page: WebLlmPageEvidence): WebRecoveryActionSignal[] {
  const signals: WebRecoveryActionSignal[] = [];
  const wording = [element.name, element.text].filter(Boolean).join(" ");
  if (wording && WEB_RECOVERY_DISMISSAL_WORDS.test(wording)) signals.push("dismissal_wording");
  // Page-level, and independent of anything the element says about itself:
  // something really is painted over the page and really does need dismissing.
  if (page.dialogs?.some((dialog) => dialog.modal === true) || page.blockedBy !== undefined) signals.push("modal_dialog");
  if (element.landmark === "dialog" || element.landmark === "alertdialog") signals.push("dialog_landmark");
  // A disclosure toggles; clicking it again undoes it, which is the one shape
  // of change that costs nothing to be wrong about.
  if (element.revealKind === "disclosure") signals.push("reversible_disclosure");
  // Switching which view is shown is a statement about meaning, not a guess:
  // a tab, a menu item or a tree item changes what is displayed and commits
  // nothing.
  if (element.revealKind === "view" && element.role !== undefined && ACTIONABLE_ROLES.has(element.role) && element.role !== "button") signals.push("view_switch");
  return signals;
}
