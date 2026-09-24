// How `web.dom.extract_list` reaches the next page of a list in each pagination
// mode, and how long the whole read may take.
//
// `list-reader.ts` reads the items the page shows, then calls `advancePage`
// once per page. The answer says what happened:
// - `advanced`: the page now shows items the read has not taken;
// - `ended`: the list has no more pages, which is not truncation;
// - `truncated`: the mode's bound stopped the read while the list could have
//   gone on;
// - `timed_out`: the command's deadline passed before the next page arrived.
//
// The modes (`WebAutomationExtractListPagination`):
// - `next`, which an absent mode also means. A proposal names it explicitly
//   (`detect-pagination.ts`), so an omission reaching here is a caller's rather
//   than a proposal's -- though the domain's own parse drops the name again,
//   because a parsed request is copied exactly and adding a field it was not
//   sent would break that. Either way: follow the `next` control until
//   it is absent. After a click the list must become a different list -- its
//   first item detached or replaced, or its length changed -- within ten
//   seconds, or the page ignored its own control and the read fails. The old
//   page staying on screen while the new one loads reads as "not yet changed",
//   never as a second read of the same page; the followed control detaching,
//   as a pager redrawn with its results does, is a change too. A document
//   that began unloading after the click has not ignored it, so it gets a
//   second window: its replacement is the change, and
//   `runtime/extract-list-continuation.ts` carries the read into it. Once the
//   list has changed, the read waits for the new page to show its records
//   (`page-render.ts`) before reading it.
// - `loadMore`: press `control`, then wait until an item appears that the read
//   has not taken, or the control detaches. An absent, disabled or
//   `aria-disabled="true"` control is the list ending. A live control that
//   yields nothing in ten seconds fails the read, as `next` does.
// - `scroll`: scroll the nearest scrollable ancestor of the first item, or the
//   window, to its bottom, and wait up to 900 ms -- the window the scroll verb
//   gives a lazy feed to grow -- for an item the read has not taken. The growth
//   signal is item identity, not document height. Nothing new while at the
//   bottom is the list ending; nothing new while no longer at the bottom (a
//   loading indicator grew the page) scrolls again. Every scroll counts toward
//   `maxScrolls`.
// - `numbered`: re-query the `pages` controls after every change and click the
//   one that follows the current page: the control numbered one more than the
//   control marked `aria-current`, or that control's next sibling among them
//   when it carries no number, or, when none is marked, the control after the
//   ones already read, in document order. No following control is the list
//   ending. The change and the wait for records are those of `next`.
//
// For `next`, `loadMore` and `numbered`, having read `maxPages` pages while a
// way forward is still there is truncation; for `scroll`, having scrolled
// `maxScrolls` times. Every bound is held to the domain's page bound. Every
// mode checks the command's deadline before each advance and never moves past
// the last page it read, so a read that finishes leaves the page showing its
// last page (decision D5).

import { WEB_AUTOMATION_EXTRACT_MAX_PAGES } from "@fluxiq-web-extension/domain/client";
import type { WebAutomationExtractListPagination } from "../types";
import { waitUntil, type WaitOutcome } from "./list-wait";
import { awaitPageRendered } from "./page-render";

/** What one advance did: see the header. */
export type PageAdvance = "advanced" | "ended" | "truncated" | "timed_out";

/** The read's progress, which the list reader updates before each advance and `advancePage` reads. */
export type PaginationProgress = {
  /** The item selector. */
  item: string;
  /** The items the page showed at the last read, in document order. */
  shown: readonly Element[];
  /** Pages read so far, the first included. */
  pagesRead: number;
  /** Scrolls made so far. `advancePage` counts each `scroll` it makes here. */
  scrolls: number;
  /** When the whole read must stop, or `undefined` when nothing bounds it. */
  deadline: number | undefined;
  /** Whether the page shows an item the read has not taken. */
  hasUnreadItem(): boolean;
  /** Called, and awaited, just before a control is followed: the last moment the read so far is certainly still here. */
  beforeFollow?: (() => Promise<void>) | undefined;
};

type NextPagination = Extract<WebAutomationExtractListPagination, { next: string }>;
type LoadMorePagination = Extract<WebAutomationExtractListPagination, { mode: "loadMore" }>;
type ScrollPagination = Extract<WebAutomationExtractListPagination, { mode: "scroll" }>;
type NumberedPagination = Extract<WebAutomationExtractListPagination, { mode: "numbered" }>;

