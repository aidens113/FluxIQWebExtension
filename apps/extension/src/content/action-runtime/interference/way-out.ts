// The control inside an overlay that closes it.
//
// Two answers off one scan, and they are deliberately not the same answer.
//
// `hasDismissalControl` is the classification question -- does this layer carry
// its own way out, and so count as a dialog rather than as an ordinary banner?
// It is what `blocking-dialog.ts` has asked since it was written, and its
// answer decides which failure code a refusal reports: a painted element inside
// the overlay whose own label, attribute or text says "close", or, since
// 2026-09-30, on a layer whose own text is about cookies or consent, one that
// declines optional cookies (`vocabulary.ts`). So a consent wall over a target
// is now `blocked_by_dialog`, which the defence clears, not an ordinary refusal.
// Likewise a notice that the page refused a press for going too fast, whose OK
// closes it and confirms nothing: on such a layer, and on no other, OK is its
// way out (`layer-text.ts` reads the layer's own words for both questions).
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
// - **A control whose press acts** (`press-guard/`, t401): one that
//   submits a form or toggles a state of its own, or whose own name, or the
//   name of the button around it, retries, confirms, accepts or goes on. The
//   label that admitted it is a way out; the control it is part of may not be.
//
// The scan is bounded (`DISMISS_SCAN_LIMIT`) because an overlay can hold a
// whole page's worth of markup, and a defence that walks ten thousand elements
// on every refused action is its own kind of failure. Only leaf elements are
// read for text, so the dialog's own outer `<div>` -- whose `textContent` is
// every word in it -- can never be mistaken for a control.

import { composedDescendants } from "../../shadow-dom";
import { actsOnPress } from "./press-guard";
import { boundedLayerText } from "./layer-text";
import { isConsentDeclineLabel, isConsentLayerText, isDismissalLabel, isRateLimitAcknowledgeLabel, isRateLimitLayerText } from "./vocabulary";

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

/**
 * A close glyph or dismissal first; failing that, on a layer whose own text is
 * about cookies or consent, the control that declines optional cookies
 * (`vocabulary.ts` says why declining, and never accepting, is a way out); and
 * on a layer whose own text says the page refused an act for going too fast,
 * the control that acknowledges it -- its OK -- and never its "Try again".
 */
function firstDismissal(overlay: Element, pressable: boolean): Element | undefined {
  // Into the overlay's open shadow roots too: a widget's close glyph lives in
  // one as often as not.
  const closing = firstMatching(overlay, pressable, saysDismissal);
  if (closing) return closing;
  const text = boundedLayerText(overlay);
  if (isConsentLayerText(text)) {
    const declining = firstMatching(overlay, pressable, saysConsentDecline);
    if (declining) return declining;
  }
  if (!isRateLimitLayerText(text)) return undefined;
  return firstMatching(overlay, pressable, saysRateLimitAcknowledge);
}

function firstMatching(overlay: Element, pressable: boolean, says: (element: Element) => boolean): Element | undefined {
  let scanned = 0;
  for (const element of composedDescendants(overlay)) {
    if (++scanned > DISMISS_SCAN_LIMIT) return undefined;
    if (element.getClientRects().length === 0) continue;
    if (!says(element)) continue;
    if (pressable && !mayBePressed(element)) continue;
    return element;
  }
  return undefined;
}

/** Whether this element's own name or text declines optional cookies. Leaves only, as for a dismissal. */
function saysConsentDecline(element: Element): boolean {
  return ownLabelSays(element, isConsentDeclineLabel);
}

/** Whether this element's own name or text acknowledges a rate-limit notice. Leaves only, as for a dismissal. */
function saysRateLimitAcknowledge(element: Element): boolean {
  return ownLabelSays(element, isRateLimitAcknowledgeLabel);
}

/** The element's accessible name, or -- for a leaf only -- its text, read by one label rule. */
function ownLabelSays(element: Element, rule: (label: string) => boolean): boolean {
  const named = (element.getAttribute("aria-label") ?? element.getAttribute("title") ?? "").trim();
  if (named && rule(named)) return true;
  if (element.childElementCount > 0) return false;
  const text = (element.textContent ?? "").replace(/\s+/gu, " ").trim();
  return text.length > 0 && rule(text);
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

/** Whether pressing this element can do what it says, and only that: enabled, not a link away from here, and not a control whose press acts. */
function mayBePressed(element: Element): boolean {
  if (isDisabled(element)) return false;
  if (leavesTheDocument(element)) return false;
  return !actsOnPress(element);
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
