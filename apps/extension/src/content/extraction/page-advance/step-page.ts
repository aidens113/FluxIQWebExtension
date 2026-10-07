// One step of a list to its next page, in each way a list continues. The
// read's paged loop (`../pagination.ts`) takes one per page it reads, held to
// its bound; `web.dom.next_page` (`./move-page.ts`) takes exactly one, with no
// bound. The answer says what happened (`PageStep`): `advanced` and how,
// `ended` with the word that says why, `truncated` at a bound, or `timed_out`.
//
// The ways (`WebAutomationNextPageWay`, the read's pagination modes without
// their bounds):
// - `next`, which an absent mode also means: follow the Next control
//   (`./follow-next.ts`). With no way at all -- a next-page step whose list
//   carried no pagination -- the pager's Next is found from the list. A page
//   that shows items and no way forward is watched for one briefly before the
//   list counts as ended. After a click the list must become a different list
//   -- its first item detached or replaced, or its length changed -- within ten
//   seconds, or the page ignored its own control and the step fails
//   (`./list-change.ts`). The old page staying on screen while the new one
//   loads reads as "not yet changed", never as a second read of the same page;
//   the followed control detaching, as a pager redrawn with its results does,
//   is a change too. A document that began unloading after the click has not
//   ignored it, so it gets a second window: its replacement is the change, and
//   the worker carries the command into it (`runtime/extract-list-continuation.ts`).
//   Once the list has changed, the step waits for the new page to show its
//   records (`../page-render.ts`).
// - `loadMore`: press `control`, then wait for an item not shown before
//   (`./load-more.ts`).
// - `scroll`: scroll the list's scroller to its bottom and wait for an item
//   not shown before (`./scroll-for-more.ts`).
// - `numbered`: click the page control that follows the current page
//   (`./numbered-page.ts`).
//
// Every step checks the command's deadline before it presses, and never moves
// past the last page it reached, so a read that finishes leaves the page
// showing its last page (decision D5). Every step that does not advance says
// why, in one closed word, and so does every throw, through `PaginationFault`.
// Until 2026-09-28 a read that stopped said only whether a bound cut it short:
// live run `run-mulwm2dc-0bd95f22` asked for fifty pages, read one, and the
// bundle could not say whether the control was absent, disabled, leading back
// to its own page, or pressed and ignored.

import type { WebAutomationNextPageWay } from "../../../shared/protocol";
import { followNext } from "./follow-next";
import { pressLoadMore } from "./load-more";
import { visitNumberedPage } from "./numbered-page";
import { scrollForMore } from "./scroll-for-more";
import type { PageStep, PaginationProgress } from "./types";

/**
 * Moves the list on by one page the way `way` says, or by the pager's Next
 * found from the list when `way` is absent. `bound` is the read's: pages for
 * every way but `scroll`, scrolls for `scroll`; a next-page step has none.
 */
export async function stepPage(way: WebAutomationNextPageWay | undefined, progress: PaginationProgress, bound: number | undefined): Promise<PageStep> {
  if (way === undefined) return await followNext(undefined, progress, bound);
  switch (way.mode) {
    case undefined:
    case "next":
      return await followNext(way, progress, bound);
    case "loadMore":
      return await pressLoadMore(way, progress, bound);
    case "scroll":
      return await scrollForMore(progress, bound);
    case "numbered":
      return await visitNumberedPage(way, progress, bound);
    default: {
      const mode: unknown = (way as { mode?: unknown }).mode;
      const named = typeof mode === "string" ? `pagination mode ${JSON.stringify(mode)}` : "a pagination mode that is not a string";
      throw new Error(`The page does not know ${named}.`);
    }
  }
}