/** How long the list has to change after a control was followed. */
const LIST_CHANGE_TIMEOUT_MS = 10_000;
const LIST_CHANGE_POLL_MS = 25;
/** How long a scroll waits for an unread item: the window `actions/scroll.ts` gives a lazy feed to grow. */
const SCROLL_GROWTH_WINDOW_MS = 900;
const SCROLL_POLL_MS = 50;
/** Subpixel layout and rounding differences do not keep a scroller from counting as at its bottom. */
const BOTTOM_TOLERANCE_PX = 2;

/**
 * The mode's bound held to the domain's page bound and to at least 1:
 * `maxScrolls` for `scroll`, `maxPages`, the first page included, for the rest.
 * A bound that is not a number reads as 1, so nothing sent straight to the
 * page can make a read unbounded.
 */
export function paginationBound(paginate: WebAutomationExtractListPagination): number {
  const requested: unknown = paginate.mode === "scroll" ? paginate.maxScrolls : paginate.maxPages;
  const whole = typeof requested === "number" && !Number.isNaN(requested) ? Math.trunc(requested) : 1;
  return Math.min(Math.max(1, whole), WEB_AUTOMATION_EXTRACT_MAX_PAGES);
}

/** When the whole read must stop, or `undefined` when the command set no positive `timeoutMs`. */
export function deadlineFor(timeoutMs: number | undefined): number | undefined {
  return typeof timeoutMs === "number" && Number.isFinite(timeoutMs) && timeoutMs > 0 ? Date.now() + timeoutMs : undefined;
}

/** Moves the list on by one page in the request's mode; see the header for what each mode does. */
export async function advancePage(paginate: WebAutomationExtractListPagination, progress: PaginationProgress): Promise<PageAdvance> {
  switch (paginate.mode) {
    case undefined:
    case "next":
      return await followNext(paginate, progress);
    case "loadMore":
      return await pressLoadMore(paginate, progress);
    case "scroll":
      return await scrollForMore(paginate, progress);
    case "numbered":
      return await visitNumberedPage(paginate, progress);
    default: {
      const mode: unknown = (paginate as { mode?: unknown }).mode;
      const named = typeof mode === "string" ? `pagination mode ${JSON.stringify(mode)}` : "a pagination mode that is not a string";
      throw new Error(`web.dom.extract_list does not know ${named}.`);
    }
  }
}

async function followNext(paginate: NextPagination, progress: PaginationProgress): Promise<PageAdvance> {
  const next = document.querySelector(paginate.next);
  if (!next) return "ended";
  if (progress.pagesRead >= paginationBound(paginate)) return "truncated";
  const control = clickable(next, paginate.next);
  if (pastDeadline(progress.deadline)) return "timed_out";
  await progress.beforeFollow?.();
  return await afterListChange(paginate, progress, control, `following ${JSON.stringify(paginate.next)} to page ${progress.pagesRead + 1}`);
}

async function pressLoadMore(paginate: LoadMorePagination, progress: PaginationProgress): Promise<PageAdvance> {
  const found = document.querySelector(paginate.control);
  if (!found || isDisabled(found)) return "ended";
  if (progress.pagesRead >= paginationBound(paginate)) return "truncated";
  const control = clickable(found, paginate.control);
  if (pastDeadline(progress.deadline)) return "timed_out";
  await progress.beforeFollow?.();
  control.click();
  const outcome = await waitUntil(() => progress.hasUnreadItem() || !control.isConnected, LIST_CHANGE_TIMEOUT_MS, LIST_CHANGE_POLL_MS, progress.deadline);
  if (outcome === "unchanged") {
    throw new Error(`No new item appeared within ${LIST_CHANGE_TIMEOUT_MS}ms of pressing ${JSON.stringify(paginate.control)} for page ${progress.pagesRead + 1}.`);
  }
  return outcome === "changed" ? "advanced" : "timed_out";
}

async function scrollForMore(paginate: ScrollPagination, progress: PaginationProgress): Promise<PageAdvance> {
  const bound = paginationBound(paginate);
  const scroller = scrollerOf(progress.shown[0]);
  for (;;) {
    if (progress.scrolls >= bound) return "truncated";
    if (pastDeadline(progress.deadline)) return "timed_out";
    scrollToBottom(scroller);
    progress.scrolls += 1;
    const outcome = await waitUntil(() => progress.hasUnreadItem(), SCROLL_GROWTH_WINDOW_MS, SCROLL_POLL_MS, progress.deadline);
    if (outcome === "changed") return "advanced";
    if (outcome === "timed_out") return "timed_out";
    if (atBottom(scroller)) return "ended";
  }
}

