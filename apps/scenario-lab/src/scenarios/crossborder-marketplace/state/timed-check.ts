/**
 * The timed check: a "confirm you are human" box the store puts over a page a
 * moment after it loads, with nothing the visitor did behind it. It stands
 * over every storefront page until a person passes it once, and comes back on
 * every load until then; once passed it never shows again in the visit.
 *
 * It exists to prove a hand-off that comes from a look rather than an action:
 * no press, typed submit or navigation raises it, so the first thing that can
 * meet it is whatever reads the page after its timer has run.
 *
 * - `delayMs`: how long after the page's script starts the box comes up.
 * - `status`: `waiting` until a person presses its box and its check finishes;
 *   then `passed`.
 */
export type TimedCheck = { delayMs: number; status: "waiting" | "passed" };

const MAX_DELAY_MS = 10_000;

/** The check an arm payload asks for, or `undefined` for one the Lab could not have meant. A check at load is not on a timer, so the delay starts at 1. */
export function readTimedCheck(value: unknown): TimedCheck | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const { delayMs, ...rest } = value as Record<string, unknown>;
  if (Object.keys(rest).length > 0) return undefined;
  if (typeof delayMs !== "number" || !Number.isInteger(delayMs) || delayMs < 1 || delayMs > MAX_DELAY_MS) return undefined;
  return { delayMs, status: "waiting" };
}
