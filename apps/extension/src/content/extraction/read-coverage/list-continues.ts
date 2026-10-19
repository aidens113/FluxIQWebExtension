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

import type { BrowserActionResult } from "../../types";
import { detectPagination, nextControlOnPage } from "../detect-pagination";
import { isDeclaredFeed } from "../feed-signal";

/** The fact, as the domain's summary carries it (`domain/src/actions/extraction/list-continues.ts`). */
export type ListContinues = NonNullable<NonNullable<BrowserActionResult["extraction"]>["listContinues"]>;

/**
 * How the list whose items are `run` goes on past them, or `undefined` for a
 * list that ended or says nothing. `stillGrowing` is whether the read's reveal
 * ran out of reveals while the list still grew (`list-wait.ts`, `"growing"`).
 */
export function listContinuesPast(run: readonly Element[], stillGrowing = false): ListContinues | undefined {
  const container = run[0]?.parentElement ?? null;
  if (container === null) return undefined;
  // The control a Next read would follow from this page, a disabled one included: a disabled one is the list ending.
  const next = nextControlOnPage(null, run);
  if (next !== undefined) return isEnabled(next.control) ? { kind: "next_page", evidence: next.by === "number" ? "following_page_number" : "next_control" } : undefined;
  const pagination = detectPagination(run, container);
  if (pagination === undefined) return stillGrowing ? { kind: "infinite_scroll", evidence: isDeclaredFeed(run, container) ? "declared_feed" : "still_growing" } : undefined;
  if (pagination.mode !== "loadMore") return undefined;
  const control = document.querySelector(pagination.control);
  return control !== null && isEnabled(control) ? { kind: "load_more", evidence: "load_more_control" } : undefined;
}

/** Whether a control is offered rather than drawn disabled, as a pager draws its last page's Next. */
function isEnabled(control: Element): boolean {
  return control.getAttribute("aria-disabled") !== "true" && control.getAttribute("disabled") === null;
}
