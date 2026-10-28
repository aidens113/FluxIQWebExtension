// A list whose loader asked the move to wait is paused, not ended (t762, from
// t755's paused-list word). A next-page step that scrolls for more, or presses a
// Load more, and meets the loader's notice -- "Please wait a few moments before
// you try again", "Try again in 4s" -- does what a person does: waits as the
// notice asks, or presses the retry control it offers once it shows, then asks
// again. Until 2026-10-27 the scroll found the list unchanged at the bottom and
// answered `ended: scrolled_to_end` with the notice on screen.
//
// **One wait, then the caller asks again.** `waitOutLoaderPause` returns when the
// notice has gone, a retry control the notice offers has been pressed (`retried`),
// or the wait ran out (`waited`): the notice's stated seconds
// (`./stated-wait.ts`), else a pace that grows with each wait, `BACKOFF_MS` doubled.
// The caller then scrolls or presses again, and if the list is still unchanged
// with the notice up it comes back here with the next count. The move is a node:
// the first attempt and `PAUSE_WAITS` more are waited, and a list still paused
// after them fails `rate_limited` carrying the notice's words, never `ended`
// (the existing fault word, which the runtime already retries after its wait).
//
// The retry control is the one the list's own Retry rules find (`../../load-retry.ts`,
// `offeredListRetry`: a whole-label "Try again" under the list), pressed only
// once it shows -- never before the notice's wait is over, since a press made
// into the limit is the refused act again.

import { waitUntil } from "../../list-wait";
import { offeredListRetry } from "../../load-retry";
import { loaderNoticeOf } from "../../read-coverage";
import { textOutsideSensitiveControls } from "../../../sensitive-text";
import { PaginationFault } from "../pagination-fault";
import type { PaginationProgress } from "../types";
import { statedWaitMs } from "./stated-wait";

/** How many waits follow the first sighting of the notice: the node's three retries. */
export const PAUSE_WAITS = 3;
/** The first wait when the notice states none; each further one is twice as long. */
const BACKOFF_MS = 1_500;
/** The longest a growing pace waits once. */
const BACKOFF_MAX_MS = 12_000;
/** How often the notice and its retry control are looked at. */
const POLL_MS = 100;
/** How much of the notice is carried in the failure: a sentence or two. */
const WORDS_MAX = 200;

/** What a wait came to: no notice up (`clear`), the notice gone during the wait (`cleared`), the retry control pressed, the wait over with the notice still up, or the command's time gone. */
export type PauseWait = "clear" | "cleared" | "retried" | "waited" | "timed_out";

/**
 * Waits out the loader's notice once, `waits` being how many waits this move
 * has made already; see the header. `"clear"` when no notice is up (nothing
 * waited). Throws `PaginationFault("rate_limited")` once `PAUSE_WAITS` waits are spent.
 */
export async function waitOutLoaderPause(progress: PaginationProgress, waits: number): Promise<PauseWait> {
  const items = (): Element[] => {
    const now = Array.from(document.querySelectorAll(progress.item));
    return now.length > 0 ? now : [...progress.shown];
  };
  const notice = loaderNoticeOf(items());
  if (notice === undefined) return "clear";
  const words = textOutsideSensitiveControls(notice).replace(/\s+/gu, " ").trim().slice(0, WORDS_MAX);
  if (waits >= PAUSE_WAITS) {
    throw new PaginationFault("rate_limited", `The page paused this list and was still asking to wait after ${waits} waits: ${JSON.stringify(words)}. The list has not ended.`);
  }
  const waitMs = statedWaitMs(words) ?? Math.min(BACKOFF_MS * 2 ** waits, BACKOFF_MAX_MS);
  let retry: HTMLElement | undefined;
  const over = await waitUntil(() => {
    retry = offeredListRetry(items());
    return retry !== undefined || loaderNoticeOf(items()) === undefined;
  }, waitMs, POLL_MS, progress.deadline);
  if (over === "timed_out") return "timed_out";
  if (retry !== undefined) {
    retry.click();
    return "retried";
  }
  return over === "changed" ? "cleared" : "waited";
}
