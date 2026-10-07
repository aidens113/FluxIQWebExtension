// Scrolling a list for more: scroll the nearest scrollable ancestor of the
// first item, or the window, to its bottom, and wait up to 900 ms -- the window
// the scroll verb gives a lazy feed to grow -- for an item that was not shown
// before. The growth signal is item identity, not document height. Nothing new
// while at the bottom is the list ending; nothing new while no longer at the
// bottom (a loading indicator grew the page) scrolls again. A batch that failed
// to load and put a Retry under the list has it pressed while the budget lasts
// (`../load-retry.ts`, `offeredListRetry`; the classifieds feed's bare-span
// "Try again", t194-w24), and a press is not a scroll.
//
// Every scroll is counted on the progress. A read bounds them by its
// `maxScrolls`; a next-page step, which has no bound, by `MOVE_SCROLLS` of its
// own, after which a feed that keeps growing its page and never its list has
// not moved.

import { awaitArrivalOrRetry } from "../list-wait";
import { newRetryBudget } from "../load-retry";
import { pastDeadline } from "./list-change";
import type { PageStep, PaginationProgress } from "./types";

/** How long a scroll waits for a new item: the window `actions/scroll.ts` gives a lazy feed to grow. */
const SCROLL_GROWTH_WINDOW_MS = 900;
/** Subpixel layout and rounding differences do not keep a scroller from counting as at its bottom. */
const BOTTOM_TOLERANCE_PX = 2;
/** The scrolls one next-page step may make before a page that grows and brings no item counts as not moving. */
const MOVE_SCROLLS = 5;

/** Scrolls until the list grows, ends, or `bound` scrolls (the read's) or `MOVE_SCROLLS` more (a step's) are spent. */
export async function scrollForMore(progress: PaginationProgress, bound: number | undefined): Promise<PageStep> {
  const limit = bound ?? progress.scrolls + MOVE_SCROLLS;
  const scroller = scrollerOf(progress.shown[0]);
  const retries = progress.listRetries ?? (progress.listRetries = newRetryBudget());
  const shown = (): Element[] => Array.from(document.querySelectorAll(progress.item));
  for (;;) {
    if (progress.scrolls >= limit) return { outcome: "truncated", stop: "page_limit" };
    if (pastDeadline(progress.deadline)) return { outcome: "timed_out", stop: "deadline" };
    scrollToBottom(scroller);
    progress.scrolls += 1;
    // A batch the scroll asked for that failed and offered a Retry under the list has it pressed (see the header).
    const outcome = await awaitArrivalOrRetry(() => progress.hasUnreadItem(), shown, SCROLL_GROWTH_WINDOW_MS, retries, progress.deadline);
    if (outcome === "changed") return { outcome: "advanced", by: "scroll" };
    if (outcome === "timed_out") return { outcome: "timed_out", stop: "deadline" };
    if (atBottom(scroller)) return { outcome: "ended", stop: "scrolled_to_end" };
  }
}

/** The nearest ancestor of `element` that scrolls its own content, or `null` for the window. */
function scrollerOf(element: Element | undefined): Element | null {
  for (let current = element?.parentElement ?? null; current; current = current.parentElement) {
    if (current === document.body || current === document.documentElement) return null;
    const overflow = getComputedStyle(current).overflowY;
    if ((overflow === "auto" || overflow === "scroll" || overflow === "overlay") && current.scrollHeight > current.clientHeight) return current;
  }
  return null;
}

function scrollToBottom(scroller: Element | null): void {
  if (scroller) scroller.scrollTop = scroller.scrollHeight;
  else window.scrollTo({ left: window.scrollX, top: documentHeight(), behavior: "instant" });
}

function atBottom(scroller: Element | null): boolean {
  if (scroller) return scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - BOTTOM_TOLERANCE_PX;
  return window.scrollY + window.innerHeight >= documentHeight() - BOTTOM_TOLERANCE_PX;
}

function documentHeight(): number {
  return Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0);
}
