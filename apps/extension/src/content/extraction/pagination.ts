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
//   it is absent. The control is the authored selector's unless that names
//   nothing here or another page's control, which a positional selector does
//   on a pager whose links change from page to page; then it is the pager's
//   own Next (`detect-pagination.ts`, `nextControlOnPage`; run
//   `run-munv53gt-a0e6f545` stopped on page one for want of this). A page
//   that shows items and no way forward is watched for one briefly before the
//   list counts as ended. After a click the list must become a different list -- its
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
//   has not taken, or the control detaches. A load that failed and offered a
//   Retry beside the control has it pressed, at most twice (`load-retry.ts`).
//   An absent, disabled or `aria-disabled="true"` control is the list ending.
//   A live control that yields nothing in ten seconds fails the read, as
//   `next` does.
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

//
// **Every advance that does not advance says why, in one closed word**
// (`PaginationStop`, the domain's `WebAutomationExtractionPaginationStop`), and
// so does every throw, through `PaginationFault`. Until 2026-09-28 a read that
// stopped said only whether a bound cut it short: live run
// `run-mulwm2dc-0bd95f22` asked for fifty pages, read one, and the bundle could
// not say whether the control was absent, disabled, leading back to its own
// page, or pressed and ignored.
//
// **And two ways a real pager misbehaves are absorbed rather than ended on**,
// because the runtime is defensive by default:
// - **A click the page cancelled.** The job board cancels every click outside
//   its consent wall while the wall is open -- `click()` included -- so the
//   read pressed Next, waited ten seconds for a change that could not come, and
//   ended on page one. A link says where it goes, so when the page cancelled the
//   click (or the list did not change at all) and the control is a link to
//   another document, the read goes there by the link's own address. That is
//   exactly what the click would have done, and it answers nothing on the
//   page's behalf: no dialog is accepted or dismissed.
// - **A Next that leads back to the page it is on**, which the same board does
//   from page two on. Following it reloads the page, and a read that followed
//   it would read the same page until its bound. When the pager beside it shows
//   the current page's number and a control numbered one more, the read follows
//   that instead; when it shows none, the read follows the Next anyway and stops
//   on `page_repeated` when the page it reaches holds nothing new
//   (`list-reader.ts`).

import { WEB_AUTOMATION_EXTRACT_MAX_PAGES, type WebAutomationExtractionSummary } from "@fluxiq-web-extension/domain/client";
import type { PageLoadPaceAnswer, PageLoadPaceMessage } from "../../shared/protocol";
import type { WebAutomationExtractListPagination } from "../types";
import { nextControlOnPage, type NextControlChoice } from "./detect-pagination";
import { waitUntil, type WaitOutcome } from "./list-wait";
import { offeredLoadRetry } from "./load-retry";
import { awaitPageRendered } from "./page-render";

/** Why a read that pages stopped paging: the domain's closed set of words. */
export type PaginationStop = NonNullable<WebAutomationExtractionSummary["paginationStop"]>;

/** What one advance did: see the header. Everything but `advanced` says why. */
export type PageAdvance =
  | { outcome: "advanced" }
  | { outcome: "ended" | "truncated" | "timed_out"; stop: PaginationStop };

/** A move to the next page that could not be made, and the word that says which way it failed. */
export class PaginationFault extends Error {
  readonly stop: PaginationStop;

  constructor(stop: PaginationStop, message: string) {
    super(message);
    this.name = "PaginationFault";
    this.stop = stop;
  }
}

/** The stop word for a move that threw: the fault's own, or `page_fault` for anything else. */
export function paginationStopOf(error: unknown): PaginationStop {
  return error instanceof PaginationFault ? error.stop : "page_fault";
}

