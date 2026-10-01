// The state snapshot: what the page looks like right now, as every element it
// renders, in the order a person reads it (t200).
//
// `rendered-elements.ts` says what "renders" means and why the list stopped
// being a selection: it used to be gathered from allow-lists, filtered by
// name, size, opacity and `aria-hidden`, ranked, and cut at 2,000, and the
// model failed on exactly the cookie walls, pop-ups and robot checks the cut
// and the filters removed. Nothing is ranked here and nothing is cut. Each
// element is described in full (`describe-element.ts`); a repeated control
// still carries how many of its kind the page holds, as `repeatCount`
// (`repeat-exemplars.ts`), and that annotation moves nothing. Two more facts
// are marked on the element they hold for, and move nothing either:
// `frontLayer`, for an element on a layer the page paints over itself
// (`evidence/front-layer.ts`), and `leadStatement`, for one of the main
// region's own short statements about what the page shows
// (`evidence/lead-statements.ts`). Both used to rank; now they inform. Every
// gathering pass enters open shadow roots (`shadow-dom/`), because a widget's
// controls are on the page a person sees whichever tree they live in.
//
// A list of elements is not a picture of a page, so the snapshot also carries
// `evidence`: the dialogs in front of it, what is covering its controls,
// whether it is still loading, its landmarks, what repeats on it, its forms,
// how it was navigated to, and how many elements the walk looked at. Each
// item is gathered by the module in `evidence/` that owns it, and this file
// only asks -- what a snapshot is stays readable here, and a rule for one item
// is read and changed where it lives (Phase 1.4).
//
// One thing the snapshot reads directly is the page selection, and it is the
// one capture path that does not go through `readElementValue`. It therefore
// carries its own sensitivity guard, `capturedSelectionText` at the foot of
// this file, using the same shared rule rather than a second one.

import { compactObject } from "./compact-object";
import { frontLayerTest, isLeadStatement, pageEvidence, recentlyInteractedElements, type SnapshotElementCounts, type SnapshotElementEntry } from "./evidence";
import { currentFrameViewportOffset, isTopFrame } from "./frame-geometry";
import { observedEventElementQueue } from "./event-elements";
import { describeElement, ownTextBeside } from "./describe-element";
import { isSensitiveFormControl } from "./element-traits";
import { listedParentIndexes } from "./listed-parents";
import { renderedElements } from "./rendered-elements";
import { repeatExemplars } from "./repeat-exemplars";
import { withSelectorMemo } from "./selector";
import type { SnapshotCaptureOptions } from "../shared/snapshot-capture-options";
import type { DomElementDescriptor, DomSnapshot } from "./types";

/**
 * The snapshot as the page is now. It only reads, so every selector it writes
 * -- the element list's and the evidence's -- shares one memo
 * (`selector/selector-memo.ts`): a list's rows build on one container selector
 * instead of each rebuilding it.
 */
export function captureSnapshot(options: SnapshotCaptureOptions = {}): DomSnapshot {
  return withSelectorMemo(() => captureSnapshotNow(options));
}

