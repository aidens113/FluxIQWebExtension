// The way forward of a list that carried none: a next-page step whose list was
// detected with no pagination (`./step-page.ts`, an absent way).
//
// The pager's Next, found by walking up from the list's first item
// (`./follow-next.ts`), is followed wherever the page shows one, a disabled
// one included, so a control is always preferred to a scroll and a pager's
// last page still ends on its own word. Where the page shows no Next, a
// load-more control found around the list the way detection finds one
// (`../detect-pagination.ts`) is pressed (`./load-more.ts`). Only where the
// page shows no way forward at all is the list scrolled for more
// (`./scroll-for-more.ts`): a list the page loads in parts as it is scrolled
// shows no control, and until 2026-10-17 such a list ended there on
// `control_absent` while the page would have drawn its next part, though Next
// page promises to scroll. Detection says a list scrolls only where the page
// declares a feed (`../detect-structure.ts`), and a list that grows on scroll
// declares nothing it has to. A list that does not grow ends there on
// `scrolled_to_end` once the scroll's bounded wait is over.
//
// **Why a load-more control is looked for here too** (t755). A list's way on
// is detected when its handle is minted, and a list detected while it showed
// no way -- a comment thread looked at after it had loaded whole, or one whose
// control detection could not name -- carries none, though a run from the
// start meets the control on screen. Live run `run-mvebbeom-a60886e1`
// (photo-social priya-tags) is the case: its Next page on such a thread found
// no Next, scrolled a list that grows only by its Load more, and answered
// ended on `scrolled_to_end` after one batch, so the loop left and the read saw
// 25 of 41 comments.

import { detectPagination } from "../detect-pagination";
import { followNext } from "./follow-next";
import { pressLoadMore } from "./load-more";
import { scrollForMore } from "./scroll-for-more";
import type { PageStep, PaginationProgress } from "./types";

/** Follows the pager's Next found from the list, presses its load-more control where it shows no Next, or scrolls the list for more where it shows neither; see the header. */
export async function followFoundWay(progress: PaginationProgress, bound: number | undefined): Promise<PageStep> {
  const step = await followNext(undefined, progress, bound);
  if (step.outcome !== "ended" || step.stop !== "control_absent") return step;
  const container = progress.shown[0]?.parentElement ?? null;
  const way = container === null ? undefined : detectPagination(progress.shown, container);
  if (way?.mode === "loadMore") return await pressLoadMore({ mode: "loadMore", control: way.control }, progress, bound);
  return await scrollForMore(progress, bound);
}