const ADVANCED: PageAdvance = { outcome: "advanced" };
const ended = (stop: PaginationStop): PageAdvance => ({ outcome: "ended", stop });
const TRUNCATED: PageAdvance = { outcome: "truncated", stop: "page_limit" };
const TIMED_OUT: PageAdvance = { outcome: "timed_out", stop: "deadline" };

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
/**
 * How long a link whose click the page cancelled is given to change the list
 * before the read goes where the link says. A client-side router cancels a
 * link's click and draws the next page itself, so a cancelled click is not by
 * itself an ignored one; a router that has not changed the list in this long
 * lands on the same page by the link's address anyway.
 */
const CANCELLED_LINK_WINDOW_MS = 2_000;
const LIST_CHANGE_POLL_MS = 25;
/** How many times one load-more press may have its failure retried through the Retry the page offered. */
const LOAD_RETRIES = 2;
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

// **A page the server refused is waited out and reloaded, never read as the
// list ending.** Live run `run-munnhi5q-4867dabe` read four of the everything
// store's five results pages; the fifth advance landed on its 429 page ("going
// a little too fast"), which shows no card and no pager, and the read stopped
// `list_vanished` and answered `truncated: false` with eight of thirteen records
// never read. A document a page advance loaded says how the server answered it
// (`PerformanceNavigationTiming.responseStatus`, Chromium 109+), so a 429 or 503
// is known for what it is without asking the server again -- which would count
// against the very limiter that refused it. The read waits, reloads the same
// address, and goes on from its checkpoint in the reloaded document
// (`list-reader.ts`).

/** How the page a read is on answers for itself and is reloaded: the browser's own unless a test stands them in. */
export type RefusedPageHost = {
  /** The HTTP status this document was served with, or `undefined` where the browser does not say. */
  status(): number | undefined;
  pause(ms: number): Promise<void>;
  /** Reloads this document. It returns only if the document is somehow still here afterwards. */
  reload(): Promise<void>;
};

/** What the server's answer makes of a document a page advance reached: refused as too fast, refused as unavailable, or unexplained. */
export type PageRefusal = "rate_limited" | "unavailable" | "unexplained";

/** The stop word for a read that met a 429 it could not wait out; the outcome's `refusedStatus` says which status. */
export const RATE_LIMITED_STOP: PaginationStop = "rate_limited";

/** Reloads one read may make of refused pages, across every document it reads. */
export const MAX_PAGE_RETRIES = 2;
/**
 * The refusals-as-too-fast one read may meet: at the second it stops rather
 * than reloading into what could be a third, because three refusals in one
 * session is where a limiter like the store's flags the session for a robot
 * check, and a read must never be what flags one.
 */
const MAX_RATE_LIMITS_PER_READ = 2;
/**
 * The first wait before a reload: longer than an 8 s rate-limit window, so the
 * first retry succeeds against a limiter like the store's (five results pages
 * in eight seconds, a refused request not counted) with nothing else to go on.
 * `Retry-After` is a header, and only a second request could read it. Each
 * further retry waits twice as long.
 */
const FIRST_RETRY_WAIT_MS = 8_500;
/** What a retry must still leave of the read's time, beyond its wait, for the reloaded page to be read at all. */
const RETRY_READ_ALLOWANCE_MS = 2_000;
/** How long a reload is given to take this document away before the read accepts that it did not. */
const RELOAD_WINDOW_MS = 10_000;

/**
 * The browser's own: the navigation entry's status, a timer, and
 * `location.reload()`. A refused status is also told to the worker's page-load
 * pace, once per document, so the site's later loads slow down; the reload
 * waits its turn on that pace (see below).
 */
export const BROWSER_PAGE_HOST: RefusedPageHost = {
  status() {
    const entry = globalThis.performance?.getEntriesByType?.("navigation")[0] as { responseStatus?: unknown } | undefined;
    // 0 is what the entry says of a response it will not describe, which is no status at all.
    const status = typeof entry?.responseStatus === "number" && entry.responseStatus > 0 ? entry.responseStatus : undefined;
    if (status !== undefined && pageRefusalOf(status) !== undefined) tellPaceRefused(status);
    return status;
  },
  pause: (ms) => new Promise((resolve) => { setTimeout(resolve, ms); }),
  async reload() {
    await awaitPageLoadTurn(undefined);
    window.location.reload();
    await BROWSER_PAGE_HOST.pause(RELOAD_WINDOW_MS);
  }
};

