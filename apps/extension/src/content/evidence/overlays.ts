// Blocking overlays: the controls a page shows but will not let anything click.
//
// Every visibility rule the snapshot already applies -- `hidden`,
// `aria-hidden`, `display`, `visibility`, `opacity`, a rect on screen -- asks
// whether an element paints. None of them asks whether anything paints *over*
// it, so a consent banner, a sticky footer or a modal backdrop leaves its
// victims looking perfectly actionable. The only honest answer is the one the
// browser gives: hit-test the point an action would click and see who answers.
//
// Every interactive element of the snapshot with a box on screen is tested, in
// document order, and every blocker and every control it covers is reported
// (t200). The test used to run over the forty highest-ranked candidates only
// and report the five most-blocking layers and five of each one's victims, so a
// wall covering the rest of the page went unreported past the cut. The layout
// is flushed once; each hit test after it reads the same layout. The blocker
// reported is not the element the hit-test named but the outermost ancestor of
// it that still excludes the target -- the banner rather than the word inside
// it -- because that is the thing a reader has to deal with.
//
// The hit test descends into open shadow roots, and containment and the
// ancestor walk cross them (`../shadow-dom`). A control inside a widget's root
// is a snapshot candidate, and asked through `document.elementFromPoint` and
// `Node.contains` it was answered by its own host and reported as blocked by
// the widget that holds it: a chat launcher in an empty corner became a
// blocker, and a consent wall counted its own buttons among what it covered.
//
// Each blocker carries what it is, when the interference classifiers recognise
// it -- a consent banner, a rate-limit notice, a robot check -- as `kind`
// (`action-runtime/interference/layer-kind.ts`), because the blockers are no
// longer sorted most-blocking first and the model no longer meets the layer
// before what it covers.
//
// **A control scrolled out of sight inside its own container is not covered.**
// The point tested is the centre of the part of the control its scrolling
// ancestors still show, and a control none of whose box they show is not tested
// at all. Until 2026-10-01 the centre of the whole box was tested: bigbox's
// store chooser lists its stores in a 320-pixel scrolling list, so the third
// and fourth cards' "Set as my store" sat below the list's visible edge, the
// hit test there landed on the results tiles beneath the chooser, and the page
// reported them covered by `main`. The domain then refused the press before
// sending it (`node-run/covered-target.ts`), although the click's own gate
// scrolls the control into view and presses it, and a live build spent its
// store switch searching for a layer that was not there (lane A, run 38,
// `run-muq3vuwx-94fdde27`).

import { isExtensionUiNode } from "../picker-host";
import { deepElementFromPoint, selectorFor } from "../selector";
import { composedContains, composedDocumentOrder, composedParent } from "../shadow-dom";
import { isInteractableUiElement } from "../element-traits";
import { accessibleNameFor } from "../identity";
import { visualViewportBounds } from "../visual-bounds";
import { layerKind } from "../action-runtime/interference";
import { present } from "../../shared/present";
import type { OverlayEvidence, OverlayEvidenceItem } from "./types";

/** Which of the snapshot's elements are covered, and by what. `undefined` when nothing is. */
export function overlayEvidence(candidates: readonly Element[]): OverlayEvidence | undefined {
  const blockers = new Map<Element, Element[]>();
  const clips = new Map<Element, ClipBox | null>();
  let tested = 0;
  let blockedCount = 0;

  for (const candidate of candidates) {
    if (!isInteractableUiElement(candidate)) continue;
    const point = hitPointFor(candidate, clips);
    if (!point) continue;
    tested += 1;
    const blocker = blockerAt(candidate, point);
    if (!blocker) continue;
    // A pinned bar the gate's own scroll gets the control out from under is
    // still reported, with what it is (a consent banner says so), but the
    // control is not counted as covered by it (`escapedByScrolling`).
    const covered = blockers.get(blocker) ?? [];
    blockers.set(blocker, covered);
    if (escapedByScrolling(candidate, blocker)) continue;
    blockedCount += 1;
    covered.push(candidate);
  }

  if (!blockers.size) return undefined;
  return present<OverlayEvidence>({ tested, blockedCount, blockers: blockersInDocumentOrder(blockers) });
}

/** The box an ancestor clips its descendants to, in viewport coordinates. */
type ClipBox = { left: number; top: number; right: number; bottom: number };

/**
 * The point an action would aim at: the centre of the part of the candidate
 * its scrolling ancestors show, clamped into the viewport. A candidate with no
 * area, none on screen, or none its ancestors show has no such point --
 * nothing can be asked about a place that is not painted, and a control
 * scrolled out of sight inside a list is not under anything -- but a small one
 * does: a visually hidden input a page styles over is exactly what a click
 * lands on something else for. A candidate no ancestor clips is aimed at the
 * centre of its whole box, as it always was.
 */
