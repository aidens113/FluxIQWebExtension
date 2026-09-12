// The state snapshot: what the page looks like right now, as a bounded, ranked
// list of elements. Candidates are gathered from the elements the user has
// touched, then the standard controls, then text and media, then a capped sweep
// of everything else; each is kept only if it is visible and carries some
// identity. Ranking puts what the user acted on first, so truncation drops the
// least useful elements rather than an arbitrary tail.
//
// A list of elements is not a picture of a page, so the snapshot also carries
// `evidence`: the dialogs in front of it, what is covering its controls,
// whether it is still loading, its landmarks, what repeats on it, its forms,
// how it was navigated to, and how much of the element list was dropped. Each
// item is gathered by the module in `evidence/` that owns it, and this file
// only asks -- what a snapshot is stays readable here, and a rule for one item
// is read and changed where it lives (Phase 1.4).
//
// One thing the snapshot reads directly is the page selection, and it is the
// one capture path that does not go through `readElementValue`. It therefore
// carries its own sensitivity guard, `capturedSelectionText` at the foot of
// this file, using the same shared rule rather than a second one.

import { compactObject } from "./compact-object";
import { pageEvidence, type SnapshotElementCounts, type SnapshotElementEntry } from "./evidence";
import { currentFrameViewportOffset, isTopFrame } from "./frame-geometry";
import { isEventBackedElement, observedEventElementQueue } from "./event-elements";
import {
  accessibleName,
  describeElement,
  directVisibleText,
  linkHref,
  readElementValue,
  stableElementId,
  visibleText
} from "./describe-element";
import {
  hasVisualMedia,
  isActionableElement,
  isInteractableUiElement,
  isPrimaryControlElement,
  isSemanticTextElement,
  isSensitiveFormControl,
  meaningfulText
} from "./element-traits";
import { visualDocumentBounds } from "./visual-bounds";
import type { DomSnapshot } from "./types";

const MAX_SNAPSHOT_CANDIDATES = 2_000;
const MAX_SNAPSHOT_SCAN_ELEMENTS = 50_000;

export function captureSnapshot(): DomSnapshot {
  const { entries, counts } = snapshotElements();
  // Before the descriptors are read out: the evidence pass sets each one's
  // `changed` and `recentlyInteracted`, and the same objects go on the wire.
  const evidence = pageEvidence(entries, counts);
  const snapshot: DomSnapshot = {
    url: location.href,
    title: document.title,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth, window.innerWidth),
      documentHeight: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight, window.innerHeight),
      devicePixelRatio: window.devicePixelRatio
    },
    frame: compactObject({
      isTop: isTopFrame(),
      viewportOffset: currentFrameViewportOffset()
    }),
    interactiveElements: entries.map((entry) => entry.descriptor),
    evidence
  };
  const focused = document.activeElement instanceof Element ? describeElement(document.activeElement) : undefined;
  if (focused) snapshot.focusedElement = focused;
  const selectedText = capturedSelectionText();
  if (selectedText) snapshot.selectedText = selectedText;
  return snapshot;
}

/** The longest selection the snapshot carries. */
const MAX_SELECTED_TEXT = 2_000;

/**
 * How many candidate controls the selection is tested against before the
 * snapshot gives up and withholds it. A page with more form controls than this
 * is not a page anyone is reading a selection off, and an unbounded scan on
 * every capture is worse than a lost diagnostic.
 */
const MAX_SELECTION_SCAN = 2_000;

/** Every element the shared sensitivity rule could mark. Narrows the scan; the rule still decides. */
const SENSITIVE_CANDIDATE_SELECTOR = "input, textarea, select, [autocomplete], [data-sensitive]";

