// Scrolling a list for more: scroll the nearest scrollable ancestor of the
// first item, or the window, to its bottom, and wait up to 900 ms -- the window
// the scroll verb gives a lazy feed to grow -- for an item that was not shown
// before. The growth signal is item identity, not document height. A batch
// that failed to load and put a Retry under the list has it pressed while the
// budget lasts (`../load-retry.ts`, `offeredListRetry`; the classifieds feed's
// bare-span "Try again", t194-w24), and a press is not a scroll.
//
// **Nothing new in the window is not yet the list ending.** While the page
// shows the list still loading -- busy, a placeholder added under it, its tail
// still changing (`./list-loading.ts`) -- the scroll waits on, for a new item
// or for the page to settle, up to `LOADING_WAIT_MS` in one call. Until
// 2026-10-17 the window alone decided: a feed whose next batch took longer than
// 900 ms was at the bottom of its placeholders when the window closed, and the
// step answered `scrolled_to_end` while the feed was marked busy and the batch
// was on its way (`run-mvcvzwk1-c1d869e4`, one page read of a feed that went
// on). Once the page has settled with nothing new, the list ends where the
// scroller is at its bottom; where it is not (a loader grew the page), it is
// scrolled again.
//
// **A list whose loader asked to wait has not ended either** (t762). Where the
// scroll brought nothing and the page shows the loader's notice to wait ("Please
// wait a few moments before you try again", "Try again in 4s") where the next
// part would come, the step waits as the notice asks or presses the retry it
// offers once it shows, and scrolls again (`./loader-pause/`); a list still
// paused after the node's retries fails `rate_limited` with the notice's words.
//
// Every scroll is counted on the progress. A read bounds them by its
// `maxScrolls`; a next-page step, which has no bound, by `MOVE_SCROLLS` of its
// own, after which a feed that keeps growing its page and never its list has
// not moved.

import { awaitArrivalOrRetry, type WaitOutcome } from "../list-wait";
import { newRetryBudget, type RetryBudget } from "../load-retry";
import { pastDeadline } from "./list-change";
import { waitOutLoaderPause } from "./loader-pause";
import { watchListLoading, type ListLoading } from "./list-loading";
import type { PageStep, PaginationProgress } from "./types";

/** How long a scroll waits for a new item: the window `actions/scroll.ts` gives a lazy feed to grow. */
const SCROLL_GROWTH_WINDOW_MS = 900;
/** Subpixel layout and rounding differences do not keep a scroller from counting as at its bottom. */
const BOTTOM_TOLERANCE_PX = 2;
/** The scrolls one next-page step may make before a page that grows and brings no item counts as not moving. */
const MOVE_SCROLLS = 5;
/** How long one call waits, in all, on a page that shows its list still loading: a slow batch, not an endless one. */
const LOADING_WAIT_MS = 15_000;
/** How long a page that showed loading must stay quiet, with nothing new, before it counts as settled. */
const SETTLED_MS = 900;

/** Scrolls until the list grows, ends, or `bound` scrolls (the read's) or `MOVE_SCROLLS` more (a step's) are spent. */
export async function scrollForMore(progress: PaginationProgress, bound: number | undefined): Promise<PageStep> {
  const limit = bound ?? progress.scrolls + MOVE_SCROLLS;
  const scroller = scrollerOf(progress.shown[0]);
  const retries = progress.listRetries ?? (progress.listRetries = newRetryBudget());
  const shown = (): Element[] => Array.from(document.querySelectorAll(progress.item));
  const loading = watchListLoading(progress.item, progress.shown[0]);
  const loadingUntil = Date.now() + LOADING_WAIT_MS;
  let pauses = 0;
  for (;;) {
    if (progress.scrolls >= limit) return { outcome: "truncated", stop: "page_limit" };
    if (pastDeadline(progress.deadline)) return { outcome: "timed_out", stop: "deadline" };
    scrollToBottom(scroller);
    progress.scrolls += 1;
    // A batch the scroll asked for that failed and offered a Retry under the list has it pressed (see the header).
    let outcome = await awaitArrivalOrRetry(() => progress.hasUnreadItem(), shown, SCROLL_GROWTH_WINDOW_MS, retries, progress.deadline);
    // Nothing new yet from a page still loading its list is waited on (see the header).
    if (outcome === "unchanged" && (loading.shown() || loading.moved())) outcome = await awaitLoaded(progress, loading, shown, retries, loadingUntil);
    if (outcome === "changed") return { outcome: "advanced", by: "scroll" };
    if (outcome === "timed_out") return { outcome: "timed_out", stop: "deadline" };
    // A loader that answered the scroll with a notice to wait has paused the list; it has not ended (header).
    const paused = await waitOutLoaderPause(progress, pauses);
    if (paused === "timed_out") return { outcome: "timed_out", stop: "deadline" };
    if (paused !== "clear") {
      pauses += 1;
      continue;
    }
    if (atBottom(scroller)) return { outcome: "ended", stop: "scrolled_to_end" };
  }
}

/**
 * Waits, until `until`, for a page that shows its list loading to bring a new
 * item -- `"changed"` -- or to settle without one: no loading shown and the
 * tail unchanged for `SETTLED_MS`, or `until` passing first -- `"unchanged"`.
 * A Retry the list offers meanwhile is pressed as the first window's is.
 */
async function awaitLoaded(progress: PaginationProgress, loading: ListLoading, shown: () => Element[], retries: RetryBudget, until: number): Promise<WaitOutcome> {
  let quietSince = Date.now();
  const settled = (): boolean => {
    if (loading.shown() || loading.moved()) quietSince = Date.now();
    return Date.now() - quietSince >= SETTLED_MS;
  };
  const windowMs = Math.max(0, until - Date.now());
  const outcome = await awaitArrivalOrRetry(() => progress.hasUnreadItem() || settled(), shown, windowMs, retries, progress.deadline);
  if (outcome === "timed_out") return outcome;
  return progress.hasUnreadItem() ? "changed" : "unchanged";
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
