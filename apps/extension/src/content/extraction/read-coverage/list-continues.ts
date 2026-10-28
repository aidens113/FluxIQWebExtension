// Whether a read of one page saw its list go on past what it read.
//
// A read that was not asked to page reads one page, by design, and that is
// right: later passes of a loop collect the rest. What it owes is to say, as a
// fact, when the list it read visibly goes on, because a count of the items it
// saw cannot say it. Live run `run-mveaaqxn-d0be9888` read 5 items of a feed
// that loaded more as it was scrolled, kept 1, and its builder was told the
// counts looked right; three revisions repeated the same read of one page.
//
// **No new heuristic.** The answer is the reader's own detection, asked about
// the items the read just read, in this order: `nextControlOnPage`, the control
// a Next read would follow from here -- the pager's Next, or the page number
// after the current one; then `detectPagination`, for a Load more beside the
// list; then the read's own reveal (`list-wait.ts`): a list still growing when
// the read ran out of reveals goes on as it is scrolled. A way on that is
// disabled, or a pager with no page after the current one, is a list that
// ended, and says nothing; so does a feed signal beside a pager, as structure
// detection already rules (`detect-structure.ts`). Nothing read here leaves the
// page but two closed words (decision D3).
//
// **A declared feed is not enough on its own.** `isDeclaredFeed` says the page
// marks the list as one that loads more as it is scrolled, and such a feed
// still has an end: an end-of-feed note under it, or simply nothing more when
// scrolled. The page shows that end the same way to the read's reveal -- it
// stops growing -- so a feed continues only where the reveal ran out while it
// was still growing, and the declaration says only which word is the evidence
// (`declared_feed`, else `still_growing`). The code knows no end-of-list
// wording, and none is added: growth is the one signal a page of any language
// gives.
//
// **A list whose loader asked to wait has not ended** (t755, `./loader-wait.ts`).
// A list is going on, ended, or paused by the site. A loader that refuses a
// reveal made too soon puts a notice where the next part would come, nothing
// grows, and the list looked ended; it is said to go on as it is scrolled, with
// `loader_asked_to_wait` as the evidence, never `still_growing`, since nothing
// grew. The wording read is the closed wait and busy phrases the click's
// rate-limit watch already reads, not an end-of-list wording: an end still
// sends nothing, and a list that ended is said by Next page's `ended` answer.
//
// **Replies the page leaves closed are coverage too** (t762). A thread's items
// can each carry a control that opens more of the thread ("View 3 replies", "Show
// more replies") and the read, which reads what is on the page, reads none of what
// those controls hold. Where the list shows no other way on, an item carrying
// one says `unopened_replies` (`./unopened-replies.ts`), so the builder opens
// them before it reads. A way on the list does have is said first; this one is
// said only for a list with none, and never for a snapshot's list (`./list-way-on.ts`).

import type { BrowserActionResult } from "../../types";
import { hasUnopenedReplies } from "./unopened-replies";
import { wayOnPast } from "./way-on-past";

/** The fact, as the domain's summary carries it (`domain/src/actions/extraction/list-continues.ts`). */
export type ListContinues = NonNullable<NonNullable<BrowserActionResult["extraction"]>["listContinues"]>;

/**
 * How the list whose items are `run` goes on past them, or `undefined` for a
 * list that ended or says nothing. `stillGrowing` is whether the read's reveal
 * ran out of reveals while the list still grew (`list-wait.ts`, `"growing"`).
 */
export function listContinuesPast(run: readonly Element[], stillGrowing = false): ListContinues | undefined {
  return wayOnPast(run, stillGrowing) ?? (hasUnopenedReplies(run) ? { kind: "load_more", evidence: "unopened_replies" } : undefined);
}
