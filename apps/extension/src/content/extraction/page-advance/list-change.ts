// Pressing a control that moves a list, and telling that it moved: the press
// itself, the cancelled-link fallback, and the wait for the list to become a
// different list (`./step-page.ts` says what each way of moving needs of it).
//
// **A click the page cancelled** is absorbed rather than ended on. The job
// board cancels every click outside its consent wall while the wall is open --
// `click()` included -- so a press of Next waited ten seconds for a change that
// could not come, and the read ended on page one. A link says where it goes, so
// when the page cancelled the click (or the list did not change at all) and the
// control is a link to another document, the move goes there by the link's own
// address. That is exactly what the click would have done, and it answers
// nothing on the page's behalf: no dialog is accepted or dismissed.

import type { WebAutomationExtractListPagination } from "../../types";
import type { WebAutomationNextPageBy, WebAutomationNextPageWay } from "../../../shared/protocol";
import { waitUntil, type WaitOutcome } from "../list-wait";
import { awaitPageRendered } from "../page-render";
import { linkAddress, sameDocument } from "../pager-reading";
import { PaginationFault } from "./pagination-fault";
import type { PageStep, PaginationProgress } from "./types";

/** How long the list has to change after a control was followed. */
export const LIST_CHANGE_TIMEOUT_MS = 10_000;
/**
 * How long a link whose click the page cancelled is given to change the list
 * before the move goes where the link says. A client-side router cancels a
 * link's click and draws the next page itself, so a cancelled click is not by
 * itself an ignored one; a router that has not changed the list in this long
 * lands on the same page by the link's address anyway.
 */
const CANCELLED_LINK_WINDOW_MS = 2_000;
export const LIST_CHANGE_POLL_MS = 25;

/** `element` as the control to press, or a `control_not_clickable` fault naming `selector`. */
export function clickable(element: Element, selector: string | undefined): HTMLElement {
  if (!(element instanceof HTMLElement)) {
    throw new PaginationFault("control_not_clickable", `The pagination control ${selector === undefined ? "the pager offered" : JSON.stringify(selector)} is not a clickable element.`);
  }
  return element;
}

/** When the whole command must stop, or `undefined` when it set no positive `timeoutMs`. */
export function deadlineFor(timeoutMs: number | undefined): number | undefined {
  return typeof timeoutMs === "number" && Number.isFinite(timeoutMs) && timeoutMs > 0 ? Date.now() + timeoutMs : undefined;
}

export function pastDeadline(deadline: number | undefined): boolean {
  return deadline !== undefined && Date.now() >= deadline;
}

/**
 * Clicks `control`, then waits for the list to become a different list and for
 * the page it became to show its records, failing the move when the page
 * ignored its control.
 *
 * A document that starts unloading after the click has not ignored it: the
 * page it is loading is the change, however slow the server. It is given one
 * more window, and if it does unload within it, this script and the wait go
 * with it and the worker carries the command into the next document.
 *
 * A link to another document that did not change the list -- because the page
 * cancelled its click, or because nothing happened at all -- is followed by its
 * own address before the move gives up (see the header). A cancelled click gets
 * `CANCELLED_LINK_WINDOW_MS` first rather than the whole window, since a page
 * that cancels a click it is not going to act on is the common case the header
 * measured, and ten seconds a page is what that cost.
 */
