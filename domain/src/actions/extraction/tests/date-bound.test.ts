// A `where` date bound (t790, run `run-mvswewhy-e4e469d4`): a request asking for
// rows "on or after" a day could only be written as a pattern of three days,
// which dropped every later row. The grammar reads a bound written as a date and
// refuses one that names no one date; the page judges an item with Core's own
// condition function, as `content/extraction/item-filter.ts` does. An events
// calendar, made up.

import assert from "node:assert/strict";
import test from "node:test";
import { automationStudioRecordConditionHolds } from "fluxiq/automation-studio/nodes";
import { webAutomationExtractConditionSayingValue } from "../condition-grammar";
import { webAutomationExtractListRequestRead } from "../read-request";

const BASE = { item: ".event", fields: { name: ".name", starts: { kind: "text" as const, selector: ".starts" } } };
const NOW = Date.UTC(2026, 9, 6, 12);

function where(condition: unknown) {
  return webAutomationExtractListRequestRead({ ...BASE, where: [condition] });
}

test("a date bound is read, its as checked and not carried, since the text bound already says it", () => {
  assert.deepEqual(where({ field: "starts", atLeast: "2026-09-19", as: "date" }).request?.where, [{ field: "starts", atLeast: "2026-09-19" }]);
  // `as` may be left out: a bound written as text is a date bound.
  assert.deepEqual(where({ field: "starts", atLeast: "19 September 2026", atMost: "Sep 30, 2026" }).request?.where, [
    { field: "starts", atLeast: "19 September 2026", atMost: "Sep 30, 2026" }
  ]);
  // Another spelling of a bound reads as the canonical one, as for numbers.
  assert.deepEqual(webAutomationExtractConditionSayingValue({ min: "2026-09-19", as: "date" }, []), { ok: true, says: { atLeast: "2026-09-19" } });
  // `as: "number"` says what a number bound already says.
  assert.deepEqual(where({ field: "starts", atLeast: 4, as: "number" }).request?.where, [{ field: "starts", atLeast: 4 }]);
});

test("a date bound that names no one date is refused at its key, never run as a filter that keeps nothing", () => {
  // "3 days ago" and "today" are bounds since t800 (K1), read against the run's now (`condition-date.test.ts`).
  for (const bound of ["Sep 19", "3 months ago", "tomorrow", "02/03/2026", "soon"]) {
    assert.deepEqual(webAutomationExtractConditionSayingValue({ atLeast: bound, as: "date" }, []), { ok: false, key: "atLeast" }, bound);
    assert.deepEqual(where({ field: "starts", atLeast: bound }).dropped, ["where.0"], bound);
  }
  // Bounds of two kinds, and an `as` that says another kind, name no one condition.
  assert.deepEqual(webAutomationExtractConditionSayingValue({ atLeast: "2026-09-19", atMost: 30 }, []), { ok: false });
  assert.deepEqual(webAutomationExtractConditionSayingValue({ atLeast: 4, as: "date" }, []), { ok: false, key: "as" });
  assert.deepEqual(webAutomationExtractConditionSayingValue({ as: "date" }, []), { ok: false, key: "as" });
  assert.deepEqual(webAutomationExtractConditionSayingValue({ atLeast: "2026-09-19", as: "day" }, []), { ok: false, key: "as" });
});

test("the page keeps the items on or after the bound's day, in the formats a listing writes", () => {
  const condition = where({ field: "starts", atLeast: "2026-09-19", as: "date" }).request!.where![0]!;
  const holds = (value: string | undefined) => automationStudioRecordConditionHolds(condition, value, NOW);
  assert.equal(holds("Monday 21 September 2026 at 04:00"), true);
  assert.equal(holds("Saturday 19 September 2026 at 00:05"), true);
  assert.equal(holds("21 Sep 2026"), true);
  assert.equal(holds("2026-09-21"), true);
  assert.equal(holds("Sep 21, 2026"), true);
  assert.equal(holds("21/09/2026"), true);
  assert.equal(holds("Friday 18 September 2026 at 23:30"), false);
  assert.equal(holds("18 Sep 2026"), false);
});

test("between two bounds keeps both days and the days between", () => {
  const condition = where({ field: "starts", atLeast: "2026-09-19", atMost: "2026-09-21", as: "date" }).request!.where![0]!;
  const holds = (value: string) => automationStudioRecordConditionHolds(condition, value, NOW);
  assert.equal(holds("19 Sep 2026"), true);
  assert.equal(holds("Sunday 20 September 2026 at 13:00"), true);
  assert.equal(holds("Monday 21 September 2026 at 23:59"), true);
  assert.equal(holds("Tuesday 22 September 2026 at 00:00"), false);
  assert.equal(holds("18 Sep 2026"), false);
});

test("an item whose date the bound cannot read is not kept, not or no not", () => {
  const kept = where({ field: "starts", atLeast: "2026-09-19", as: "date" }).request!.where![0]!;
  const excluded = where({ field: "starts", atLeast: "2026-09-19", as: "date", not: true }).request!.where![0]!;
  for (const value of ["Date to be confirmed", "02/03/2026", "", undefined]) {
    assert.equal(automationStudioRecordConditionHolds(kept, value, NOW), false, String(value));
    assert.equal(automationStudioRecordConditionHolds(excluded, value, NOW), false, String(value));
  }
  assert.equal(automationStudioRecordConditionHolds(excluded, "2026-09-01", NOW), true);
});