function hitPointFor(element: Element, clips: Map<Element, ClipBox | null>): { x: number; y: number } | undefined {
  const rect = element.getBoundingClientRect();
  if (!(rect.width > 0) || !(rect.height > 0)) return undefined;
  const width = window.innerWidth;
  const height = window.innerHeight;
  let shown: ClipBox = { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
  for (const clip of clippingBoxes(element, clips)) {
    shown = { left: Math.max(shown.left, clip.left), top: Math.max(shown.top, clip.top), right: Math.min(shown.right, clip.right), bottom: Math.min(shown.bottom, clip.bottom) };
    if (shown.right <= shown.left || shown.bottom <= shown.top) return undefined;
  }
  if (shown.bottom <= 0 || shown.right <= 0 || shown.top >= height || shown.left >= width) return undefined;
  const x = Math.min(Math.max((shown.left + shown.right) / 2, 0), width - 1);
  const y = Math.min(Math.max((shown.top + shown.bottom) / 2, 0), height - 1);
  return { x, y };
}

/**
 * The boxes the candidate's ancestors clip it to: every ancestor, across shadow
 * roots, whose overflow is not visible, up to the body (whose overflow is the
 * viewport's) or to the first fixed-position element (which the ancestors
 * above it do not clip). Each ancestor's answer is kept for the whole look.
 */
function clippingBoxes(element: Element, clips: Map<Element, ClipBox | null>): ClipBox[] {
  const boxes: ClipBox[] = [];
  const view = element.ownerDocument?.defaultView;
  if (!view) return boxes;
  if (view.getComputedStyle(element).position === "fixed") return boxes;
  for (let current = composedParent(element); current && current !== document.body && current !== document.documentElement; current = composedParent(current)) {
    let clip = clips.get(current);
    if (clip === undefined) {
      const style = view.getComputedStyle(current);
      const clipping = style.overflowX !== "visible" || style.overflowY !== "visible";
      const box = clipping ? current.getBoundingClientRect() : undefined;
      clip = box ? { left: box.left, top: box.top, right: box.right, bottom: box.bottom } : null;
      clips.set(current, clip);
      if (style.position === "fixed") {
        if (clip) boxes.push(clip);
        break;
      }
    }
    if (clip) boxes.push(clip);
  }
  return boxes;
}

/**
 * Who answers for the candidate's own centre. The candidate itself, anything
 * inside it, and any ancestor of it are all the candidate as far as a click is
 * concerned: an ancestor answers only because the child paints nothing at that
 * point, which is a layout fact and not an obstruction.
 */
function blockerAt(candidate: Element, point: { x: number; y: number }): Element | undefined {
  const hit = deepElementFromPoint(point.x, point.y);
  // The extension's own overlays take no pointer event, so a hit test never
  // lands on one; the guard keeps that true should one ever be hit-testable.
  if (!hit || hit === candidate || isExtensionUiNode(hit)) return undefined;
  if (composedContains(candidate, hit) || composedContains(hit, candidate)) return undefined;
  return overlayRoot(hit, candidate);
}

/**
 * Whether the press would get out from under `blocker` on its own: the click's
 * actionability gate scrolls its target to the viewport's centre before it
 * hit-tests (`action-runtime/actionability.ts`), so a bar pinned to the
 * viewport -- fixed, or sticky -- covers a control that scrolls with the page
 * only where the control happens to sit now. bigbox's cart keeps its "Estimated
 * total ... Continue to checkout" bar fixed at the bottom, and the
 * recommendations under it were reported covered by it and refused before the
 * press was sent (lane A, run 39, `run-muq4jztv-ea489aa9`).
 *
 * It answers yes only when the blocker is pinned, the candidate is not (a
 * pinned control goes nowhere when the page scrolls), and the blocker does not
 * cover the candidate's centre at the place the page can scroll it to: the
 * viewport's middle, or as near it as the page's length allows. A scrim over
 * the whole viewport, or a full-height side panel over the candidate's column,
 * still covers it.
 */
function escapedByScrolling(candidate: Element, blocker: Element): boolean {
  if (!pinned(blocker) || pinned(candidate)) return false;
  const scroller = document.scrollingElement ?? document.documentElement;
  const height = window.innerHeight;
  const rect = candidate.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const onPage = rect.top + window.scrollY + rect.height / 2;
  const maxScroll = Math.max(0, scroller.scrollHeight - height);
  const scrollTo = Math.min(Math.max(onPage - height / 2, 0), maxScroll);
  const y = onPage - scrollTo;
  const cover = blocker.getBoundingClientRect();
  return !(x >= cover.left && x <= cover.right && y >= cover.top && y <= cover.bottom);
}

/** Whether the element, or an ancestor of it across shadow roots below the body, is fixed or sticky to the viewport. */
function pinned(element: Element): boolean {
  const view = element.ownerDocument?.defaultView;
  if (!view) return false;
  for (let current: Element | null = element; current && current !== document.body && current !== document.documentElement; current = composedParent(current)) {
    const position = view.getComputedStyle(current).position;
    if (position === "fixed" || position === "sticky") return true;
  }
  return false;
}

/** The outermost ancestor of the hit that still does not contain the candidate. */
function overlayRoot(hit: Element, candidate: Element): Element {
  let root = hit;
  for (;;) {
    const parent: Element | null = composedParent(root);
    if (!parent || parent === document.documentElement || parent === document.body) break;
    if (composedContains(parent, candidate)) break;
    root = parent;
  }
  return root;
}

/** Every blocker, in the order the page holds them, each with every control it covers. */
function blockersInDocumentOrder(blockers: ReadonlyMap<Element, Element[]>): OverlayEvidenceItem[] {
  return [...blockers.entries()]
    .sort(([left], [right]) => composedDocumentOrder(left, right))
    .map(([element, covered]) => describeBlocker(element, covered));
}

function describeBlocker(element: Element, covered: readonly Element[]): OverlayEvidenceItem {
  const role = element.getAttribute("role")?.trim().toLowerCase();
  const label = accessibleNameFor(element);
  const bounds = visualViewportBounds(element);
  return present<OverlayEvidenceItem>({
    selector: selectorFor(element),
    role: role || undefined,
    label: label || undefined,
    bounds,
    blocks: covered.length,
    blocked: covered.map((target) => selectorFor(target)),
    kind: layerKind(element)
  });
}
