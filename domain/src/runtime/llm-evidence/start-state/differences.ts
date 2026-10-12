// What is not as it was (t462), one entry per thing in the page view's own
// words: the address first, then each line the start had that is gone, then
// each line that is new. Lines are compared as a multiset, as a state diff
// compares them (`../../state-diff/state-diff.ts`, whose line counting is not
// exported): twelve "Add to cart" lines that became eleven lost one. Nothing
// is capped.

import type { WebStartState } from "./state";

/** The differences between the start and now; empty when the page is as the build found it. */
export function webStartStateDifferences(start: WebStartState, now: WebStartState): string[] {
  return [
    ...(start.location === now.location ? [] : [`location: ${start.location} -> ${now.location}`]),
    ...leftOver(start.lines, now.lines).map((line) => `gone: ${line}`),
    ...leftOver(now.lines, start.lines).map((line) => `new: ${line}`)
  ];
}

/** The lines of `lines`, in order, that `other` does not account for, counting repeats. */
function leftOver(lines: readonly string[], other: readonly string[]): string[] {
  const available = new Map<string, number>();
  for (const line of other) available.set(line, (available.get(line) ?? 0) + 1);
  return lines.filter((line) => {
    const count = available.get(line) ?? 0;
    if (count === 0) return true;
    available.set(line, count - 1);
    return false;
  });
}
