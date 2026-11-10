// The contract between the page world, which sees a request the moment the
// page begins it, and the content script, which sees one only once its
// response has ended (t465).
//
// The content script reads requests from the resource timeline, and a resource
// entry is written only when its response ends. So a press whose handler asked
// the server and changed nothing until the answer came back -- social-network-
// feed's Confirm awaits its request before it touches the card -- read as
// ignored whenever the server took longer than the ignored-press window, and
// was pressed a second time: playback of `run-mv5jnc5m-a47c3e59` confirmed
// Amara Osei's request twice, which on a real site is a second order.
//
// The page world (`page-world/request-starts.ts`) counts every request the page
// begins -- `fetch`, an `XMLHttpRequest` sent, `navigator.sendBeacon`, a
// `WebSocket` message -- as the call is made. The content script marks an
// element just before it presses it by dispatching `REQUEST_MARK_EVENT` on it;
// the page world remembers the count against the element and cancels the event,
// which is how the content script knows the page world is there. After the
// press it dispatches `REQUEST_SINCE_EVENT` on the same element; the page world
// cancels it when a request has begun since that element's mark. Both answers
// are read from `dispatchEvent`'s return on the same call stack, and nothing is
// written to the page. This module imports nothing: both bundles include it.

/** Dispatched on an element just before a press; cancelled by the page world, which then remembers how many requests the page had begun. */
export const REQUEST_MARK_EVENT = "fluxiq:request-mark";

/** Dispatched on the same element after the press; cancelled by the page world when the page has begun a request since the mark. */
export const REQUEST_SINCE_EVENT = "fluxiq:request-since";

/** Separate positive-proof query; legacy marks/since retain their best-effort behavior. */
export const REQUEST_HEALTH_EVENT = "fluxiq:request-health";

// Since 2026-11-10 (task speed S10) the page world also knows when each request
// it counted has answered: a `fetch` when its resource timing entry is written
// (its response ended), an `XMLHttpRequest` at its own `loadend`. A beacon is
// sent and forgotten, so it is never open; a `WebSocket` message has no answer
// that can be tied to it, so it stays open for good. After a press the content
// script asks, by dispatching `REQUEST_PENDING_EVENT` on the marked element,
// whether a request begun since the mark is still open; the page world cancels
// it when one is. As each request answers, the page world dispatches
// `REQUEST_ANSWERED_EVENT` on `window`, with no detail, so the content script
// can ask again at that moment instead of on a clock. A press whose requests
// have all answered has had its server's answer, refusal or not
// (`content/action-runtime/rate-limit-notice.ts`).

/** Dispatched on a marked element; cancelled by the page world while a request begun since the mark has not answered. */
export const REQUEST_PENDING_EVENT = "fluxiq:request-pending";

/** Dispatched by the page world on `window` each time a request it counted answers. Carries nothing. */
export const REQUEST_ANSWERED_EVENT = "fluxiq:request-answered";

/**
 * Dispatched by the page world on `window`, with no detail, each time the page
 * calls `window.open`: a browsing context of its own may be opening, which the
 * document's own navigation events never show
 * (`content/action-runtime/navigation-watch/`).
 */
export const WINDOW_OPEN_EVENT = "fluxiq:window-open";
