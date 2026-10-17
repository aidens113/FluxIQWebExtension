// What each condition read on the rows the read kept, carried inside
// `conditions` beside its counts, at most a few per condition, and a summary
// dropped for a malformed one (`../kept-values.ts`, t693). Run
// `run-mvbr0w7e-6a01c05b`'s repair could not tell a condition every row met. The
// examples are a library catalogue's, not a store's.

import assert from "node:assert/strict";
import test from "node:test";
import { WEB_AUTOMATION_EXTRACT_CONDITION_KEPT_VALUES_MOST } from "../kept-values";
import { webAutomationExtractionSummaryValue } from "../summary";

const COUNTS = { applied: 12, kept: 9, rejected: [0, 3], unfiltered: false };
const SUMMARY = { recordCount: 9, pagesRead: 1, truncated: false, missingFields: [], fieldNames: ["title", "status"], conditions: COUNTS };

test("each condition's kept values arrive beside its counts, an empty list where it read none", () => {
  const conditions = { ...COUNTS, keptValues: [["On loan", "Available"], []] };
  assert.deepEqual(webAutomationExtractionSummaryValue({ ...SUMMARY, conditions })?.conditions, conditions);
  // Absent is a page build that predates it, and its summary still arrives whole.
  const older = webAutomationExtractionSummaryValue(SUMMARY);
  assert.deepEqual(older?.conditions, COUNTS);
  assert.equal("keptValues" in (older?.conditions ?? {}), false);
});

test("a malformed list drops the whole summary, as every other member does", () => {
  const cases: Array<[unknown, string]> = [
    [[["On loan"]], "one list for two conditions"],
    [[Array.from({ length: WEB_AUTOMATION_EXTRACT_CONDITION_KEPT_VALUES_MOST + 1 }, (_unused, index) => `Shelf ${index}`), []], "more values than the bound"],
    [[["On loan", 7], []], "a value that is not a string"],
    [[[""], []], "an empty value"],
    [["On loan", []], "a value where a list belongs"]
  ];
  for (const [keptValues, label] of cases) {
    assert.equal(webAutomationExtractionSummaryValue({ ...SUMMARY, conditions: { ...COUNTS, keptValues } }), undefined, label);
  }
});
