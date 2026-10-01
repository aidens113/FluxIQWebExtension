// The summary's one page-valued member: rows each condition rejected, carried
// only beside the counts, only of declared fields, and every one whole at
// the wire whatever the page sent (`../rejected-samples.ts`).

import assert from "node:assert/strict";
import test from "node:test";
import { webAutomationExtractionSummaryValue } from "../summary";

const SUMMARY = {
  recordCount: 8,
  pagesRead: 5,
  truncated: false,
  missingFields: [],
  fieldNames: ["name", "price"],
  conditions: { applied: 56, kept: 8, rejected: [13, 20], unfiltered: false }
};

test("samples beside the counts they illustrate arrive, one list per condition", () => {
  const rejectedSamples = [[{ name: "Sponsored earbuds", price: "$20" }], [{ name: "Pro Earbuds Wireless Charging Case", price: null }]];
  assert.deepEqual(webAutomationExtractionSummaryValue({ ...SUMMARY, rejectedSamples })?.rejectedSamples, rejectedSamples);
  // Absent is the ordinary summary, which is every summary a playback sends.
  assert.equal("rejectedSamples" in (webAutomationExtractionSummaryValue(SUMMARY) ?? {}), false);
});

test("every sampled row arrives, every value whole: no row count and no character cut", () => {
  const long = "x".repeat(5_000);
  const flooded = [Array.from({ length: 200 }, (_unused, index) => ({ name: `${index} ${long}` })), []];
  const copied = webAutomationExtractionSummaryValue({ ...SUMMARY, rejectedSamples: flooded })?.rejectedSamples;
  assert.equal(copied?.[0]?.length, 200);
  assert.deepEqual(copied?.[0], flooded[0]);
  assert.deepEqual(copied?.[1], []);
});

test("malformed samples drop the whole summary, as every other member does", () => {
  const cases: Array<[unknown, string]> = [
    [[[{ name: "a" }]], "one list for two conditions"],
    [[[{ sku: "a" }], []], "a key the read does not declare"],
    [[[{ name: 3 }], []], "a value that is not text"],
    [[["a"], []], "a row that is not a record"],
    ["rows", "not a list"]
  ];
  for (const [rejectedSamples, why] of cases) {
    assert.equal(webAutomationExtractionSummaryValue({ ...SUMMARY, rejectedSamples }), undefined, why);
  }
  // And none without the counts they sit beside.
  const uncounted: Record<string, unknown> = { ...SUMMARY };
  delete uncounted.conditions;
  assert.equal(webAutomationExtractionSummaryValue({ ...uncounted, rejectedSamples: [] }), undefined);
});

test("each condition's alone count and the alone lead of each list arrive, held to the counts and the lists", () => {
  const rejectedSamples = [[{ name: "Sponsored earbuds", price: "$20" }], [{ name: "Pro Earbuds Wireless Charging Case", price: null }, { name: "Sponsored charging case", price: "$12" }]];
  const conditions = { ...SUMMARY.conditions, alone: [4, 5] };
  const copied = webAutomationExtractionSummaryValue({ ...SUMMARY, conditions, rejectedSamples, rejectedSamplesAlone: [1, 1] });
  assert.deepEqual(copied?.conditions?.alone, [4, 5]);
  assert.deepEqual(copied?.rejectedSamplesAlone, [1, 1]);
  // Absent is a page build that predates them, and the summary arrives whole.
  assert.equal("alone" in (webAutomationExtractionSummaryValue(SUMMARY)?.conditions ?? {}), false);
  // One count per condition, none above its rejections; one lead per list, none above its length.
  for (const alone of [[4], [14, 5], [-1, 5], ["4", 5]]) {
    assert.equal(webAutomationExtractionSummaryValue({ ...SUMMARY, conditions: { ...conditions, alone } }), undefined, JSON.stringify(alone));
  }
  for (const rejectedSamplesAlone of [[1], [2, 1], [1, 3], "1"]) {
    assert.equal(webAutomationExtractionSummaryValue({ ...SUMMARY, rejectedSamples, rejectedSamplesAlone }), undefined, JSON.stringify(rejectedSamplesAlone));
  }
  // Only beside the lists.
  assert.equal(webAutomationExtractionSummaryValue({ ...SUMMARY, rejectedSamplesAlone: [0, 0] }), undefined);
});