export async function afterListChange(
  way: WebAutomationNextPageWay | undefined,
  progress: PaginationProgress,
  control: HTMLElement,
  action: string,
  by: WebAutomationNextPageBy
): Promise<PageStep> {
  const { item, shown, deadline } = progress;
  const address = linkAddress(control);
  const elsewhere = address !== undefined && !sameDocument(address, new URL(document.URL)) ? address : undefined;
  const leaving = watchUnload();
  let outcome: WaitOutcome;
  let byAddress = false;
  try {
    const cancelled = clickNoticingCancel(control);
    const changed = (): boolean => listChanged(item, shown) || !control.isConnected;
    const firstWindow = cancelled && elsewhere !== undefined ? CANCELLED_LINK_WINDOW_MS : LIST_CHANGE_TIMEOUT_MS;
    outcome = await waitUntil(changed, firstWindow, LIST_CHANGE_POLL_MS, deadline);
    if (outcome === "unchanged" && elsewhere !== undefined && !leaving.started()) {
      byAddress = true;
      window.location.assign(elsewhere.href);
      outcome = await waitUntil(changed, LIST_CHANGE_TIMEOUT_MS, LIST_CHANGE_POLL_MS, deadline);
    }
    if (outcome === "unchanged" && leaving.started()) outcome = await waitUntil(changed, LIST_CHANGE_TIMEOUT_MS, LIST_CHANGE_POLL_MS, deadline);
  } finally {
    leaving.stop();
  }
  if (outcome === "unchanged") {
    const also = byAddress ? ", or of going to the address it links to" : "";
    throw new PaginationFault("list_unchanged", `The list did not change within ${LIST_CHANGE_TIMEOUT_MS}ms of ${action}${also}.`);
  }
  if (outcome === "timed_out") return { outcome: "timed_out", stop: "deadline" };
  return await awaitPageRendered(renderedAs(way), progress) === "arrived" ? { outcome: "advanced", by } : { outcome: "timed_out", stop: "deadline" };
}

/**
 * The way as the render wait reads it (`../page-render.ts`), which asks only
 * which controls show the page has drawn its pager. The bound it carries is
 * never read there. A way found live from the list names no control, so the
 * wait is for an unread item alone, as a scroll's is.
 */
function renderedAs(way: WebAutomationNextPageWay | undefined): WebAutomationExtractListPagination {
  if (way === undefined || way.mode === "scroll") return { mode: "scroll", maxScrolls: 1 };
  if (way.mode === "loadMore") return { mode: "loadMore", control: way.control, maxPages: 1 };
  if (way.mode === "numbered") return { mode: "numbered", pages: way.pages, maxPages: 1 };
  return { next: way.next, maxPages: 1 };
}

/**
 * Clicks the control and says whether the page cancelled the click.
 *
 * The page's own listeners see the click first and may cancel it and stop it
 * propagating, so the event is caught on its way down, at the window, and read
 * once `click()` has returned: dispatch is synchronous, so by then every
 * listener has had its say.
 */
function clickNoticingCancel(control: HTMLElement): boolean {
  let clicked: Event | undefined;
  const notice = (event: Event): void => {
    if (clicked === undefined && event.target instanceof Node && (event.target === control || control.contains(event.target))) clicked = event;
  };
  window.addEventListener("click", notice, true);
  try {
    control.click();
  } finally {
    window.removeEventListener("click", notice, true);
  }
  return clicked?.defaultPrevented === true;
}

/** Notices this document beginning to unload, until stopped. */
function watchUnload(): { started(): boolean; stop(): void } {
  let unloading = false;
  const notice = (): void => { unloading = true; };
  window.addEventListener("beforeunload", notice);
  window.addEventListener("pagehide", notice);
  return {
    started: () => unloading,
    stop: () => {
      window.removeEventListener("beforeunload", notice);
      window.removeEventListener("pagehide", notice);
    }
  };
}

/**
 * Whether the list became a different list. A page that replaces its results
 * detaches the old items, and one that appends changes their number, so both
 * are observed without knowing how the page loads. The followed control
 * detaching says the same of a page whose pager is redrawn with its results,
 * which is the only sign a page that showed no item can give (see
 * `afterListChange`).
 */
function listChanged(itemSelector: string, previous: readonly Element[]): boolean {
  const current = document.querySelectorAll(itemSelector);
  const first = previous[0];
  if (!first) return current.length > 0;
  return !first.isConnected || current.length !== previous.length || current[0] !== first;
}
