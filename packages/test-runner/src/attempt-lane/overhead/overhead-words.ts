import type { AttemptOverhead } from "./attempt-overhead.js";

/** `36 / 8 = 4.5x`, or just the live count when there is no replay to compare with. */
export function overheadWords(overhead: AttemptOverhead): string {
  const { liveBrowserCalls, flowBrowserCalls } = overhead;
  return overhead.overhead === null || flowBrowserCalls === null ? `${liveBrowserCalls}` : `${liveBrowserCalls} / ${flowBrowserCalls} = ${overhead.overhead.toFixed(1)}x`;
}