// **The loads a read makes on a site wait their turn on the worker's pace**
// (`background/page-pace/`). Live run `run-muntc23v-7fcc4110` re-ran a
// five-page read about ten times back to back, and the everything store's
// limiter answered a 429 and then flagged the session, because no document can
// know how recently the reads before it loaded the same site. Before it follows
// a `next` or numbered control, and before it reloads a refused page, the page
// asks the worker how long to wait, waits it -- never past the read's deadline,
// which then ends the read as any deadline does -- and loads. The worker keys
// the booking by the origin it sees the message come from; the page sends no
// address and no text. A page with no pace behind it (a read the worker did not
// send, the content harness) is answered with no wait, or not at all, and loads
// as it always did.

/** The most one answer can hold a load, whatever the worker says: its longest spacing plus its wait after a refusal, with room to spare. */
const MAX_PACE_WAIT_MS = 30_000;

/**
 * Asks the worker's pace for the turn of the next page load on this site and
 * waits for it, stopping at `deadline`. Answers how long it waited.
 */
export async function awaitPageLoadTurn(deadline: number | undefined, pause: (ms: number) => Promise<void> = BROWSER_PAGE_HOST.pause): Promise<number> {
  const asked = await askPace({ type: "fluxiq.pageLoad.pace", kind: "load" });
  const waitMs = Math.min(asked, MAX_PACE_WAIT_MS, deadline === undefined ? Number.POSITIVE_INFINITY : Math.max(0, deadline - Date.now()));
  if (waitMs > 0) await pause(waitMs);
  return waitMs;
}

/** Whether this document's refusal has been told to the pace: a status belongs to its document, so once is all it can say. */
let refusalTold = false;

function tellPaceRefused(status: number): void {
  if (refusalTold) return;
  refusalTold = true;
  void askPace({ type: "fluxiq.pageLoad.pace", kind: "refused", status });
}

/**
 * Sends `message` to the worker and answers the wait its reply asks for, in
 * milliseconds. 0 where no pace answers -- no worker listening, or one whose
 * reply is not a pace's, which is what a page with no pace behind it gets. Any
 * other failure to send is reported and also means no wait, because pacing is a
 * courtesy to the site that must never be what fails a read.
 */
async function askPace(message: PageLoadPaceMessage): Promise<number> {
  const runtime = (globalThis as { chrome?: { runtime?: { sendMessage?: (message: unknown) => Promise<unknown> } } }).chrome?.runtime;
  if (typeof runtime?.sendMessage !== "function") return 0;
  let reply: unknown;
  try {
    reply = await runtime.sendMessage(message);
  } catch (error) {
    if (!/Receiving end does not exist|Could not establish connection/iu.test(error instanceof Error ? error.message : "")) {
      console.warn("FluxIQ could not reach its page-load pace; loading without it.", error);
    }
    return 0;
  }
  const answer = reply as Partial<PageLoadPaceAnswer> | undefined;
  return answer?.ok === true && typeof answer.waitMs === "number" && Number.isFinite(answer.waitMs) ? Math.max(0, answer.waitMs) : 0;
}

/** What a status says of the document: refused (429, 503), unexplained where no status is known, or `undefined` for a page served. */
export function pageRefusalOf(status: number | undefined): PageRefusal | undefined {
  if (status === undefined) return "unexplained";
  return status === 429 ? "rate_limited" : status === 503 ? "unavailable" : undefined;
}

/** What a read has spent on refused pages so far, carried across documents in its checkpoint. */
export type RefusalsSpent = { retries: number; rateLimits: number };

