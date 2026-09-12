// Blocking overlays: the controls a page shows but will not let anything click.
//
// Every visibility rule the snapshot already applies -- `hidden`,
// `aria-hidden`, `display`, `visibility`, `opacity`, a rect on screen -- asks
// whether an element paints. None of them asks whether anything paints *over*
// it, so a consent banner, a sticky footer or a modal backdrop leaves its
// victims looking perfectly actionable. The only honest answer is the one the
// browser gives: hit-test the point an action would click and see who answers.
//
// The test costs a layout flush per candidate, so it runs over the
// highest-ranked interactive candidates only, in the order the snapshot already
// put them, and stops at a fixed cap. The blocker reported is not the element
// the hit-test named but the outermost ancestor of it that still excludes the
// target -- the banner rather than the word inside it -- because that is the
// thing a reader has to deal with.

import { selectorFor } from "../describe-element";
import { isInteractableUiElement } from "../element-traits";
import { accessibleNameFor } from "../identity";
import { visualViewportBounds } from "../visual-bounds";
import type { OverlayEvidence, OverlayEvidenceItem } from "./types";

const MAX_HIT_TESTED = 40;
const MAX_BLOCKERS = 5;
const MAX_BLOCKED_PER_BLOCKER = 5;
const MAX_BLOCKER_ANCESTOR_WALK = 12;

/** Which of the ranked candidates are covered, and by what. `undefined` when nothing is. */
export function overlayEvidence(candidates: readonly Element[]): OverlayEvidence | undefined {
  const blockers = new Map<Element, Element[]>();
  let tested = 0;
  let blockedCount = 0;

  for (const candidate of candidates) {
    if (tested >= MAX_HIT_TESTED) break;
    if (!isInteractableUiElement(candidate)) continue;
    const point = hitPointFor(candidate);
    if (!point) continue;
    tested += 1;
    const blocker = blockerAt(candidate, point);
    if (!blocker) continue;
    blockedCount += 1;
    const covered = blockers.get(blocker);
    if (covered) covered.push(candidate);
    else blockers.set(blocker, [candidate]);
  }

  if (!blockedCount) return undefined;
  return { tested, blockedCount, blockers: rankBlockers(blockers) };
}

/** The point an action would aim at: the centre of the candidate, clamped into the viewport. */
function hitPointFor(element: Element): { x: number; y: number } | undefined {
  const rect = element.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return undefined;
  const width = window.innerWidth;
  const height = window.innerHeight;
  if (rect.bottom <= 0 || rect.right <= 0 || rect.top >= height || rect.left >= width) return undefined;
  const x = Math.min(Math.max(rect.left + rect.width / 2, 0), width - 1);
  const y = Math.min(Math.max(rect.top + rect.height / 2, 0), height - 1);
  return { x, y };
}

/**
 * Who answers for the candidate's own centre. The candidate itself, anything
 * inside it, and any ancestor of it are all the candidate as far as a click is
 * concerned: an ancestor answers only because the child paints nothing at that
 * point, which is a layout fact and not an obstruction.
 */
function blockerAt(candidate: Element, point: { x: number; y: number }): Element | undefined {
  const hit = document.elementFromPoint(point.x, point.y);
  if (!hit || hit === candidate) return undefined;
  if (candidate.contains(hit) || hit.contains(candidate)) return undefined;
  return overlayRoot(hit, candidate);
}

/** The outermost ancestor of the hit that still does not contain the candidate. */
function overlayRoot(hit: Element, candidate: Element): Element {
  let root = hit;
  for (let depth = 0; depth < MAX_BLOCKER_ANCESTOR_WALK; depth += 1) {
    const parent: Element | null = root.parentElement;
    if (!parent || parent === document.documentElement || parent === document.body) break;
    if (parent.contains(candidate)) break;
    root = parent;
  }
  return root;
}

/** Most-blocking first, so the top-most obstruction is the first thing read. */
function rankBlockers(blockers: ReadonlyMap<Element, Element[]>): OverlayEvidenceItem[] {
  return [...blockers.entries()]
    .sort(([, left], [, right]) => right.length - left.length)
    .slice(0, MAX_BLOCKERS)
    .map(([element, covered]) => describeBlocker(element, covered));
}

function describeBlocker(element: Element, covered: readonly Element[]): OverlayEvidenceItem {
  const role = element.getAttribute("role")?.trim().toLowerCase();
  const label = accessibleNameFor(element);
  const bounds = visualViewportBounds(element);
  return {
    selector: selectorFor(element),
    ...(role ? { role } : {}),
    ...(label ? { label } : {}),
    ...(bounds ? { bounds } : {}),
    blocks: covered.length,
    blocked: covered.slice(0, MAX_BLOCKED_PER_BLOCKER).map((target) => selectorFor(target))
  };
}
