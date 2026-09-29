// The control inside an overlay that closes it.
//
// Two answers off one scan, and they are deliberately not the same answer.
//
// `hasDismissalControl` is the classification question -- does this layer carry
// its own way out, and so count as a dialog rather than as an ordinary banner?
// It is what `blocking-dialog.ts` has asked since it was written, and its
// answer decides which failure code a refusal reports. Narrowing it would move
// refusals between codes, so it is kept exactly as it was: a painted element
// inside the overlay whose own label, attribute or text says "close".
//
// `dismissControlIn` is the *press* question, and it is stricter, because
// pressing is an act and classifying is not. Two candidates the classifier
// counts are refused here:
//
// - **A disabled control.** Pressing it does nothing, and the loop would spend
//   its whole ladder on an overlay it was never going to clear.
// - **A link that leaves the document.** "Not now" is sometimes an anchor to an
//   app store. Following it would take the run off the page it was working on,
//   which is a worse outcome than the dialog it was clearing. A fragment, a
//   `javascript:` href and a link back to the same address stay in place, so
//   those are allowed.
//
// The scan is bounded (`DISMISS_SCAN_LIMIT`) because an overlay can hold a
// whole page's worth of markup, and a defence that walks ten thousand elements
// on every refused action is its own kind of failure. Only leaf elements are
// read for text, so the dialog's own outer `<div>` -- whose `textContent` is
// every word in it -- can never be mistaken for a control.

import { composedDescendants } from "../../shadow-dom";
import { isDismissalLabel } from "./vocabulary";

/** At most this many elements of one overlay are read for a way out. */
const DISMISS_SCAN_LIMIT = 400;

/**
 * Whether the overlay carries a painted control whose own label closes or
 * declines it. The classification question: it decides whether a layer is a
 * dialog at all.
 */
export function hasDismissalControl(overlay: Element): boolean {
  return firstDismissal(overlay, false) !== undefined;
}

/**
 * The control to press to clear this overlay, or `undefined` when it has none
 * that may be pressed. The press question, and stricter than the classifier for
 * the two reasons the file comment gives.
 */
export function dismissControlIn(overlay: Element): Element | undefined {
  return firstDismissal(overlay, true);
}

function firstDismissal(overlay: Element, pressable: boolean): Element | undefined {
  let scanned = 0;
  // Into the overlay's open shadow roots too: a widget's close glyph lives in
  // one as often as not. The bound and the vocabulary are unchanged, so a
  // consent wall offering only Accept and Reject still has no way out here.
  for (const element of composedDescendants(overlay)) {
    if (++scanned > DISMISS_SCAN_LIMIT) return undefined;
    if (element.getClientRects().length === 0) continue;
    if (!saysDismissal(element)) continue;
    if (pressable && !mayBePressed(element)) continue;
    return element;
  }
  return undefined;
}

/** Whether this element's own attribute, name or text says it closes what it sits in. */
function saysDismissal(element: Element): boolean {
  if (element.hasAttribute("data-dismiss") || element.hasAttribute("data-bs-dismiss")) return true;
  const named = (element.getAttribute("aria-label") ?? element.getAttribute("title") ?? "").trim();
  if (named && isDismissalLabel(named)) return true;
  // Only a leaf: an ancestor's `textContent` is everything below it, so reading
  // one would let a dialog whose body happens to end in "Close" be pressed at
  // its outermost element.
  if (element.childElementCount > 0) return false;
  const text = (element.textContent ?? "").replace(/\s+/gu, " ").trim();
  return text.length > 0 && isDismissalLabel(text);
}

/** Whether pressing this element can do what it says: enabled, and not a link away from here. */
function mayBePressed(element: Element): boolean {
  if (isDisabled(element)) return false;
  return !leavesTheDocument(element);
}

function isDisabled(element: Element): boolean {
  const control = element as Element & { disabled?: unknown };
  if (control.disabled === true) return true;
  return element.closest('[disabled],[aria-disabled="true"],fieldset[disabled]') !== null;
}

/**
 * Whether pressing this would follow a link to another address. The anchor is
 * looked for on the element or above it, because a close glyph is usually a
 * `<span>` inside the `<a>` that carries the href.
 */
function leavesTheDocument(element: Element): boolean {
  const anchor = element.closest("a[href]") as (Element & { href?: unknown; protocol?: unknown }) | null;
  if (!anchor || typeof anchor.href !== "string" || anchor.href.length === 0) return false;
  if (anchor.protocol === "javascript:") return false;
  const here = element.ownerDocument.location?.href;
  if (typeof here !== "string") return true;
  // A fragment link stays on this document; anything else is another address.
  return anchor.href.split("#")[0] !== here.split("#")[0];
}
