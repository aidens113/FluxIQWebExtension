// Waiting for a list to show its records: the page the read has just reached,
// and the page it starts on.
//
// **The page it starts on needs the same wait, and until 2026-09-23 it had
// none.** `extractList` queried the document the moment it was called, so a
// read dispatched against a page still rendering its list read an empty one
// and reported it as a successful read of nothing. A recorded Flow hid this
// because its recording carries an explicit wait step; a Flow a model built by
// running nodes carries no such step, so on the everything-store -- whose
// results replace eight placeholder cards 700ms after load -- the built Flow
// replayed every step and returned 0 records where 16 were expected. Measured
// model-free: the same request that read 20 records on the settled page read
// **0** on a fresh one and 15 a second and a half later.
//
// `awaitListPresent` is that wait, and it is a ceiling rather than a sleep: the
// read goes on the instant the page holds the items the request requires, so a
// fast page is read as fast as it ever was. What it waits *for* is the
// request's own `minItems` -- the author's statement of what the page must hold
// -- so a read told an empty list is a valid answer (`minItems: 0`, which the
// picker's preview sends) waits for nothing at all, and a read of one page told
// to expect sixteen waits for the sixteenth rather than reading the twelve that
// rendered first. A read that pages waits only for its first item, because the
// rest may legitimately be on a later page.
//
// A list that changed has not necessarily arrived. A client-rendered search
// replaces its results with skeleton cards the moment a page number is
// pressed, fetches, and only then draws the next page; a search asked for
// pages too quickly answers with a security check first and the page later; a
// Next that loads a new document can land on a page still drawing. Reading at
// the first change reads the skeleton -- nothing -- and a numbered read then
// finds no page controls either, so it ends on page 1 believing the list did.
//
// So a page counts as arrived when it shows an item the read has not taken.
// A page can also truly hold no item the read wants -- a filtered read of a
// page whose every listing is filtered out -- and that page must not be waited
// on for ever, so it counts as arrived once it has shown its pagination
// controls, and still no such item, for `EMPTY_PAGE_SETTLE_MS`. The controls
// are the difference between the two cases above: a skeleton or a check draws
// none, because the page's controls come with its results. Short of either,
// the wait gives up after `RENDER_WINDOW_MS` and the page is read as it stands,
// which on the last page of a list whose controls end with it is the ordinary
// way such a read finishes. The command's deadline bounds all of it.

import type { WebAutomationExtractListPagination } from "../types";
import { waitUntil } from "./list-wait";

/** Whether the page arrived, or the command's deadline passed first. */
export type PageArrival = "arrived" | "timed_out";

/** What the wait needs to know about the read: its deadline, and whether the page shows an item it has not taken. */
export type RenderProgress = { deadline: number | undefined; hasUnreadItem(): boolean };

/** How long a page the read reached is given to show its records or settle without them. */
const RENDER_WINDOW_MS = 10_000;
/** How long a page must show its pagination controls and no unread item to be read as holding none. */
const EMPTY_PAGE_SETTLE_MS = 2_000;
/** How long a one-page read's list must stop growing to be read: the window `pagination.ts` gives a lazy list to grow. */
const LIST_GROWTH_SETTLE_MS = 900;
const RENDER_POLL_MS = 50;

/** Waits for the page the read has just reached to show its records; see the header. */
export async function awaitPageRendered(paginate: WebAutomationExtractListPagination, progress: RenderProgress): Promise<PageArrival> {
  let settlingSince: number | undefined;
  const arrived = (): boolean => {
    if (progress.hasUnreadItem()) return true;
    if (!paginationControlsShown(paginate)) {
      settlingSince = undefined;
      return false;
    }
    settlingSince ??= Date.now();
    return Date.now() - settlingSince >= EMPTY_PAGE_SETTLE_MS;
  };
  const outcome = await waitUntil(arrived, RENDER_WINDOW_MS, RENDER_POLL_MS, progress.deadline);
  return outcome === "timed_out" ? "timed_out" : "arrived";
}

/**
 * Waits for the page the read starts on to hold `required` items, and, for a
 * read of one page, for that list to stop growing.
 *
 * `required` is the request's `minItems`, held to at least one. An empty list
 * and a list the page has not drawn yet are the same document, so a read that
 * did not wait for one could not tell them apart -- and `minItems: 0` says
 * "an empty list is a valid answer", which is a post-condition rather than an
 * instruction to read early. Live, the model wrote `minItems: 0` on the very
 * first Flow built after this wait landed (`run-mudqlqsk-8876a3ea`), so a wait
 * that took it literally would have been switched off by the one party it
 * exists to protect. A list that is there is still read at once; only a list
 * that never appears pays the window.
 *
 * The settle is only for a read that does not page. A paginated read has its
 * own mechanism for a list that grows -- `pagination.ts` follows the control
 * or scrolls and waits for the list to change -- and adding a second one would
 * spend that read's deadline twice. A read of one page has none, so a list
 * that arrives in two parts, as a results page whose last items load when the
 * bottom scrolls into view does, would be read at its first part.
 *
 * All of it is bounded by `RENDER_WINDOW_MS` and by the command's own
 * deadline, and running out of either is not a failure here: the read proceeds
 * and reads what the page holds, so what it reports is still the page as it
 * stands rather than an error this module invented.
 */
export async function awaitListPresent(item: string, required: number, settle: boolean, progress: RenderProgress): Promise<void> {
  const wanted = Math.max(1, required);
  await waitUntil(() => matchCount(item) >= wanted, RENDER_WINDOW_MS, RENDER_POLL_MS, progress.deadline);
  if (!settle) return;
  let count = matchCount(item);
  let stableSince = Date.now();
  await waitUntil(
    () => {
      const now = matchCount(item);
      if (now !== count) {
        count = now;
        stableSince = Date.now();
        return false;
      }
      return Date.now() - stableSince >= LIST_GROWTH_SETTLE_MS;
    },
    RENDER_WINDOW_MS,
    RENDER_POLL_MS,
    progress.deadline
  );
}

/** How many elements the item selector names, treating a selector the browser cannot parse as naming none. */
function matchCount(item: string): number {
  try {
    return document.querySelectorAll(item).length;
  } catch {
    return 0;
  }
}

/** Whether the page shows the controls the request pages with. A scroll read has none, so it never settles early. */
function paginationControlsShown(paginate: WebAutomationExtractListPagination): boolean {
  switch (paginate.mode) {
    case undefined:
    case "next":
      return document.querySelector(paginate.next) !== null;
    case "loadMore":
      return document.querySelector(paginate.control) !== null;
    case "numbered":
      return document.querySelector(paginate.pages) !== null;
    default:
      return false;
  }
}
