// Date conditions relative to the run's now (t800, K1), held to Core's shared
// cases: every case Core refuses, this grammar refuses, and every case Core
// keeps or leaves out, the condition this grammar writes keeps or leaves out
// under Core's own judge at the case's now, as the page and the plan resolver
// run it. Also the date spellings this grammar reads and Core does not:
// after, before, onOrAfter, onOrBefore and in the last. A library's events and
// returns, made up.

import assert from "node:assert/strict";
import test from "node:test";
import { AUTOMATION_STUDIO_RECORD_CONDITION_DATE_CASES, automationStudioRecordConditionHolds } from "fluxiq/automation-studio/nodes";
import { webAutomationExtractConditionSayingValue } from "../condition-grammar";
import { webAutomationExtractListRequestRead } from "../read-request";

const BASE = { item: ".event", fields: { name: ".name", when: { kind: "text" as const, selector: ".when" } } };
const NOW = Date.UTC(2026, 9, 6, 12);
const DAY = 86_400_000;

/** A case's condition as the canonical one Core parses it to: no `as`, which its bounds already say. */
function canonical(written: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const { as: _as, ...rest } = written;
  return rest;
}

test("Core's date cases: refused where Core refuses them, and otherwise keeping exactly the rows Core keeps", () => {
  assert.ok(AUTOMATION_STUDIO_RECORD_CONDITION_DATE_CASES.length > 40);
  for (const { written, cell, now, expected } of AUTOMATION_STUDIO_RECORD_CONDITION_DATE_CASES) {
    const label = `${JSON.stringify(written)} of ${JSON.stringify(cell)}`;
    const said = webAutomationExtractConditionSayingValue({ ...written }, []);
    const read = webAutomationExtractListRequestRead({ ...BASE, where: [{ field: "when", ...written }] });
    if (expected === "refused") {
      assert.equal(said.ok, false, label);
      assert.deepEqual(read.dropped, ["where.0"], label);
      continue;
    }
    assert.ok(said.ok, label);
    assert.deepEqual(said.says, canonical(written), label);
    assert.deepEqual(read.request?.where, [{ field: "when", ...canonical(written) }], label);
    assert.equal(automationStudioRecordConditionHolds(read.request!.where![0]!, cell ?? undefined, now), expected, label);
  }
});

test("after, before, onOrAfter and onOrBefore are read as Core's one spelling of each, relative or not", () => {
  const says = (written: Record<string, unknown>) => webAutomationExtractConditionSayingValue(written, []);
  assert.deepEqual(says({ after: "2026-09-19" }), { ok: true, says: { greaterThan: "2026-09-19" } });
  assert.deepEqual(says({ before: "today", as: "date" }), { ok: true, says: { lessThan: "today" } });
  assert.deepEqual(says({ onOrAfter: "7 days ago" }), { ok: true, says: { atLeast: "7 days ago" } });
  assert.deepEqual(says({ on_or_before: "now" }), { ok: true, says: { atMost: "now" } });
  assert.deepEqual(says({ inTheLast: "7 days" }), { ok: true, says: { within: "7 days" } });
  assert.deepEqual(says({ within_the_last: "48 hours" }), { ok: true, says: { within: "48 hours" } });
  // Two spellings of one phrase that disagree are two readings of the condition, and refused.
  assert.deepEqual(says({ after: "2026-09-19", greaterThan: "2026-09-20" }), { ok: false, key: "greaterThan" });
  // A within is a date comparison: no number bound beside it, and `as: "number"` says otherwise.
  assert.deepEqual(says({ within: "7 days", atLeast: 4 }), { ok: false });
  assert.deepEqual(says({ within: "7 days", as: "number" }), { ok: false, key: "as" });
  assert.deepEqual(says({ within: "3 months" }), { ok: false, key: "within" });
  assert.deepEqual(says({ within: "7 days", is: "absent" }), { ok: false });
});

test("a relative condition keeps the rows of the run's now, and another now keeps others", () => {
  const condition = webAutomationExtractListRequestRead({ ...BASE, where: [{ field: "when", within: "7 days" }] }).request!.where![0]!;
  assert.equal(automationStudioRecordConditionHolds(condition, "2026-10-02", NOW), true);
  assert.equal(automationStudioRecordConditionHolds(condition, "2026-10-02", NOW + 10 * DAY), false);
  // A row's own relative date moves with the same now.
  assert.equal(automationStudioRecordConditionHolds(condition, "3 days ago", NOW + 10 * DAY), true);
});
