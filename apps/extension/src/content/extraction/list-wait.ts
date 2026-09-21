// The one wait a list read makes on the page: poll a condition until it holds,
// its own window closes, or the command's deadline passes. `pagination.ts`
// waits with it for a list to change after a control is followed, and
// `page-render.ts` for a page the read reached to show its records.

/** What a wait saw: its condition, nothing within its window, or the command's deadline. */
export type WaitOutcome = "changed" | "unchanged" | "timed_out";

/**
 * Polls `condition` until it holds, its window closes, or the command's
 * deadline passes, and says which: the window closing first is the page not
 * responding, the deadline passing first is the read running out of time.
 */
export async function waitUntil(condition: () => boolean, windowMs: number, pollMs: number, actionDeadline: number | undefined): Promise<WaitOutcome> {
  const windowEnd = Date.now() + windowMs;
  const commandEndsFirst = actionDeadline !== undefined && actionDeadline <= windowEnd;
  const end = commandEndsFirst ? actionDeadline : windowEnd;
  while (!condition()) {
    const now = Date.now();
    if (now >= end) return commandEndsFirst ? "timed_out" : "unchanged";
    await new Promise<void>((resolve) => { setTimeout(resolve, Math.min(pollMs, end - now)); });
  }
  return "changed";
}