async function visitNumberedPage(paginate: NumberedPagination, progress: PaginationProgress): Promise<PageAdvance> {
  const following = followingPageControl(Array.from(document.querySelectorAll(paginate.pages)), progress.pagesRead);
  if (!following) return "ended";
  if (progress.pagesRead >= paginationBound(paginate)) return "truncated";
  const control = clickable(following, paginate.pages);
  if (pastDeadline(progress.deadline)) return "timed_out";
  await progress.beforeFollow?.();
  return await afterListChange(paginate, progress, control, `choosing page ${progress.pagesRead + 1} from ${JSON.stringify(paginate.pages)}`);
}

/** The page control that follows the current page, or `undefined` when the list has no further page. */
function followingPageControl(controls: readonly Element[], pagesRead: number): Element | undefined {
  const current = controls.find(isCurrentPage);
  if (!current) return controls[pagesRead];
  const number = pageNumber(current);
  if (number === undefined) return controls[controls.indexOf(current) + 1];
  return controls.find((control) => pageNumber(control) === number + 1);
}

function isCurrentPage(control: Element): boolean {
  const current = control.getAttribute("aria-current");
  return current !== null && current !== "false";
}

/** The page number a control shows as its whole text, or `undefined` when it shows something else. */
function pageNumber(control: Element): number | undefined {
  const text = (control.textContent ?? "").trim();
  return /^\d+$/u.test(text) ? Number(text) : undefined;
}

function isDisabled(control: Element): boolean {
  return control.matches(":disabled") || control.getAttribute("aria-disabled") === "true";
}

function clickable(element: Element, selector: string): HTMLElement {
  if (!(element instanceof HTMLElement)) throw new Error(`The pagination control ${JSON.stringify(selector)} is not a clickable element.`);
  return element;
}

function pastDeadline(deadline: number | undefined): boolean {
  return deadline !== undefined && Date.now() >= deadline;
}

/**
 * Clicks `control`, then waits for the list to become a different list and for
 * the page it became to show its records, failing the read when the page
 * ignored its control.
 *
 * A document that starts unloading after the click has not ignored it: the
 * page it is loading is the change, however slow the server. It is given one
 * more window, and if it does unload within it, this script and the wait go
 * with it and the worker carries the read into the next document.
 */
async function afterListChange(paginate: WebAutomationExtractListPagination, progress: PaginationProgress, control: HTMLElement, action: string): Promise<PageAdvance> {
  const { item, shown, deadline } = progress;
  const leaving = watchUnload();
  let outcome: WaitOutcome;
  try {
    control.click();
    const changed = (): boolean => listChanged(item, shown) || !control.isConnected;
    outcome = await waitUntil(changed, LIST_CHANGE_TIMEOUT_MS, LIST_CHANGE_POLL_MS, deadline);
    if (outcome === "unchanged" && leaving.started()) outcome = await waitUntil(changed, LIST_CHANGE_TIMEOUT_MS, LIST_CHANGE_POLL_MS, deadline);
  } finally {
    leaving.stop();
  }
  if (outcome === "unchanged") throw new Error(`The list did not change within ${LIST_CHANGE_TIMEOUT_MS}ms of ${action}.`);
  if (outcome === "timed_out") return "timed_out";
  return await awaitPageRendered(paginate, progress) === "arrived" ? "advanced" : "timed_out";
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

/** The nearest ancestor of `element` that scrolls its own content, or `null` for the window. */
function scrollerOf(element: Element | undefined): Element | null {
  for (let current = element?.parentElement ?? null; current; current = current.parentElement) {
    if (current === document.body || current === document.documentElement) return null;
    const overflow = getComputedStyle(current).overflowY;
    if ((overflow === "auto" || overflow === "scroll" || overflow === "overlay") && current.scrollHeight > current.clientHeight) return current;
  }
  return null;
}

function scrollToBottom(scroller: Element | null): void {
  if (scroller) scroller.scrollTop = scroller.scrollHeight;
  else window.scrollTo({ left: window.scrollX, top: documentHeight(), behavior: "instant" });
}

function atBottom(scroller: Element | null): boolean {
  if (scroller) return scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - BOTTOM_TOLERANCE_PX;
  return window.scrollY + window.innerHeight >= documentHeight() - BOTTOM_TOLERANCE_PX;
}

function documentHeight(): number {
  return Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0);
}
