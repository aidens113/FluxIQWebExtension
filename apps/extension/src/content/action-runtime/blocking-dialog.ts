// What stands over the page when a target was refused as covered or inert, and
// which side of one line it falls on: a dialog recovery may deal with, or a
// challenge only a person may answer.
//
// The line is drawn on what the page declares, never on which site it is.
//
// - **Which dialog.** A dialog the page declares modal and the browser is
//   painting -- `aria-modal="true"`, or a `<dialog>` opened with
//   `showModal()` -- stands over the whole page by contract, so a covered or
//   inert target on that page is behind it. A target that is `covered` may
//   also be covered by a dialog that declares no modality: the layer at the
//   point the hit test landed on counts when it declares a dialog role, or
//   when it is a fixed overlay that carries its own way out -- a close
//   control, "Not now", "No thanks". A banner with neither is not a dialog,
//   so a cookie banner over the target stays an ordinary refusal.
// - **Which side.** A dialog that asks for what only a person can give -- a
//   robot check, a credential or second-factor code, a payment confirmation
//   (`challenge-evidence.ts`) -- is the person's. Every other dialog is not:
//   a promotion, a survey, a notifications prompt, an offer, a confirmation
//   the Flow itself opened. It is the page in a state the step did not
//   expect, and answering or closing it is a move recovery can make and the
//   user's permissions still govern.
//
// Every painted modal is read for a challenge, not only the top one, because
// the one mistake this must never make is offering a robot check to a model as
// a dialog to close.
//
// **What it does not claim.** In the inert shape there is no hit point, so a
// target that is hidden for its own reasons on a page with a painted modal is
// put down to the modal. A cookie banner is not a dialog here: its way out is a
// choice about the person's data, so a refusal under one stays ACTION_REJECTED.
// And nothing here refuses an action aimed *inside* a challenge -- it explains
// a refusal, it does not make one. What keeps a robot check unanswered is that
// Core never offers USER_INTERVENTION_REQUIRED to a model, and that a model
// exploring the page is told `needs_person` rather than `blocked_by_dialog`.
//
// Until 2026-09-21 every painted modal was the person's. Live on the auction
// marketplace, the app promotion that opens a few seconds after each page load
// -- it has its own "Not now" and close glyph -- stopped a replayed Flow at its
// first press as `user_intervention_required`, and Core, rightly for that
// category, refused to ask the model how to get past it; the repair that run
// existed to test never began.

import { challengeIn, type ChallengeKind } from "./challenge-evidence";

type Point = { x: number; y: number };

/** The dialog in the way, by the side of the line it is on. */
export type BlockingDialog =
  | { kind: "dismissible"; sentence: string }
  | { kind: "person"; challenge: ChallengeKind; sentence: string };

/**
 * The dialog that explains a refusal, or `undefined` when no dialog does.
 *
 * `reason` is the refusal's word; only `covered` and `hidden` can be a dialog's
 * doing (`disabled`, `not_checkable` and the rest describe the target itself).
 * `blockedAt` is where the hit test landed on something other than the target,
 * which only a `covered` refusal has.
 */
export function blockingDialog(reason: string, blockedAt?: Point): BlockingDialog | undefined {
  if (reason !== "covered" && reason !== "hidden") return undefined;
  const modals = renderedModals();
  const layer = reason === "covered" && blockedAt ? coveringDialog(blockedAt) : undefined;
  const dialogs = layer && !modals.includes(layer) ? [...modals, layer] : modals;
  if (dialogs.length === 0) return undefined;
  for (const dialog of dialogs) {
    const challenge = challengeIn(dialog, "dialog");
    if (challenge) return { kind: "person", challenge, sentence: `${CHALLENGE_WORDS[challenge]} is open over the page, so a person has to answer it before the run can continue` };
  }
  return { kind: "dismissible", sentence: "a dialog is open over the page and asks for nothing only a person can give, so it has to be answered or closed before the target can be reached" };
}

const CHALLENGE_WORDS: Readonly<Record<ChallengeKind, string>> = Object.freeze({
  captcha: "a robot check",
  credential: "a request for a password or a verification code",
  payment: "a payment confirmation"
});

