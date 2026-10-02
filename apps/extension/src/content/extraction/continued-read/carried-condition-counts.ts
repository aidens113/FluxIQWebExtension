// The `where` condition counts a continued read starts from.
//
// Until 2026-09-30 these restarted at each document, so a read that paged
// through documents of cards and ended on one with none -- the store's
// rate-limit page, by every sign the bundle kept -- reported `applied: 0`, as if
// its conditions had done nothing (`run-munnhi5q-4867dabe`).

import type { ExtractionCheckpoint } from "../../../shared/extraction-continuation";

/** The counts a read's conditions start from: items asked about, items kept, and per condition its rejections, its first value read, and the items only it rejected. */
export type CarriedConditionCounts = { applied: number; kept: number; rejected: number[]; seen: (string | null)[]; alone: number[] };

/**
 * The condition counts a continued read starts from: its predecessor's, or
 * zeros for a read that began here, and zeros too for counts that do not fit
 * this request's `where` -- one rejection count per condition is the only shape
 * a positional count can be added to, and the same request always has it.
 */
export function carriedConditionCounts(resume: ExtractionCheckpoint | undefined, conditions: number): CarriedConditionCounts {
  const carried = resume?.conditions;
  const none = (): (string | null)[] => Array.from({ length: conditions }, () => null);
  const zeros = (): number[] => Array.from({ length: conditions }, () => 0);
  if (carried === undefined || carried.rejected.length !== conditions) return { applied: 0, kept: 0, rejected: zeros(), seen: none(), alone: zeros() };
  // `seen` and `alone` from a page build that did not carry them start from none.
  const alone = carried.alone?.length === conditions ? [...carried.alone] : zeros();
  return { applied: carried.applied, kept: carried.kept, rejected: [...carried.rejected], seen: carried.seen?.length === conditions ? [...carried.seen] : none(), alone };
}
