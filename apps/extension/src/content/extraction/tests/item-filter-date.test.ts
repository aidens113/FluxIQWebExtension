// The page half of Core's shared date cases (t800, K1): a date condition the
// domain's grammar accepts keeps on the page exactly the items Core keeps at
// run end. The filter judges with Core's own `automationStudioRecordConditionHolds`
// and, as it stands, at the page's own clock (`Date.now()`), so each case is run
// with that clock set to the case's now. A library's events and returns, made up.
//
// Conditions here name a field of the record, so the items need no document.

import assert from "node:assert/strict";
import test from "node:test";
import { AUTOMATION_STUDIO_RECORD_CONDITION_DATE_CASES } from "fluxiq/automation-studio/nodes";
import { itemFilterFor } from "../item-filter";
import type { WebAutomationExtractItemCondition } from "../../types";

/** Never touched: every condition here names a field of the record. */
const ITEM = {} as Element;
const NOW = Date.UTC(2026, 9, 6, 12);

function rejects(condition: WebAutomationExtractItemCondition, value: string | null): boolean {
  const filter = itemFilterFor({ item: ".card", fields: { title: ".title", when: ".when" }, where: [{ field: "when", ...condition }] });
  return filter!(ITEM, { title: "Story hour", when: value }).length > 0;
}

test("every case Core keeps or leaves out, the page keeps or leaves out, at the case's now", (t) => {
  let cases = 0;
  for (const { written, cell, now, expected } of AUTOMATION_STUDIO_RECORD_CONDITION_DATE_CASES) {
    if (expected === "refused") continue;
    t.mock.method(Date, "now", () => now);
    const { as: _as, ...canonical } = written;
    assert.equal(!rejects(canonical as WebAutomationExtractItemCondition, cell), expected, `${JSON.stringify(written)} of ${JSON.stringify(cell)}`);
    t.mock.restoreAll();
    cases += 1;
  }
  assert.ok(cases > 30, `${cases} cases`);
});

test("a within on the page is measured from the page's clock: the same item falls out of the span ten days on", (t) => {
  // One mock, one moving clock: mocking Date.now twice stacks two mocks, and restoring them in creation order
  // leaves the first installed after the test, freezing every later test's real-clock waits.
  let clock = NOW;
  t.mock.method(Date, "now", () => clock);
  assert.equal(rejects({ within: "7 days" }, "2026-10-02"), false);
  clock = NOW + 10 * 86_400_000;
  assert.equal(rejects({ within: "7 days" }, "2026-10-02"), true);
  // An item whose date the condition cannot read is never kept, `not` or no `not`.
  assert.equal(rejects({ within: "7 days", not: true }, "Date to be confirmed"), true);
  assert.equal(rejects({ within: "7 days", not: true }, null), true);
});

test("a request's now wins over the page's clock, and absent it the clock is used", (t) => {
  t.mock.method(Date, "now", () => NOW + 10 * 86_400_000);
  const filterAt = (now: number | undefined) =>
    itemFilterFor({ item: ".card", fields: { title: ".title", when: ".when" }, where: [{ field: "when", within: "7 days" }], ...(now === undefined ? {} : { now }) })!;
  const rejected = (now: number | undefined) => filterAt(now)(ITEM, { title: "Story hour", when: "2026-10-02" }).length > 0;
  assert.equal(rejected(NOW), false);
  assert.equal(rejected(undefined), true);
  // A compact age is read against that instant too.
  const aged = (now: number | undefined) => filterAt(now)(ITEM, { title: "Story hour", when: "3d" }).length > 0;
  assert.equal(aged(NOW), false);
});
