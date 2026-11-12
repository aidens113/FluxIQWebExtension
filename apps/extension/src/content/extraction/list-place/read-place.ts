// Where in its list a read of one page was, as the page's own pager says it
// (invariant I3, `domain/src/actions/extraction/list-continues.ts`): never
// derived from row contents. A whole static list has offset zero; an unknown window has no place.
//
// In this order: a numbered or next-link pager's current page number
// (`pageShownNow`); a page, offset or cursor parameter the pager's own Next
// link moves along, read from the document's address; a Load more or
// infinite list that grew by appending, the offset of the first item the read
// returns. A list that continues by a way the page does not mark says nothing.

import type { ExtractionPlace } from "./place";
import { hasPagerOnPage, nextControlOnPage } from "../detect-pagination";
import { pageShownNow } from "../page-advance";
import { placeFromAddress } from "./address-place";
import { grewByAppending } from "./appended-offset";
import { isDeclaredFeed } from "../feed-signal";

export type ReadPlaceFacts = {
  /** The item selector the read used. */
  item: string;
  /** The items as the read found them. */
  run: readonly Element[];
  /** How the list goes on past the read (the kind of its `listContinues`), if it does. */
  listContinues: string | undefined;
  /** The items the list had before the read revealed more of it. */
  itemsAtStart: readonly Element[];
  /** Whether the read was of one document, unsorted, so its first item is the list's own first. */
  whole: boolean;
  /** The index in `run` of the first item the read returned, if any. */
  firstReturned: number | undefined;
};

export function readPlace(facts: ReadPlaceFacts): ExtractionPlace | undefined {
  // A document with no element classes (a stood-in one) has no pager controls to read.
  if (typeof HTMLElement === "undefined") return undefined;
  const page = pageShownNow(undefined, facts.item);
  if (page !== undefined) return page >= 1 ? { kind: "page", value: page } : undefined;
  const next = nextControlOnPage(null, facts.run);
  if (next !== undefined) return placeFromAddress(next.control);
  const loadsMore = facts.listContinues === "load_more" || facts.listContinues === "infinite_scroll";
  const appended = facts.whole && loadsMore && grewByAppending(facts.itemsAtStart, facts.run);
  // A whole noncontinuing DOM list has an observed origin, even when all its items were filtered out.
  // Partial/growing/paged windows cannot claim it: their actual pager or append evidence must name their place.
  if (facts.whole && facts.run.length > 0 && facts.listContinues === undefined && !hasPagerOnPage(facts.run) && !isDeclaredFeed(facts.run, facts.run[0]?.parentElement ?? null) && !declaredWindow(facts.run)) return { kind: "offset", value: 0 };
  return appended && facts.firstReturned !== undefined ? { kind: "offset", value: facts.firstReturned } : undefined;
}

/** A declared set larger than the mounted run, or positions away from its origin, is a window. */
function declaredWindow(run: readonly Element[]): boolean {
  return run.some((item, index) => {
    const size = Number(item.getAttribute("aria-setsize"));
    if (Number.isSafeInteger(size) && size > run.length) return true;
    return ["aria-posinset", "aria-rowindex"].some((name) => {
      const written = item.getAttribute(name);
      if (written === null) return false;
      const position = Number(written);
      return Number.isSafeInteger(position) && position !== index + 1;
    });
  });
}
