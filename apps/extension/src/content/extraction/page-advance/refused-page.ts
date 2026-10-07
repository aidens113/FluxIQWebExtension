// **A page the server refused is waited out and reloaded, never read as the
// list ending.** Live run `run-munnhi5q-4867dabe` read four of the everything
// store's five results pages; the fifth advance landed on its 429 page ("going
// a little too fast"), which shows no card and no pager, and the read stopped
// `list_vanished` and answered `truncated: false` with eight of thirteen records
// never read. A document a page advance loaded says how the server answered it
// (`PerformanceNavigationTiming.responseStatus`, Chromium 109+), so a 429 or 503
// is known for what it is without asking the server again -- which would count
// against the very limiter that refused it. The read (`../list-reader.ts`) and
// a next-page step's landing (`./arrival.ts`) both wait, reload the same
// address, and go on in the reloaded document from what they handed the worker.

import type { PaginationStop } from "./types";
import { awaitPageLoadTurn, tellPaceRefused } from "./load-pace";

/** How the page a move is on answers for itself and is reloaded: the browser's own unless a test stands them in. */
export type RefusedPageHost = {
  /** The HTTP status this document was served with, or `undefined` where the browser does not say. */
  status(): number | undefined;
  pause(ms: number): Promise<void>;
  /** Reloads this document. It returns only if the document is somehow still here afterwards. */
  reload(): Promise<void>;
};

/** What the server's answer makes of a document a page advance reached: refused as too fast, refused as unavailable, or unexplained. */
export type PageRefusal = "rate_limited" | "unavailable" | "unexplained";

/** The stop word for a move that met a 429 it could not wait out; a read's outcome's `refusedStatus` says which status. */
export const RATE_LIMITED_STOP: PaginationStop = "rate_limited";

/** Reloads one read, or one next-page step, may make of refused pages, across every document it reaches. */
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
/** What a retry must still leave of the command's time, beyond its wait, for the reloaded page to be read at all. */
const RETRY_READ_ALLOWANCE_MS = 2_000;
/** How long a reload is given to take this document away before the move accepts that it did not. */
const RELOAD_WINDOW_MS = 10_000;

/**
 * The browser's own: the navigation entry's status, a timer, and
 * `location.reload()`. A refused status is also told to the worker's page-load
 * pace, once per document, so the site's later loads slow down; the reload
 * waits its turn on that pace (`./load-pace.ts`).
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

/** What a status says of the document: refused (429, 503), unexplained where no status is known, or `undefined` for a page served. */
export function pageRefusalOf(status: number | undefined): PageRefusal | undefined {
  if (status === undefined) return "unexplained";
  return status === 429 ? "rate_limited" : status === 503 ? "unavailable" : undefined;
}

/** What a move has spent on refused pages so far, carried across documents in what it hands the worker. */
export type RefusalsSpent = { retries: number; rateLimits: number };

/**
 * How long to wait before reloading a refused page, or `undefined` to stop
 * instead. An unexplained page counts as a possible 429, since that is what it
 * most often is where the browser gives no status. A move that cannot carry
 * itself into the reloaded document (`canReload` false: nothing takes what it
 * hands over) stops, because a reload would lose it; so does one whose time
 * left would not cover the wait and a look at the page.
 */
export function refusedPageWaitMs(refusal: PageRefusal, spent: RefusalsSpent, remainingMs: number | undefined, canReload: boolean): number | undefined {
  const rateLimits = spent.rateLimits + (refusal === "unavailable" ? 0 : 1);
  if (!canReload || spent.retries >= MAX_PAGE_RETRIES || rateLimits >= MAX_RATE_LIMITS_PER_READ) return undefined;
  const waitMs = FIRST_RETRY_WAIT_MS * 2 ** spent.retries;
  return remainingMs === undefined || remainingMs >= waitMs + RETRY_READ_ALLOWANCE_MS ? waitMs : undefined;
}
