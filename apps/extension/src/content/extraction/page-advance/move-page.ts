// `web.dom.next_page` on the page (contract C1, design 4.2(a)): one step of a
// list to its next page, as the read used to take between the pages it read.
//
// 1. The list must be here: its first item is waited for briefly, and a page
//    that shows none of it fails `list_vanished` -- a Next page on a list that
//    is not there is not the list ending.
// 2. The way forward is the request's `pagination`, or, where the list carried
//    none, the pager's Next found by walking up from the first item
//    (`../detect-pagination.ts`, `nextControlOnPage`): a Next, the following
//    page where Next leads to this same page (`by: "following"`), a numbered
//    page, Load more, or a scroll (`./step-page.ts`).
// 3. A disabled or absent control is never pressed: the list has ended, and the
//    answer says why (`control_absent`, `control_disabled`,
//    `no_following_page`, `scrolled_to_end`).
// 4. Otherwise the page load is booked on the worker's pace, the press is
//    marked to the worker (`options.mark`), the control is pressed, and the
//    list must change, a cancelled link going by its own address
//    (`./list-change.ts`). A press that loads a new document takes this script
//    with it; the worker sends the command again with the mark, and the new
//    document answers for it (`./arrival.ts`).
//
// One step moves one page and has no bound; a Flow that wants every page loops
// over the step. A numbered pager that does not say which page is current
// fails `page_fault` rather than guessing: a step keeps no count of the pages
// before it, and a guess from page three would choose page two.

import type { WebAutomationNextPageRequest } from "../../../shared/protocol";
import { arriveAfterMove, awaitListItems } from "./arrival";
import { deadlineFor } from "./list-change";
import { failedMove, stoppedMove, type PageMoveOptions, type PageMoveOutcome } from "./move-outcome";
import { paginationStopOf } from "./pagination-fault";
import { pageShownNow } from "./shown-page";
import { stepPage } from "./step-page";
import type { PageStep, PaginationProgress } from "./types";

/** How long the list's first item is waited for before the step: the read before it has normally drawn it already. */
const LIST_WINDOW_MS = 5_000;

/** Moves the list to its next page, or says it has none; see the header. */
export async function movePage(request: WebAutomationNextPageRequest, options: PageMoveOptions = {}): Promise<PageMoveOutcome> {
  const deadline = deadlineFor(options.timeoutMs);
  if (options.resume !== undefined) return await arriveAfterMove(request, options.resume, deadline, options);
  const shown = await awaitListItems(request.item, LIST_WINDOW_MS, deadline);
  if (shown === "timed_out") return { outcome: "timed_out", reason: "The time ran out before the list showed on the page." };
  if (shown.length === 0) return failedMove("list_vanished", `No item matching ${JSON.stringify(request.item)} is on the page, so there is no list to move on.`);
  const way = request.pagination;
  const current = pageShownNow(way, request.item);
  if (way?.mode === "numbered" && current === undefined) {
    return failedMove("page_fault", `The pager ${JSON.stringify(way.pages)} does not say which page is showing, so the page after it is not known.`);
  }
  const before = new Set(shown);
  const mark = options.mark;
  const progress: PaginationProgress = {
    item: request.item,
    shown,
    pagesRead: current ?? 1,
    scrolls: 0,
    deadline,
    hasUnreadItem: () => Array.from(document.querySelectorAll(request.item)).some((element) => !before.has(element)),
    beforeFollow: mark === undefined ? undefined : (by) => mark({ by })
  };
  let step: PageStep;
  try {
    step = await stepPage(way, progress, undefined);
  } catch (error) {
    return stoppedMove(paginationStopOf(error), error instanceof Error ? error.message : "Moving the list to its next page failed.");
  }
  switch (step.outcome) {
    case "advanced": {
      const page = pageShownNow(way, request.item);
      return { outcome: "moved", by: step.by, ...(page === undefined ? {} : { page }) };
    }
    case "timed_out":
      return { outcome: "timed_out", reason: "The time ran out before the list reached its next page." };
    case "truncated":
      return failedMove("list_unchanged", `Scrolling ${progress.scrolls} times brought no new item of the list, though the page was not at its bottom.`);
    default:
      return stoppedMove(step.stop, `The move stopped on ${step.stop}.`);
  }
}
