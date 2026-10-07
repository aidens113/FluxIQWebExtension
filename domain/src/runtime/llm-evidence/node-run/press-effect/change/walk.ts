// Which lines of the page view a node call changed, as one walk the outcome's
// change list (`../page-changes.ts`) and the draft statement's
// (`./statement.ts`) are both read from, so the two never disagree about
// what changed (t285).
//
// The two page views are compared by handle from the facts the view prints
// (`../../../page-view/line/facts.ts`), walked together in page order, so a line
// that went is placed where it stood among the lines that stayed. Every kind of
// line is walked; each reader says which it reports.
//
// Walked only where the two pages are the same page: a call that moved the page
// elsewhere changed everything, and the page it left says so. Not for a look,
// a navigation, a read or a replay, none of which change the page in place.

import type { WebLlmSnapshotBinding } from "../../../sanitize";
import { webLlmLineFacts, type WebLlmLineFact } from "../../../page-view";
import type { WebRunnableNode } from "../../catalog";
import { webMovesThePage } from "../../start-location";

/**
 * One changed line: one that `appeared` or `went`, or one on both pages
 * (`both`) whose state tokens or words differ.
 */
export type WebPageChange =
  | { kind: "appeared" | "went"; line: WebLlmLineFact }
  | { kind: "both"; was: WebLlmLineFact; now: WebLlmLineFact };

/**
 * Every line a call changed on the page it found, in page order; `undefined`
 * where it is not walked: a node that does not change the page in place, a
 * page missing on either side, or a different location.
 */
export function webPageChangeWalk(
  node: WebRunnableNode,
  before: WebLlmSnapshotBinding | undefined,
  after: WebLlmSnapshotBinding | undefined
): WebPageChange[] | undefined {
  if (node.effect !== "mutate" || webMovesThePage(node)) return undefined;
  if (before === undefined || after === undefined) return undefined;
  if (before.evidence.location !== after.evidence.location) return undefined;
  return walk(webLlmLineFacts(before.evidence), webLlmLineFacts(after.evidence));
}

function walk(before: readonly WebLlmLineFact[], after: readonly WebLlmLineFact[]): WebPageChange[] {
  const beforeByHandle = new Map(before.map((line) => [line.handle, line]));
  const afterHandles = new Set(after.map((line) => line.handle));
  const changes: WebPageChange[] = [];
  let i = 0;
  for (const line of after) {
    // The lines before this one that are no longer on the page at all.
    while (i < before.length && !afterHandles.has(before[i]!.handle)) changes.push({ kind: "went", line: before[i++]! });
    const was = beforeByHandle.get(line.handle);
    if (was === undefined) changes.push({ kind: "appeared", line });
    else {
      if (was.words !== line.words || was.tokens.join(" ") !== line.tokens.join(" ")) changes.push({ kind: "both", was, now: line });
      if (before[i]?.handle === line.handle) i++;
    }
  }
  while (i < before.length) {
    const line = before[i++]!;
    if (!afterHandles.has(line.handle)) changes.push({ kind: "went", line });
  }
  return changes;
}
