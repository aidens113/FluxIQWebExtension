// What changed between two web state summaries (t223): where the browser is,
// what the document is called, and every line of the page view that appeared
// or left, as the lines themselves.
//
// It is what Core's `core.state_diff` option answers a model with, and what a
// recovery's context shows as `state_diff`, so it says what changed in the same
// words the model reads every page in, and never as element objects. The lines
// are compared as a multiset: a page that lists "Add to cart" twelve times and
// then eleven lost one. Nothing is capped (t200).

import type { JsonObject } from "fluxiq/core";
import { WEB_STATE_DIFF_SCHEMA_VERSION } from "./schema-version";
import { webStateSummaryLines } from "./summary-lines";

/** The diff of two summaries, each the page view or a structured packet stored before t223. */
export function webAutomationStateDiff(
  before: JsonObject | undefined,
  after: JsonObject | undefined,
  beforeStateRef?: string,
  afterStateRef?: string
): JsonObject {
  const was = webStateSummaryLines(before);
  const now = webStateSummaryLines(after);
  const added = leftOver(now.lines, was.lines);
  const removed = leftOver(was.lines, now.lines);
  return {
    schemaVersion: WEB_STATE_DIFF_SCHEMA_VERSION,
    ...(beforeStateRef === undefined ? {} : { beforeStateRef }),
    ...(afterStateRef === undefined ? {} : { afterStateRef }),
    ...(was.location === undefined ? {} : { beforeLocation: was.location }),
    ...(now.location === undefined ? {} : { afterLocation: now.location }),
    locationChanged: was.location !== undefined && now.location !== undefined && was.location !== now.location,
    titleChanged: was.title !== now.title,
    beforeLineCount: was.lines.length,
    afterLineCount: now.lines.length,
    addedCount: added.length,
    removedCount: removed.length,
    added: added.join("\n"),
    removed: removed.join("\n")
  };
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
