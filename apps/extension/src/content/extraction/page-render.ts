// Waiting for a page a list read has just reached to show its records.
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