/** A dialog the page declares, open or not; which of them is painted is asked separately. */
const DIALOG_SELECTOR = '[role="dialog"], [role="alertdialog"], [aria-modal="true"], dialog[open]';

/** At most this many elements of one overlay are read for a way out. */
const DISMISS_SCAN_LIMIT = 400;

/** Longer text than this is prose that happens to start with a dismissal word, not a control's label. */
const DISMISS_LABEL_MAX = 48;

/**
 * A control's own label that closes or declines what it sits on. Accepting or
 * rejecting cookies is a choice about the person's data, not a way out, so it
 * is deliberately not here.
 */
const DISMISS_LABEL = /^(?:close|dismiss|hide|not now|no,? thanks?|no thank you|maybe later|remind me later|later|skip|not interested|continue without)(?:$|[\s,.!:;-])/iu;

/** A close glyph used as a whole label. */
const CLOSE_GLYPH = /^[×✕✖╳xX]$/u;

/** Every modal the page declares and the browser paints: ARIA's first, then `<dialog>`s opened with `showModal()`. */
function renderedModals(): Element[] {
  const modals = painted('[aria-modal="true"]');
  // `:modal` is asked about before it is used, because an engine without it
  // would throw on the selector rather than match nothing.
  if (!modalPseudoClassSupported()) return modals;
  for (const element of painted("dialog:modal")) {
    if (!modals.includes(element)) modals.push(element);
  }
  return modals;
}

function modalPseudoClassSupported(): boolean {
  return typeof CSS !== "undefined" && typeof CSS.supports === "function" && CSS.supports("selector(dialog:modal)");
}

/** What matches a selector this module wrote and has a box on screen. */
function painted(selector: string): Element[] {
  return [...document.querySelectorAll(selector)].filter((element) => element.getClientRects().length > 0);
}

/**
 * The dialog layer that lies over `point`, when what the hit test landed on is
 * one: inside an element that declares a dialog role, or inside a fixed
 * overlay -- a scrim -- that holds a declared dialog or its own way out.
 */
function coveringDialog(point: Point): Element | undefined {
  const hit = document.elementFromPoint(point.x, point.y);
  if (!hit) return undefined;
  const declared = hit.closest(DIALOG_SELECTOR);
  if (declared) return declared;
  const overlay = outermostFixed(hit);
  if (!overlay) return undefined;
  const inner = overlay.querySelector(DIALOG_SELECTOR);
  if (inner && inner.getClientRects().length > 0) return inner;
  return hasWayOut(overlay) ? overlay : undefined;
}

/** The outermost ancestor-or-self below `<body>` that is fixed to the viewport: an overlay's own root. */
function outermostFixed(element: Element): Element | undefined {
  const view = element.ownerDocument.defaultView;
  if (!view) return undefined;
  let found: Element | undefined;
  for (let current: Element | null = element; current && current !== element.ownerDocument.body && current !== element.ownerDocument.documentElement; current = current.parentElement) {
    const position = view.getComputedStyle(current).position;
    if (position === "fixed" || position === "sticky") found = current;
  }
  return found;
}

/** Whether the overlay carries a painted control whose own label closes or declines it. */
function hasWayOut(overlay: Element): boolean {
  let scanned = 0;
  for (const element of overlay.querySelectorAll("*")) {
    if (++scanned > DISMISS_SCAN_LIMIT) return false;
    if (element.getClientRects().length === 0) continue;
    if (element.hasAttribute("data-dismiss") || element.hasAttribute("data-bs-dismiss")) return true;
    const named = (element.getAttribute("aria-label") ?? element.getAttribute("title") ?? "").trim();
    if (named && isDismissal(named)) return true;
    if (element.childElementCount > 0) continue;
    const text = (element.textContent ?? "").replace(/\s+/gu, " ").trim();
    if (text && isDismissal(text)) return true;
  }
  return false;
}

function isDismissal(label: string): boolean {
  return label.length <= DISMISS_LABEL_MAX && (CLOSE_GLYPH.test(label) || DISMISS_LABEL.test(label));
}
