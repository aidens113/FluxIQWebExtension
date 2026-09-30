// The worker's half of pacing the loads a paginated list read makes: while the
// read runs, the page's `PAGE_LOAD_PACE_MESSAGE`s from the read's own tab and
// frame are answered from the pace (`origin-pace.ts`), keyed by the origin the
// browser says the sender's document is on.
//
// The answer is given at once, carrying the wait, and the page does the
// waiting. The worker's general message handler answers every message it does
// not know with a refusal, a moment later, and the first answer given is the
// one the page receives -- so a listener that waited before answering would
// lose to it and the page would not wait at all.

import { PAGE_LOAD_PACE_MESSAGE, type PageLoadPaceAnswer } from "../../shared/protocol";
import type { OriginPace } from "./origin-pace";
import { PaceTally } from "./pace-tally";
import { originOf } from "./page-origin";

/** The id the browser always gives a tab's main frame. */
const TOP_FRAME_ID = 0;

type Sender = Pick<chrome.runtime.MessageSender, "tab" | "frameId" | "url">;

/**
 * Runs `run` -- a read sent to `frameId` of `tabId` -- with that frame's page
 * loads paced, and answers what `run` did and what the pace did for it.
 */
export async function withPagePace<T>(pace: OriginPace, tabId: number, frameId: number, run: () => Promise<T>): Promise<{ value: T; tally: PaceTally }> {
  const tally = new PaceTally();
  const listener = (received: unknown, sender: Sender, sendResponse: (response?: unknown) => void): boolean => {
    const body = received as { type?: unknown; kind?: unknown; status?: unknown } | undefined;
    if (body?.type !== PAGE_LOAD_PACE_MESSAGE) return false;
    if (sender.tab?.id !== tabId || (sender.frameId ?? TOP_FRAME_ID) !== frameId) return false;
    const origin = originOf(sender.url);
    let waitMs = 0;
    if (origin !== undefined && body.kind === "load") {
      waitMs = pace.reserve(origin);
      tally.booked(waitMs, pace.spacingOf(origin));
    } else if (origin !== undefined && body.kind === "refused" && typeof body.status === "number" && pace.noteRefusal(origin, body.status)) {
      tally.refused(pace.spacingOf(origin));
    }
    const answer: PageLoadPaceAnswer = { ok: true, waitMs };
    sendResponse(answer);
    return false;
  };
  chrome.runtime.onMessage.addListener(listener);
  try {
    return { value: await run(), tally };
  } finally {
    chrome.runtime.onMessage.removeListener(listener);
  }
}
