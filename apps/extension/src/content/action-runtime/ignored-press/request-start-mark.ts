// The content-script half of the request-start probe (`shared/request-start-event.ts`,
// t465): whether the page began a request -- not finished one -- since a mark
// made just before a press.
//
// The resource timeline the listener otherwise reads writes an entry only when
// a response ends, so a press whose answer waits on a slow server read as
// ignored and was pressed again. The page world sees the request as the page
// makes it, and that is the press reaching the server, whatever the page shows.

import { REQUEST_MARK_EVENT, REQUEST_SINCE_EVENT } from "../../../shared/request-start-event";

/** A mark made on a pressed element: `begunSince` is true once the page has begun any request after it. */
export type RequestStartMark = { begunSince(): boolean };

/**
 * Marks `pressed` in the page world. Undefined where nothing answers -- a
 * browser that runs no page-world script, a test's hand-built element -- and
 * then requests are seen only once their response ends, as before.
 */
export function markRequestStarts(pressed: Element): RequestStartMark | undefined {
  if (typeof CustomEvent !== "function" || typeof pressed.dispatchEvent !== "function") return undefined;
  const ask = (type: string): boolean => !pressed.dispatchEvent(new CustomEvent(type, { cancelable: true, composed: true }));
  if (!ask(REQUEST_MARK_EVENT)) return undefined;
  return { begunSince: () => ask(REQUEST_SINCE_EVENT) };
}
