// The state snapshot: what the page looks like right now, as a bounded, ranked
// list of elements. Candidates are gathered from the elements the user has
// touched, then the standard controls, then text and media, then a capped sweep
// of everything else; each is kept only if it is visible and carries some
// identity. Ranking puts what the user acted on first, so truncation drops the
// least useful elements rather than an arbitrary tail.

import { compactObject } from "./compact-object";
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
  meaningfulText
} from "./element-traits";
import { visualDocumentBounds } from "./visual-bounds";
import type { DomElementDescriptor, DomSnapshot } from "./types";

const MAX_SNAPSHOT_CANDIDATES = 2_000;
const MAX_SNAPSHOT_SCAN_ELEMENTS = 50_000;

export function captureSnapshot(): DomSnapshot {
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
    interactiveElements: snapshotElements()
  };
  const focused = document.activeElement instanceof Element ? describeElement(document.activeElement) : undefined;
  if (focused) snapshot.focusedElement = focused;
  const selectedText = window.getSelection()?.toString();
  if (selectedText) snapshot.selectedText = selectedText.slice(0, 2_000);
  return snapshot;
}

function snapshotElements(): DomElementDescriptor[] {
  const seen = new Set<Element>();
  const candidates = snapshotCandidateElements();
  const included: Element[] = [];
  for (const element of candidates) {
    if (seen.has(element) || !shouldIncludeSnapshotElement(element)) continue;
    seen.add(element);
    included.push(element);
  }
  return included
    .sort((left, right) =>
      snapshotElementBucket(left) - snapshotElementBucket(right) ||
      elementPriority(right) - elementPriority(left) ||
      documentOrder(left, right)
    )
    .slice(0, MAX_SNAPSHOT_CANDIDATES)
    .map((element) => describeElement(element));
}

function snapshotCandidateElements(): Element[] {
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

  return candidates;
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
