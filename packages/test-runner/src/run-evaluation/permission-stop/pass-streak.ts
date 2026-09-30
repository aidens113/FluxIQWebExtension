import type { HonestRunVerdict } from "./honest-run-verdict.js";

/**
 * How many runs at the end of `verdicts`, oldest first, passed in a row. A
 * permission stop is not a pass, so it ends a streak exactly as a failure
 * does: twelve correct stops are twelve runs that built no working Flow.
 */
export function passStreak(verdicts: readonly HonestRunVerdict[]): number {
  let streak = 0;
  for (let index = verdicts.length - 1; index >= 0 && verdicts[index] === "passed"; index -= 1) streak += 1;
  return streak;
}
