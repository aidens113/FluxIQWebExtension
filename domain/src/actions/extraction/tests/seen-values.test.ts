// What each condition's own read found, carried inside `conditions` beside its
// counts, whole at the wire whatever its length, and a summary
// dropped for a malformed one (`../seen-values.ts`). The defect it closes:
// `run-munw7ffn-fe1cecd2`'s judge was told `attribute aria-label is present` of
// the Brightaisle Plus badge and nothing that said what it read.

import assert from "node:assert/strict";
import test from "node:test";
import { webAutomationExtractionSummaryValue } from "../summary";

const COUNTS = { applied: 56, kept: 8, rejected: [13, 20], unfiltered: false };

const SUMMARY = {
  recordCount: 8,
  pagesRead: 5,
  truncated: false,
  missingFields: [],
  fieldNames: ["name", "price"],
  conditions: COUNTS
};

test("each condition's value arrives beside its counts, null where its read found none", () => {
  const conditions = { ...COUNTS, seen: ["Brightaisle Plus", null] };
  assert.deepEqual(webAutomationExtractionSummaryValue({ ...SUMMARY, conditions })?.conditions, conditions);
  // Absent is a page build that predates it, and its summary still arrives whole.
  const older = webAutomationExtractionSummaryValue(SUMMARY);
  assert.deepEqual(older?.conditions, COUNTS);
  assert.equal("seen" in (older?.conditions ?? {}), false);
});

test("a value arrives whole whatever its length: no character cut", () => {
  const conditions = { ...COUNTS, seen: ["x".repeat(5_000), "Brightaisle Plus"] };
  const seen = webAutomationExtractionSummaryValue({ ...SUMMARY, conditions })?.conditions?.seen;
  assert.deepEqual(seen, ["x".repeat(5_000), "Brightaisle Plus"]);
});

test("a malformed value drops the whole summary, as every other member does", () => {
  const cases: Array<[unknown, string]> = [
    [["Brightaisle Plus"], "one value for two conditions"],
    [["Brightaisle Plus", null, null], "three values for two conditions"],
    [["Brightaisle Plus", 3], "a value that is not text"],
    [[{ label: "Brightaisle Plus" }, null], "a value that is an object"],
    ["Brightaisle Plus", "not a list"],
    [null, "null for the list"]
  ];
  for (const [seen, why] of cases) {
    assert.equal(webAutomationExtractionSummaryValue({ ...SUMMARY, conditions: { ...COUNTS, seen } }), undefined, why);
  }
});
