/** How far back the search looks, and how many results requests it serves inside that window before it asks for a check. */
export const RATE_WINDOW_MS = 3_000;
export const RATE_LIMIT = 3;
/** What the check page tells the browser to wait before asking again. */
export const RETRY_AFTER_SECONDS = 5;

/**
 * Whether a results request arriving at `now` is answered with the security
 * check. A person reading results never asks for three pages inside three
 * seconds; a script paging as fast as the page renders does. The check clears
 * by itself once the window has passed, so waiting -- or ticking the box,
 * which waits for you -- is always enough.
 */
export function searchChallenged(hits: readonly number[], now: number): boolean {
  return hits.filter((at) => now - at < RATE_WINDOW_MS).length >= RATE_LIMIT;
}
