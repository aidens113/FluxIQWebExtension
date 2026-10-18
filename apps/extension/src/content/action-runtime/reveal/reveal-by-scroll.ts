// The scroll a person makes toward a control they were told to press and cannot
// see, made between two attempts of the node's own retries (`../recovery/`).
//
// `reveal-aim.ts` decides what is scrolled and whether scrolling can help at
// all; this file makes the scroll and says whether anything moved. Moving is
// the fact the retry loop needs: a scroll that moved the page may have woken a
// lazy loader, so the next attempt is worth waiting for the page to answer it;
// a scroll that moved nothing (the end was already on screen) woke nothing, and
// the loop waits as it would have without it.
//
// `behavior: "instant"`, as `../scroll-element-into-view.ts` scrolls, so the
// position measured straight afterwards is where the page landed.

import { revealAim } from "./reveal-aim";

/** Where an element sits, as far as a scroll can change it. */
type Position = { top: number; left: number; scrollTop: number; scrollLeft: number };

/** Scrolls toward where `target` would be drawn, when scrolling may reveal it. Answers whether anything moved. */
export function revealByScroll(target: Element): boolean {
  const aim = revealAim(target);
  if (!aim) return false;
  const before = positionOf(aim.element);
  if (aim.ownContent) aim.element.scrollTop = aim.element.scrollHeight;
  aim.element.scrollIntoView({ block: aim.block, inline: "nearest", behavior: "instant" });
  return moved(before, positionOf(aim.element));
}

function positionOf(element: Element): Position {
  const box = element.getBoundingClientRect();
  return { top: box.top, left: box.left, scrollTop: element.scrollTop, scrollLeft: element.scrollLeft };
}

/** A move of a pixel or more on any axis; sub-pixel differences are layout rounding, not a scroll. */
function moved(before: Position, after: Position): boolean {
  return Math.abs(before.top - after.top) >= 1
    || Math.abs(before.left - after.left) >= 1
    || Math.abs(before.scrollTop - after.scrollTop) >= 1
    || Math.abs(before.scrollLeft - after.scrollLeft) >= 1;
}
