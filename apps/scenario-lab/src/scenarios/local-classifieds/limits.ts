/**
 * The two places the marketplace reacts to speed, as pure functions of the
 * timestamps the session has kept, so a test can hand them any clock.
 *
 * - Contacting sellers: a message or an offer sent within
 *   `CONTACT_INTERVAL_MS` of the last one is refused with "try again in N
 *   seconds". Someone making one offer never meets it. Someone who first
 *   presses Send on the listing's ready-made "Hi, is this still available?"
 *   and then makes the offer is refused, and has to wait and send it again.
 * - The results feed: the `HUMAN_CHECK_REQUESTS`th new search inside
 *   `HUMAN_CHECK_WINDOW_MS` is answered with a "checking your browser" pause
 *   instead of listings. It clears by itself after `HUMAN_CHECK_WAIT_MS`, or
 *   at once when the person presses Continue; either way the page asks again.
 *   Scrolling for more of the same search is not a new search.
 */
export const CONTACT_INTERVAL_MS = 8_000;
export const HUMAN_CHECK_REQUESTS = 4;
export const HUMAN_CHECK_WINDOW_MS = 10_000;
export const HUMAN_CHECK_WAIT_MS = 2_500;

/** Whether a message or offer sent at `now` goes out, given when the session last contacted anyone. */
export function contactAllowed(contactLog: readonly number[], now: number): boolean {
  const last = contactLog.at(-1);
  return last === undefined || now - last >= CONTACT_INTERVAL_MS;
}

/** Whether this new search, made at `now` after the ones in `feedLog`, gets the check instead of listings. */
export function humanCheckDue(feedLog: readonly number[], now: number): boolean {
  const recent = feedLog.filter((at) => now - at < HUMAN_CHECK_WINDOW_MS).length;
  return recent + 1 >= HUMAN_CHECK_REQUESTS;
}
