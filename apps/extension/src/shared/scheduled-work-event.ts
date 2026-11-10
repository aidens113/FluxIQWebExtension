// The contract between the page world, which sees the work a page schedules for
// itself, and the worker's readiness wait (`runtime/automation-tab.ts`
// `waitForTabReady`, task speed S10), which asks it through a function it
// injects into the page.
//
// A loaded page is often not finished: local-classifieds draws a listing's
// panel from a timer and then a request, and its sorted results after an
// address rewritten in place, a short delay and a request. The page world
// (`page-world/page-work/`) counts that work as the page schedules it -- a
// timer due within `PAGE_WORK_HORIZON_MS`, an animation frame, a `fetch` or an
// `XMLHttpRequest` -- and when each piece is done. Work that recurs (a callback
// that schedules itself again, an interval once it has fired, and anything such
// a callback begins) is the page's own heartbeat, not the page being drawn, and
// is never counted.
//
// The asker dispatches `PAGE_WORK_WATCHED_EVENT` on `window`, which the page
// world cancels when it is counting, and `PAGE_WORK_BUSY_EVENT`, which it
// cancels while any counted work is outstanding. Each time the count falls to
// none the page world dispatches `PAGE_WORK_DRAINED_EVENT` on `window`, with no
// detail. All three are read from `dispatchEvent`'s return on the same call
// stack; nothing of the page's work -- an address, a callback -- leaves the page
// world. This module imports nothing: both bundles include it.

/** Dispatched on `window`; cancelled by a page world that counts the page's own work. */
export const PAGE_WORK_WATCHED_EVENT = "fluxiq:page-work-watched";

/** Dispatched on `window`; cancelled while any work the page scheduled for itself is outstanding. */
export const PAGE_WORK_BUSY_EVENT = "fluxiq:page-work-busy";

/** Dispatched by the page world on `window` each time its count of outstanding work falls to none. */
export const PAGE_WORK_DRAINED_EVENT = "fluxiq:page-work-drained";

/**
 * A timer due within this long is the page still drawing itself; one due later
 * is something the page will do in its own time (local-classifieds' panel waits
 * 500-1000 ms, its notifications prompt 1.6-3.0 s). It is the second a loaded
 * page used to be given by the stable-address clock this replaces, so no timer
 * that clock waited for goes unwaited.
 */
export const PAGE_WORK_HORIZON_MS = 1_000;