/**
 * The page selection, unless it came out of -- or reaches into -- a control
 * the shared sensitivity rule protects.
 *
 * This is a leak the value reader cannot close. Every other capture path asks
 * `readElementValue`, which refuses a sensitive control; the selection asks the
 * document, and Chromium's `getSelection().toString()` returns the text
 * selected inside a focused ordinary `<input>`. A select-all in a card field
 * therefore put its value in every snapshot, and from there into durable web
 * state and the LLM evidence packet. It was invisible only because Chromium
 * returns nothing for `type="password"` -- a browser quirk, not a control.
 *
 * Three questions, because one is not enough:
 *
 * 1. The focused control. A text control's internal selection is reported as
 *    text while the selection's anchor and focus nodes point at the control's
 *    *parent*, so the nodes alone cannot see it. This is the live leak.
 * 2. The anchor and focus nodes, and their ancestors -- an element marked
 *    `data-sensitive` may wrap ordinary document text.
 * 3. Any sensitive control the selection's ranges intersect, which catches a
 *    selection that starts outside one and runs into it.
 *
 * Question 3 costs real evidence: a select-all across a login form now yields
 * no `selectedText` at all, even though Chromium would not have put the
 * password field's contents in it. That is deliberate. Whether a range's text
 * includes a form control's value is a per-browser rendering detail, and this
 * extension ships for Chromium/Edge and Firefox; a lost selection is a
 * diagnostic inconvenience, a leaked card number is not.
 *
 * Shadow DOM is out of scope, as it is everywhere else in the recorder: a
 * selection inside a closed shadow root is not reachable from here.
 */
function capturedSelectionText(): string | undefined {
  const selection = window.getSelection();
  const text = selection?.toString();
  if (!selection || !text) return undefined;
  return selectionTouchesSensitiveControl(selection) ? undefined : text.slice(0, MAX_SELECTED_TEXT);
}

function selectionTouchesSensitiveControl(selection: Selection): boolean {
  if (withinSensitiveControl(document.activeElement)) return true;
  if (withinSensitiveControl(selection.anchorNode) || withinSensitiveControl(selection.focusNode)) return true;

  const candidates = document.querySelectorAll(SENSITIVE_CANDIDATE_SELECTOR);
  if (candidates.length > MAX_SELECTION_SCAN) return true;
  const ranges: Range[] = [];
  for (let index = 0; index < selection.rangeCount; index += 1) ranges.push(selection.getRangeAt(index));
  for (const candidate of candidates) {
    if (!isSensitiveFormControl(candidate)) continue;
    if (ranges.some((range) => range.intersectsNode(candidate))) return true;
  }
  return false;
}

/** Whether the node is, or sits inside, a control the shared rule marks. */
function withinSensitiveControl(node: Node | null | undefined): boolean {
  let element = node instanceof Element ? node : node?.parentElement ?? null;
  while (element) {
    if (isSensitiveFormControl(element)) return true;
    element = element.parentElement;
  }
  return false;
}

/**
 * The descriptors the snapshot carries, with the elements they were built from
 * and the counts taken on the way. The counts are what makes truncation
 * visible: without the pre-filter totals a reader cannot tell a page with forty
 * controls from one with four thousand whose tail was dropped.
 */
function snapshotElements(): { entries: SnapshotElementEntry[]; counts: SnapshotElementCounts } {
  const seen = new Set<Element>();
  const { candidates, scanned } = snapshotCandidateElements();
  const included: Element[] = [];
  for (const element of candidates) {
    if (seen.has(element) || !shouldIncludeSnapshotElement(element)) continue;
    seen.add(element);
    included.push(element);
  }
  const entries = included
    .sort((left, right) =>
      snapshotElementBucket(left) - snapshotElementBucket(right) ||
      elementPriority(right) - elementPriority(left) ||
      documentOrder(left, right)
    )
    .slice(0, MAX_SNAPSHOT_CANDIDATES)
    .map((element) => ({ element, descriptor: describeElement(element) }));
  return { entries, counts: { scanned, candidates: candidates.length, matched: included.length } };
}

