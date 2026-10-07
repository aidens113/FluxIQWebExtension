// **The loads a move makes on a site wait their turn on the worker's pace**
// (`background/page-pace/`). Live run `run-muntc23v-7fcc4110` re-ran a
// five-page read about ten times back to back, and the everything store's
// limiter answered a 429 and then flagged the session, because no document can
// know how recently the reads before it loaded the same site. Before it follows
// a `next` or numbered control, and before it reloads a refused page, the page
// asks the worker how long to wait, waits it -- never past the command's
// deadline, which then ends the move as any deadline does -- and loads. The
// worker keys the booking by the origin it sees the message come from; the page
// sends no address and no text. A page with no pace behind it (a command the
// worker did not send, the content harness) is answered with no wait, or not at
// all, and loads as it always did.

import type { PageLoadPaceAnswer, PageLoadPaceMessage } from "../../../shared/protocol";

/** The most one answer can hold a load, whatever the worker says: its longest spacing plus its wait after a refusal, with room to spare. */
const MAX_PACE_WAIT_MS = 30_000;

const pauseFor = (ms: number): Promise<void> => new Promise((resolve) => { setTimeout(resolve, ms); });

/**
 * Asks the worker's pace for the turn of the next page load on this site and
 * waits for it, stopping at `deadline`. Answers how long it waited.
 */
export async function awaitPageLoadTurn(deadline: number | undefined, pause: (ms: number) => Promise<void> = pauseFor): Promise<number> {
  const asked = await askPace({ type: "fluxiq.pageLoad.pace", kind: "load" });
  const waitMs = Math.min(asked, MAX_PACE_WAIT_MS, deadline === undefined ? Number.POSITIVE_INFINITY : Math.max(0, deadline - Date.now()));
  if (waitMs > 0) await pause(waitMs);
  return waitMs;
}

/** Whether this document's refusal has been told to the pace: a status belongs to its document, so once is all it can say. */
let refusalTold = false;

/** Tells the pace this document was served refused with `status`, once per document, so the site's later loads slow down. */
export function tellPaceRefused(status: number): void {
  if (refusalTold) return;
  refusalTold = true;
  void askPace({ type: "fluxiq.pageLoad.pace", kind: "refused", status });
}

/**
 * Sends `message` to the worker and answers the wait its reply asks for, in
 * milliseconds. 0 where no pace answers -- no worker listening, or one whose
 * reply is not a pace's, which is what a page with no pace behind it gets. Any
 * other failure to send is reported and also means no wait, because pacing is a
 * courtesy to the site that must never be what fails a move.
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
