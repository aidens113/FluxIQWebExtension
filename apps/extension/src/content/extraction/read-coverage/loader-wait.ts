// Whether a list's loader answered the read by asking it to wait: the third
// state of a list beside going on and ending (t755, from t756's trace).
//
// A list that loads more as its end is revealed can refuse a reveal that comes
// too soon after the last one, and say so where the next part would have come:
// "Please wait a few moments before you try again", "Too many requests, try
// again in 3s". The read's own reveal (`../list-wait.ts`) then sees nothing
// grow, and until 2026-10-27 its list was taken for one that had ended, so a
// read of the first screens of a longer list said nothing of the rest: photo-
// social's profile grid read 12 items a second after load and 24 two seconds
// after, with the notice under the grid both times and 45 posts on the
// account. Calling it still growing would be untrue -- nothing grew -- so it is
// its own word, `loader_asked_to_wait` (`./list-continues.ts`).
//
// What is read: the shown elements that follow the list's last item inside its
// container, then those that follow the container and each of its next
// `LEVELS` ancestors, at most `FOLLOWING` at each place -- where a loader puts
// its spinner and its notice. Each one's words are read through the shared
// sensitive-text reader, bounded, and matched against the closed wait and busy
// phrases the click's rate-limit watch uses (`../../action-runtime/interference/`).
// No word of it leaves the page: what the read sends is the closed evidence word.

import { loaderNoticeOf } from "./loader-notice";

/** Whether the page shows, where the list `run` would grow, a notice asking to wait before it loads more; see the header. */
export function loaderAskedToWait(run: readonly Element[]): boolean {
  return loaderNoticeOf(run) !== undefined;
}
