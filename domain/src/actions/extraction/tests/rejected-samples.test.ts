// The summary's one page-valued member: rows each condition rejected, carried
// only beside the counts, only of declared fields, and cut to their bounds at
// the wire whatever the page sent (`../rejected-samples.ts`).

import assert from "node:assert/strict";
import test from "node:test";
import { webAutomationExtractionSummaryValue } from "../summary";
import { WEB_AUTOMATION_EXTRACT_REJECTED_SAMPLE_CHARS, WEB_AUTOMATION_EXTRACT_REJECTED_SAMPLE_ROWS } from "../rejected-samples";

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

test("samples are cut to three rows per condition and eighty characters per value", () => {
  const long = "x".repeat(500);
  const flooded = [Array.from({ length: 9 }, () => ({ name: long })), []];
  const copied = webAutomationExtractionSummaryValue({ ...SUMMARY, rejectedSamples: flooded })?.rejectedSamples;
  assert.equal(copied?.[0]?.length, WEB_AUTOMATION_EXTRACT_REJECTED_SAMPLE_ROWS);
  assert.equal(copied?.[0]?.[0]?.name?.length, WEB_AUTOMATION_EXTRACT_REJECTED_SAMPLE_CHARS);
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
