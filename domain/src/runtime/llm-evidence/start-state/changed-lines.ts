// The lines that differ between two start states (t462, t471), as the lines
// themselves: those the first had that are gone, and those that are new.
// Lines are compared as a multiset, as a state diff compares them
// (`../../state-diff/state-diff.ts`, whose line counting is not exported):
// twelve "Add to cart" lines that became eleven lost one. Core is given them
// beside the worded `differs` so it can tell which act of a build changed a
// line -- a total two acts both changed is one line, not two -- without
// reading the words (`fluxiq` `flow-bootstrap/site-reset/ledger.ts`).

import type { WebStartState } from "./state";

/** What `now` lacks of `start`'s lines (`gone`) and has beyond them (`added`), in page order, counting repeats. */
export function webStartStateChangedLines(start: WebStartState, now: WebStartState): { gone: string[]; added: string[] } {
  return { gone: leftOver(start.lines, now.lines), added: leftOver(now.lines, start.lines) };
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
