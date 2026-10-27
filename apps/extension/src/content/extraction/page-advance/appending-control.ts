// Which control a `loadMore` move presses on the page it is on.
//
// A load-more way names its control by the selector detection wrote, and where
// the control carries no id or test id that selector is a position:
// `ul > li:nth-of-type(14) > div`. A control that sits at the end of the list it
// grows moves down a slot with every batch, and the position it was saved at
// then names one of the list's own items. Photo-social's comment thread is the
// case (t755): its Load more was detected in the fourteenth slot, the first
// press loaded twelve comments, and the second pressed the thirteenth comment's
// body and failed `list_unchanged` ten seconds later; once the thread had loaded
// whole the same selector would have pressed a comment where the list had
// ended.
//
// So the authored selector is where the move starts, not the last word, as for
// a Next (`../detect-pagination.ts`, `nextControlOnPage`):
//
// 1. the authored control, wherever it names something outside the list's own
//    items -- an item's own content is never the list's way on, as detection
//    never offers one;
// 2. otherwise the load-more control found around the list now, the way
//    detection finds one, wherever it has moved;
// 3. otherwise there is none, and the list has ended there.

import { detectPagination } from "../detect-pagination";

/** The control a `loadMore` move presses on this page, or `undefined` when the page shows none; see the header. */
export function loadMoreControlOnPage(named: Element | null, run: readonly Element[]): Element | undefined {
  if (named !== null && !run.some((item) => item === named || (typeof item.contains === "function" && item.contains(named)))) return named;
  const container = run[0]?.parentElement ?? null;
  const way = container === null ? undefined : detectPagination(run, container);
  return (way?.mode === "loadMore" ? document.querySelector(way.control) : null) ?? undefined;
}