/**
 * How long to wait before reloading a refused page, or `undefined` to stop
 * instead. An unexplained page counts as a possible 429, since that is what it
 * most often is where the browser gives no status. A read that cannot carry
 * itself into the reloaded document (`canReload` false: nothing takes its
 * checkpoint) stops, because a reload would lose every record it holds; so does
 * one whose time left would not cover the wait and a read of the page.
 */
export function refusedPageWaitMs(refusal: PageRefusal, spent: RefusalsSpent, remainingMs: number | undefined, canReload: boolean): number | undefined {
  const rateLimits = spent.rateLimits + (refusal === "unavailable" ? 0 : 1);
  if (!canReload || spent.retries >= MAX_PAGE_RETRIES || rateLimits >= MAX_RATE_LIMITS_PER_READ) return undefined;
  const waitMs = FIRST_RETRY_WAIT_MS * 2 ** spent.retries;
  return remainingMs === undefined || remainingMs >= waitMs + RETRY_READ_ALLOWANCE_MS ? waitMs : undefined;
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

/**
 * Follows the `next` control: the authored selector's, or the pager's own Next
 * where that selector names nothing or another page's control
 * (`detect-pagination.ts`, `nextControlOnPage`). A disabled one is the list
 * ending, as it is for `loadMore`; one that leads back to this very page is
 * swapped for the pager's following page where the pager shows one (see the
 * header).
 */
async function followNext(paginate: NextPagination, progress: PaginationProgress): Promise<PageAdvance> {
  const found = await awaitNextControl(paginate.next, progress);
  if (found === "timed_out") return TIMED_OUT;
  if (!found) return ended("control_absent");
  const next = found.control;
  if (isDisabled(next)) return ended("control_disabled");
  if (progress.pagesRead >= paginationBound(paginate)) return TRUNCATED;
  const named = clickable(next, paginate.next);
  const control = leadsToThisPage(named) ? pagerSuccessor(named) ?? named : named;
  if (pastDeadline(progress.deadline)) return TIMED_OUT;
  await awaitPageLoadTurn(progress.deadline);
  if (pastDeadline(progress.deadline)) return TIMED_OUT;
  await progress.beforeFollow?.();
  return await afterListChange(paginate, progress, control, `following ${JSON.stringify(paginate.next)} to page ${progress.pagesRead + 1}`);
}

/**
 * How long a page that shows its items and no way forward is watched for one
 * before the read calls the list ended. A page that draws its pager with, or
 * after, results it loads late has not ended its list when the first item
 * appears -- which is all a paged read waits for (`list-reader.ts`) -- and a
 * page that has ended it pays this once, on its last page. A list the read
 * found no container for has no pager to wait for, and does not wait.
 */
const PAGER_WAIT_MS = 1_000;
const PAGER_POLL_MS = 50;

/**
 * The control a `next` read follows on this page, waiting up to
 * `PAGER_WAIT_MS` for one to appear; `"timed_out"` when the command's deadline
 * passed first.
 */
async function awaitNextControl(selector: string, progress: PaginationProgress): Promise<NextControlChoice | "timed_out" | undefined> {
  const look = (): NextControlChoice | undefined => nextControlOnPage(document.querySelector(selector), progress.shown);
  const seen: { choice: NextControlChoice | undefined } = { choice: look() };
  if (seen.choice !== undefined || !progress.shown[0]?.parentElement) return seen.choice;
  const outcome = await waitUntil(() => {
    seen.choice = look();
    return seen.choice !== undefined;
  }, PAGER_WAIT_MS, PAGER_POLL_MS, progress.deadline);
  return outcome === "timed_out" ? "timed_out" : seen.choice;
}

async function pressLoadMore(paginate: LoadMorePagination, progress: PaginationProgress): Promise<PageAdvance> {
  const found = document.querySelector(paginate.control);
  if (!found) return ended("control_absent");
  if (isDisabled(found)) return ended("control_disabled");
  if (progress.pagesRead >= paginationBound(paginate)) return TRUNCATED;
  const control = clickable(found, paginate.control);
  if (pastDeadline(progress.deadline)) return TIMED_OUT;
  await progress.beforeFollow?.();
  control.click();
  const outcome = await waitForMoreItems(control, progress);
  if (outcome === "unchanged") {
    throw new PaginationFault("list_unchanged", `No new item appeared within ${LIST_CHANGE_TIMEOUT_MS}ms of pressing ${JSON.stringify(paginate.control)} for page ${progress.pagesRead + 1}.`);
  }
  return outcome === "changed" ? ADVANCED : TIMED_OUT;
}

/**
 * Waits for the press to bring an item the read has not taken, or for the
 * control to leave. A load that failed and put a Retry beside the control
 * (`./load-retry.ts`) has that Retry pressed, at most `LOAD_RETRIES` times,
 * and each press gets the full window again.
 */
async function waitForMoreItems(control: HTMLElement, progress: PaginationProgress): Promise<WaitOutcome> {
  let retried = 0;
  for (;;) {
    const offered: { retry: HTMLElement | undefined } = { retry: undefined };
    const outcome = await waitUntil(() => {
      if (progress.hasUnreadItem() || !control.isConnected) return true;
      offered.retry = retried < LOAD_RETRIES ? offeredLoadRetry(control) : undefined;
      return offered.retry !== undefined;
    }, LIST_CHANGE_TIMEOUT_MS, LIST_CHANGE_POLL_MS, progress.deadline);
    if (outcome !== "changed" || !offered.retry) return outcome;
    retried += 1;
    offered.retry.click();
  }
}

async function scrollForMore(paginate: ScrollPagination, progress: PaginationProgress): Promise<PageAdvance> {
  const bound = paginationBound(paginate);
  const scroller = scrollerOf(progress.shown[0]);
  for (;;) {
    if (progress.scrolls >= bound) return TRUNCATED;
    if (pastDeadline(progress.deadline)) return TIMED_OUT;
    scrollToBottom(scroller);
    progress.scrolls += 1;
    const outcome = await waitUntil(() => progress.hasUnreadItem(), SCROLL_GROWTH_WINDOW_MS, SCROLL_POLL_MS, progress.deadline);
    if (outcome === "changed") return ADVANCED;
    if (outcome === "timed_out") return TIMED_OUT;
    if (atBottom(scroller)) return ended("scrolled_to_end");
  }
}

async function visitNumberedPage(paginate: NumberedPagination, progress: PaginationProgress): Promise<PageAdvance> {
  const following = followingPageControl(Array.from(document.querySelectorAll(paginate.pages)), progress.pagesRead);
  if (!following) return ended("no_following_page");
  if (progress.pagesRead >= paginationBound(paginate)) return TRUNCATED;
  const control = clickable(following, paginate.pages);
  if (pastDeadline(progress.deadline)) return TIMED_OUT;
  await awaitPageLoadTurn(progress.deadline);
  if (pastDeadline(progress.deadline)) return TIMED_OUT;
  await progress.beforeFollow?.();
  return await afterListChange(paginate, progress, control, `choosing page ${progress.pagesRead + 1} from ${JSON.stringify(paginate.pages)}`);
}

/**
 * Whether the control is a link whose address is the document already showing:
 * the same page, with its query in any order, whatever its fragment. A link to
 * a fragment alone (`href="#"`) is not one, because that is how a page marks a
 * control its own script handles, and a script-driven Next is a working Next.
 */
function leadsToThisPage(control: HTMLElement): boolean {
  const address = linkAddress(control);
  return address !== undefined && sameDocument(address, new URL(document.URL));
}

/**
 * The control a pager shows for the page after the current one, found beside a
 * `next` control that leads back to its own page, or `undefined` when the pager
 * does not say which page is current or shows nothing after it.
 *
 * The current page is the number marked `aria-current`, or the one number the
 * pager shows as something other than a control -- which is how a pager draws
 * the page you are on (`<b>2</b>` among links). Only numbers are read, and only
 * to compare them, so no word of the page is carried anywhere.
 */
function pagerSuccessor(next: HTMLElement): HTMLElement | undefined {
  let pager: Element | null = next.parentElement;
  for (let depth = 0; pager && depth < PAGER_LEVELS; depth += 1, pager = pager.parentElement) {
    const numbered = Array.from(pager.querySelectorAll("*")).filter((element) => element.children.length === 0 && pageNumber(element) !== undefined);
    const current = numbered.find((element) => isCurrentPage(element) || isCurrentPage(element.closest(PAGE_CONTROL) ?? element))
      ?? onlyOne(numbered.filter((element) => !isControl(element)));
    const number = current === undefined ? undefined : pageNumber(current);
    if (number === undefined) continue;
    const following = numbered.map((element) => element.closest(PAGE_CONTROL) ?? element).find((element) => isControl(element) && pageNumber(element) === number + 1);
    return following instanceof HTMLElement && !isDisabled(following) ? following : undefined;
  }
  return undefined;
}

/** How far out from a `next` control its pager is looked for. */
const PAGER_LEVELS = 3;

/** What a pager's page controls are. */
const PAGE_CONTROL = 'a[href],button,[role="link"],[role="button"]';

function isControl(element: Element): boolean {
  return element.matches(PAGE_CONTROL) || element.closest(PAGE_CONTROL) !== null;
}

function onlyOne<T>(items: readonly T[]): T | undefined {
  return items.length === 1 ? items[0] : undefined;
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
  if (!(element instanceof HTMLElement)) throw new PaginationFault("control_not_clickable", `The pagination control ${JSON.stringify(selector)} is not a clickable element.`);
  return element;
}

/**
 * Where the control goes when it is a link to a page: its `href` resolved
 * against its base, when that is http or https. `undefined` for anything else,
 * and for a link to a fragment alone, which a page's own script handles.
 */
function linkAddress(control: HTMLElement): URL | undefined {
  const link = control.closest("a[href]");
  const href = link?.getAttribute("href")?.trim();
  // An address that does not parse is not a link to a page, which is what
  // `undefined` means here, so it is asked rather than caught.
  if (!link || !href || href.startsWith("#") || !URL.canParse(href, link.baseURI)) return undefined;
  const url = new URL(href, link.baseURI);
  return url.protocol === "http:" || url.protocol === "https:" ? url : undefined;
}

/** Whether two addresses load the same document: origin, path and query alike, the query in any order, the fragment ignored. */
function sameDocument(left: URL, right: URL): boolean {
  return left.origin === right.origin && left.pathname === right.pathname && sortedQuery(left) === sortedQuery(right);
}

function sortedQuery(url: URL): string {
  const params = [...url.searchParams.entries()].sort(([a, x], [b, y]) => (a === b ? (x < y ? -1 : x > y ? 1 : 0) : a < b ? -1 : 1));
  return new URLSearchParams(params).toString();
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
 *
 * A link to another document that did not change the list -- because the page
 * cancelled its click, or because nothing happened at all -- is followed by its
 * own address before the read gives up (see the header). A cancelled click gets
 * `CANCELLED_LINK_WINDOW_MS` first rather than the whole window, since a page
 * that cancels a click it is not going to act on is the common case the header
 * measured, and ten seconds a page is what that cost.
 */
async function afterListChange(paginate: WebAutomationExtractListPagination, progress: PaginationProgress, control: HTMLElement, action: string): Promise<PageAdvance> {
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
  if (outcome === "timed_out") return TIMED_OUT;
  return await awaitPageRendered(paginate, progress) === "arrived" ? ADVANCED : TIMED_OUT;
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
