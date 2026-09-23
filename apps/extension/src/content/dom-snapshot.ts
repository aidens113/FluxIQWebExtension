// The state snapshot: what the page looks like right now, as a bounded, ranked
// list of elements. Candidates are gathered from the elements the user has
// touched, then the standard controls, then text and media, then a capped sweep
// of everything else; each is kept only if it is visible and carries some
// identity. Ranking puts what the user acted on first, so truncation drops the
// least useful elements rather than an arbitrary tail -- and keeps one example
// of each control a page repeats row after row, ranking the rest of the run
// after every distinct element (`repeat-exemplars.ts`), so a many-row page's
// template cannot crowd its own buttons out of the head of the list.
//
// After what was touched come the controls that change what this page shows --
// its facets, its sort, its pager -- and the controls of whatever is painted
// over it; then the page's own controls, its links, and last of all its
// footer's. `evidence/controls.ts` holds those rules and the measurement that
// forced them: a store's filter rail ranked 56th of 611 elements, behind twenty
// footer links, and reached no packet a model was ever given.
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
import { isFrontLayer, isPageStateControl, isSiteChrome, pageEvidence, recentlyInteractedElements, type SnapshotElementCounts, type SnapshotElementEntry } from "./evidence";
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
  isPageControlElement,
  isPrimaryControlElement,
  isSemanticTextElement,
  isSensitiveFormControl,
  meaningfulText
} from "./element-traits";
import { repeatExemplars } from "./repeat-exemplars";
import { withSelectorMemo } from "./selector";
import { visualDocumentBounds } from "./visual-bounds";
import type { DomElementDescriptor, DomSnapshot } from "./types";

const MAX_SNAPSHOT_CANDIDATES = 2_000;
const MAX_SNAPSHOT_SCAN_ELEMENTS = 50_000;

/**
 * The snapshot as the page is now. It only reads, so every selector it writes
 * -- the element list's and the evidence's -- shares one memo
 * (`selector/selector-memo.ts`): a list's rows build on one container selector
 * instead of each rebuilding it.
 */
export function captureSnapshot(): DomSnapshot {
  return withSelectorMemo(captureSnapshotNow);
}

function captureSnapshotNow(): DomSnapshot {
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
 *
 * A run's followers sort after everything else before any other rule is
 * asked, and each run's exemplar carries the run's size as `repeatCount`, so
 * a reader shown only the head still knows how many rows it stands for.
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
  const repeats = repeatExemplars(included, touchedElements());
  // Each element is asked what it is once, before the sort rather than inside
  // it. A comparator that asked would ask O(n log n) times, and every question
  // here reads computed style or walks ancestors.
  const ranked = included.map((element) => ({
    element,
    follower: repeats.followers.has(element) ? 1 : 0,
    bucket: snapshotElementBucket(element),
    priority: elementPriority(element)
  }));
  const entries = ranked
    .sort((left, right) =>
      left.follower - right.follower ||
      left.bucket - right.bucket ||
      right.priority - left.priority ||
      documentOrder(left.element, right.element)
    )
    .slice(0, MAX_SNAPSHOT_CANDIDATES)
    .map(({ element }) => ({ element, descriptor: snapshotDescriptor(element, repeats.counts.get(element)) }));
  return { entries, counts: { scanned, candidates: candidates.length, matched: included.length } };
}

/**
 * What a person or an action has just touched: the recorder's event queue and
 * the runtime interaction ledger. A run never ranks one of these behind its
 * exemplar -- the element an action just acted on is what a reader looks for
 * next.
 */
function touchedElements(): ReadonlySet<Element> {
  const touched = new Set<Element>(recentlyInteractedElements());
  for (const element of observedEventElementQueue) touched.add(element);
  return touched;
}

/** The element's descriptor, and, for a run's exemplar, how many elements the run holds. */
function snapshotDescriptor(element: Element, repeatCount: number | undefined): DomElementDescriptor {
  const descriptor = describeElement(element);
  if (repeatCount !== undefined) descriptor.repeatCount = repeatCount;
  return descriptor;
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

/**
 * Coarse relevance, applied before the priority score. A bucket says what an
 * element is for; the score only orders within one.
 *
 * What changes the page comes first, ahead even of the page's own form controls
 * (`evidence/controls.ts` says why, and what it costs to get this wrong): a
 * facet, a price band, a sort order, a page of results. A bounded list has to
 * describe the controls nothing else describes, and a refinement the model is
 * never shown is a refinement it cannot apply.
 *
 * The page's own controls come next, before its links (`isPageControlElement`
 * says why). A button satisfies both tests and the first one wins, so it stays
 * with the fields it applies; what falls through to the primary-control bucket
 * is links, summaries, menu items and tabs.
 *
 * The site's footer comes after all of them. It is the same on every page of
 * the site and changes nothing about this one, so its twenty legal and
 * corporate links rank behind the page's own content instead of ahead of it --
 * and still ahead of the page's prose, because a footer link is at least
 * something to act on.
 */
function snapshotElementBucket(element: Element): number {
  if (isEventBackedElement(element)) return 0;
  if (isPageStateControl(element)) return 1;
  const control = controlBucket(element);
  if (control !== undefined) {
    // A control of whatever is painted over the page joins them: the page
    // behind a consent banner cannot be clicked until the banner is answered.
    // Only a page control asks, so a sticky header's links stay links.
    if (control === 2 && isFrontLayer(element)) return 1;
    // Only a control is demoted for sitting in the footer. Footer prose is text
    // like any other text and is ranked as text, which it would be anyway.
    return isSiteChrome(element) ? 5 : control;
  }
  if (isSemanticTextElement(element)) return 6;
  if (meaningfulText(directVisibleText(element))) return 7;
  if (hasVisualMedia(element)) return 8;
  if (meaningfulText(visibleText(element))) return 9;
  return 10;
}

/** Which of the three control bands the element is in, or `undefined` for something that is not a control. */
function controlBucket(element: Element): number | undefined {
  if (isPageControlElement(element)) return 2;
  if (isPrimaryControlElement(element)) return 3;
  if (isInteractableUiElement(element)) return 4;
  return undefined;
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
