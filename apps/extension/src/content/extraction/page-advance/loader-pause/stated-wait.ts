// The wait a loader's notice states, in milliseconds: "Try again in 4s",
// "Too many requests. Try again in 2 minutes.", "wait 30 seconds before".
// `undefined` when the notice states none ("Please wait a few moments before
// you try again"), when the move waits on a growing pace instead
// (`./wait-out-pause.ts`). Held to `STATED_WAIT_MAX_MS`: a notice asking for
// longer is asking for more than one step gives.

/** The longest stated wait a step sits out. */
const STATED_WAIT_MAX_MS = 30_000;
/** Added to the stated wait so the retry lands after the page's window and not on its edge. */
const MARGIN_MS = 500;
/** "try again in 4s", "retry in 2 minutes", "wait 30 seconds", "wait for 1 min": the number and its unit. */
const STATED = /\b(?:try again|retry|wait)(?: again)? (?:in |for )?(\d{1,6}) ?(s|secs?|seconds?|mins?|minutes?)\b/iu;

/** The wait `text` states with its margin, or `undefined`. */
export function statedWaitMs(text: string): number | undefined {
  const match = STATED.exec(text);
  if (!match) return undefined;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return undefined;
  const unitMs = /^m/iu.test(match[2] ?? "") ? 60_000 : 1_000;
  return Math.min(amount * unitMs + MARGIN_MS, STATED_WAIT_MAX_MS);
}
