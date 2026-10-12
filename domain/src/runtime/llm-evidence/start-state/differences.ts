// What is not as it was (t462), one entry per thing in the page view's own
// words: the address first, then each line the start had that is gone, then
// each line that is new (`./changed-lines.ts`). Nothing is capped.

import { webStartStateChangedLines } from "./changed-lines";
import type { WebStartState } from "./state";

/** The differences between the start and now; empty when the page is as the build found it. */
export function webStartStateDifferences(start: WebStartState, now: WebStartState): string[] {
  const lines = webStartStateChangedLines(start, now);
  return [
    ...(start.location === now.location ? [] : [`location: ${start.location} -> ${now.location}`]),
    ...lines.gone.map((line) => `gone: ${line}`),
    ...lines.added.map((line) => `new: ${line}`)
  ];
}
