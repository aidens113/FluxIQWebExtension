// The HTTP status a tab's committed top-frame document was served with.
//
// The worker cannot see a response, and `webNavigation` does not report one, so
// the landed document is asked for its own: the navigation timing entry's
// `responseStatus`, read by a function injected into it. A click's landing
// (`click-landing.ts`) and a navigation's (`action-runner.ts`) both judge a
// page the server refused -- 404 for an unknown address, 403 for a guarded one
// -- by this number.
//
// - The document is addressed by the `documentId` its commit or drive named,
//   when there is one, so a document that has since replaced it cannot answer
//   for it; without one, the tab's top frame is asked.
// - Anything that stops the read -- Firefox keeps no `responseStatus`, a
//   replaced document refuses the injection, a page the extension may not
//   script -- answers `unread`, with why. It is not a status: a caller can tell
//   it from one, and leaves its action as it was. Missing evidence never
//   becomes a failure.

/** The id the browser always gives a tab's main frame. */
const TOP_FRAME_ID = 0;

/** What the landed document said about its response: the status it was served with, or why it could not say. */
export type ServedStatus = { status: number } | { unread: string };

/**
 * The status `documentId` (or, when it is undefined, the tab's top frame) was
 * served with, or why the browser would not say.
 */
export async function servedStatus(tabId: number, documentId: string | undefined): Promise<ServedStatus> {
  const target: chrome.scripting.InjectionTarget = documentId !== undefined
    ? { tabId, documentIds: [documentId] }
    : { tabId, frameIds: [TOP_FRAME_ID] };
  try {
    const [injection] = await chrome.scripting.executeScript({ target, func: readServedStatus });
    const status: unknown = injection?.result;
    return typeof status === "number" && Number.isInteger(status) && status > 0
      ? { status }
      : { unread: "the document keeps no response status" };
  } catch (error) {
    return { unread: `the document could not be asked: ${error instanceof Error ? error.message : String(error)}` };
  }
}

/** Runs inside the landed document, so it must stand alone: the status its response carried. */
function readServedStatus(): number | undefined {
  const [entry] = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
  return entry?.responseStatus;
}