function captureSnapshotNow(options: SnapshotCaptureOptions): DomSnapshot {
  const { entries, shown, counts } = snapshotElements(options);
  // Before the descriptors are read out: the evidence pass sets each one's
  // `changed` and `recentlyInteracted`, and the same objects go on the wire.
  // It is handed the rendered elements only, so a search's capture reports the
  // page a look reports, and the change record it keeps between captures
  // holds the same elements whichever of the two ran last.
  const evidence = pageEvidence(shown, counts);
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
 * Shadow DOM is out of scope here, although the element list enters open
 * roots: the selection is the document's, and a selection inside a closed
 * shadow root is not reachable from here at all.
 *
 * The selection is carried whole, and every candidate control is asked (t200):
 * it was cut at 2,000 characters, and withheld outright on a page with more
 * than 2,000 form controls rather than asking them all.
 */
function capturedSelectionText(): string | undefined {
  const selection = window.getSelection();
  const text = selection?.toString();
  if (!selection || !text) return undefined;
  return selectionTouchesSensitiveControl(selection) ? undefined : text;
}

function selectionTouchesSensitiveControl(selection: Selection): boolean {
  if (withinSensitiveControl(document.activeElement)) return true;
  if (withinSensitiveControl(selection.anchorNode) || withinSensitiveControl(selection.focusNode)) return true;

  const candidates = document.querySelectorAll(SENSITIVE_CANDIDATE_SELECTOR);
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
 * The descriptors the snapshot carries -- one for every rendered element, in
 * composed document order -- with the elements they were built from and the
 * counts taken on the way.
 *
 * A run of repeated controls is left where the page put it. Its first member
 * carries the run's size as `repeatCount`, so a reader can say "one of 280
 * rows" without counting; the other members are described like any element.
 *
 * Every descriptor carries `parent`, its nearest listed composed ancestor's
 * index in the list (`listed-parents.ts`), and a descriptor whose `text` is
 * all its descendants' words carries `ownText` beside it (t223).
 *
 * Asked with `includeHidden`, the list also holds what is not rendered, each
 * flagged `hidden` and described like any element, in composed order among
 * the rest (`rendered-elements.ts`). Everything that judges the page --
 * the repeat runs, the front layer, the lead statements and the evidence pass
 * -- is given the rendered elements alone (`shown`), so a hidden element
 * changes no other element's descriptor, and without the option `entries` and
 * `shown` are one list, built exactly as before.
 */
function snapshotElements(options: SnapshotCaptureOptions): {
  entries: SnapshotElementEntry[];
  shown: SnapshotElementEntry[];
  counts: SnapshotElementCounts;
} {
  const { elements, walked, hidden } = renderedElements(document, { includeHidden: options.includeHidden === true });
  const rendered = hidden ? elements.filter((element) => !hidden.has(element)) : elements;
  const repeats = repeatExemplars(rendered, touchedElements());
  const inFrontLayer = frontLayerTest();
  const parents = listedParentIndexes(elements);
  const entries = elements.map((element, index) => ({
    element,
    descriptor: hidden?.has(element)
      ? hiddenDescriptor(element, parents[index])
      : snapshotDescriptor(element, repeats.counts.get(element), inFrontLayer(element), parents[index])
  }));
  const shown = hidden ? entries.filter((entry) => !hidden.has(entry.element)) : entries;
  return { entries, shown, counts: { scanned: walked, candidates: walked, matched: rendered.length } };
}

/**
 * What a person or an action has just touched: the recorder's event queue and
 * the runtime interaction ledger. A run's exemplar is never chosen over one of
 * these -- the element an action just acted on is what a reader looks for next
 * -- which decides only which member carries the run's `repeatCount`.
 */
function touchedElements(): ReadonlySet<Element> {
  const touched = new Set<Element>(recentlyInteractedElements());
  for (const element of observedEventElementQueue) touched.add(element);
  return touched;
}

/**
 * The element's descriptor, with the facts only a snapshot knows: for a run's
 * exemplar, how many elements the run holds; whether it is on a front layer;
 * whether it is one of the main region's lead statements; its own words beside
 * its descendants'; its listed parent. The two flags are written only when
 * true, and the last two only when there is something to say.
 */
function snapshotDescriptor(element: Element, repeatCount: number | undefined, frontLayer: boolean, parent: number | undefined): DomElementDescriptor {
  const descriptor = describeElement(element);
  if (repeatCount !== undefined) descriptor.repeatCount = repeatCount;
  if (frontLayer) descriptor.frontLayer = true;
  if (isLeadStatement(element)) descriptor.leadStatement = true;
  return withStructure(element, descriptor, parent);
}

/**
 * A hidden element's descriptor, for an `includeHidden` capture: described
 * like any element, with its own words and its parent, and flagged `hidden`.
 * It is in no repeat run, on no front layer and no lead statement -- those say
 * how the page is painted, which a hidden element is not.
 */
function hiddenDescriptor(element: Element, parent: number | undefined): DomElementDescriptor {
  const descriptor = withStructure(element, describeElement(element), parent);
  descriptor.hidden = true;
  return descriptor;
}

function withStructure(element: Element, descriptor: DomElementDescriptor, parent: number | undefined): DomElementDescriptor {
  const ownText = ownTextBeside(element, descriptor.text);
  if (ownText !== undefined) descriptor.ownText = ownText;
  if (parent !== undefined) descriptor.parent = parent;
  return descriptor;
}