function snapshotCandidateElements(): { candidates: Element[]; scanned: number } {
  const seen = new Set<Element>();
  const candidates: Element[] = [];
  const add = (element: Element | null | undefined) => {
    if (!element || seen.has(element)) return;
    seen.add(element);
    candidates.push(element);
  };

  for (const element of observedEventElementQueue) {
    if (element.isConnected) add(element);
  }
  for (const element of document.querySelectorAll("a[href],button,input:not([type=hidden]),textarea,select,summary,label,[role=button],[role=link],[role=menuitem],[role=checkbox],[role=radio],[role=tab],[role=switch],[contenteditable=true]")) add(element);
  for (const element of document.querySelectorAll("p,h1,h2,h3,h4,h5,h6,li,td,th,blockquote,dt,dd,figcaption")) add(element);
  for (const element of document.querySelectorAll("img,svg,picture,canvas,video")) add(element);
  let scanned = 0;
  for (const element of document.querySelectorAll("*")) {
    scanned += 1;
    if (scanned > MAX_SNAPSHOT_SCAN_ELEMENTS) break;
    if (!hasElementPresentation(element)) continue;
    add(element);
  }

  return { candidates, scanned };
}

function shouldIncludeSnapshotElement(element: Element): boolean {
  if (element === document.documentElement || element === document.body) return false;
  if (element.closest("script, style, noscript, template")) return false;
  if (element.closest("[hidden], [aria-hidden='true']")) return false;
  const bounds = visualDocumentBounds(element);
  if (!bounds) return false;
  const style = getComputedStyle(element);
  if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) === 0) return false;
  return isEventBackedElement(element)
    ? hasEventElementPresentation(element)
    : isInteractableUiElement(element)
      ? hasMeaningfulInteractableIdentity(element)
      : hasElementPresentation(element);
}

function snapshotElementBucket(element: Element): number {
  if (isEventBackedElement(element)) return 0;
  if (isPrimaryControlElement(element)) return 1;
  if (isInteractableUiElement(element)) return 2;
  if (isSemanticTextElement(element)) return 3;
  if (meaningfulText(directVisibleText(element))) return 4;
  if (hasVisualMedia(element)) return 5;
  if (meaningfulText(visibleText(element))) return 6;
  return 7;
}

function hasMeaningfulInteractableIdentity(element: Element): boolean {
  return Boolean(
    stableElementId(element) ||
    meaningfulText(accessibleName(element)) ||
    meaningfulText(visibleText(element)) ||
    meaningfulText(directVisibleText(element)) ||
    meaningfulText(readElementValue(element)) ||
    meaningfulText(element.getAttribute("title")) ||
    meaningfulText(element.getAttribute("alt")) ||
    meaningfulText(element.getAttribute("placeholder")) ||
    meaningfulText(linkHref(element))
  );
}

function hasEventElementPresentation(element: Element): boolean {
  return hasMeaningfulInteractableIdentity(element) || hasElementPresentation(element);
}

function hasElementPresentation(element: Element): boolean {
  return meaningfulText(visibleText(element)) ||
    meaningfulText(accessibleName(element)) ||
    meaningfulText(readElementValue(element)) ||
    hasVisualMedia(element);
}

function elementPriority(element: Element): number {
  let score = 0;
  if (isInteractableUiElement(element)) score += 200;
  if (isActionableElement(element)) score += 100;
  if (stableElementId(element)) score += 60;
  if (meaningfulText(accessibleName(element))) score += 45;
  if (meaningfulText(visibleText(element))) score += 35;
  if (meaningfulText(readElementValue(element))) score += 35;
  if (meaningfulText(directVisibleText(element))) score += 25;
  if (meaningfulText(linkHref(element))) score += 40;
  const bounds = visualDocumentBounds(element);
  if (bounds) score += Math.min(20, Math.sqrt(bounds.width * bounds.height) / 8);
  return score;
}

function documentOrder(left: Element, right: Element): number {
  if (left === right) return 0;
  return left.compareDocumentPosition(right) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
}
