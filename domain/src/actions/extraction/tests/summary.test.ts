// The result half of `web.dom.extract_list` on the wire (C2), and in particular
// the condition report a filtered read carries.
//
// The report exists because a read whose conditions rejected every row now
// answers with the rows they rejected rather than with none, and something has
// to say that is what it is looking at. The measurement behind it:
// `run-mug3tnti-9ab80b85` returned 0 records where 13 were wanted, and neither
// the person nor the repair could tell the filter having been wrong from the page
// having held nothing.
//
// The rule this file's subject enforces is that the summary carries counts,
// flags and declared field keys and nothing read off the page, because nothing
// redacts a field that arrives here. So a report that is not well formed drops
// the whole summary rather than riding along.

import assert from "node:assert/strict";
import test from "node:test";
import { webAutomationExtractionSummaryValue } from "../summary";

const SUMMARY = {
  recordCount: 2,
  pagesRead: 1,
  truncated: false,
  missingFields: ["price"],
  fieldNames: ["name", "price"]
};

test("a read that named no conditions carries no report, and is unchanged by the report existing", () => {
  assert.deepEqual(webAutomationExtractionSummaryValue(SUMMARY), SUMMARY);
});

test("a filtered read's counts are copied, including the one that says it answered unfiltered", () => {
  const conditions = { applied: 30, kept: 0, rejected: [0, 0, 30], unfiltered: true };
  assert.deepEqual(webAutomationExtractionSummaryValue({ ...SUMMARY, conditions }), { ...SUMMARY, conditions });
  const narrowed = { applied: 30, kept: 13, rejected: [4, 13], unfiltered: false };
  assert.deepEqual(webAutomationExtractionSummaryValue({ ...SUMMARY, conditions: narrowed }), { ...SUMMARY, conditions: narrowed });
  // A read whose conditions were applied to nothing is a real report, not a
  // malformed one: an empty page still says the conditions ran.
  const nothing = { applied: 0, kept: 0, rejected: [0], unfiltered: false };
  assert.deepEqual(webAutomationExtractionSummaryValue({ ...SUMMARY, conditions: nothing })?.conditions, nothing);
});

test("a report that is not well formed drops the whole summary rather than arriving beside it", () => {
  const rows: Array<[string, unknown]> = [
    ["not an object", "30 of 30"],
    ["a list", [30, 0]],
    ["a count that is not one", { applied: -1, kept: 0, rejected: [], unfiltered: true }],
    ["a count that is not an integer", { applied: 1.5, kept: 0, rejected: [], unfiltered: true }],
    ["a missing count", { applied: 30, rejected: [], unfiltered: true }],
    ["per-condition counts that are not counts", { applied: 30, kept: 0, rejected: ["all"], unfiltered: true }],
    ["per-condition counts that are not a list", { applied: 30, kept: 0, rejected: 30, unfiltered: true }],
    ["no verdict on whether it answered unfiltered", { applied: 30, kept: 0, rejected: [30] }],
    // A read cannot have kept more items than it was asked about, so a report
    // saying it did is describing something that did not happen.
    ["more kept than applied", { applied: 2, kept: 3, rejected: [], unfiltered: false }],
    // Nothing read off the page may arrive here, and a value dressed as a count
    // is exactly what that rule is for.
    ["a value rather than a count", { applied: 30, kept: 0, rejected: ["$49.00"], unfiltered: true }]
  ];
  for (const [why, conditions] of rows) {
    assert.equal(webAutomationExtractionSummaryValue({ ...SUMMARY, conditions }), undefined, why);
  }
});

test("the summary's own rules are unchanged: a malformed count or an undeclared missing field drops it", () => {
  assert.equal(webAutomationExtractionSummaryValue({ ...SUMMARY, recordCount: -1 }), undefined);
  assert.equal(webAutomationExtractionSummaryValue({ ...SUMMARY, truncated: "no" }), undefined);
  assert.equal(webAutomationExtractionSummaryValue({ ...SUMMARY, missingFields: ["rating"] }), undefined);
  assert.equal(webAutomationExtractionSummaryValue(undefined), undefined);
});

test("a read that never saw its list carries the word that says so, and one that saw it carries the other", () => {
  // `run-muhnh0s5-98a27f42`: six reads whose selector named nothing, each
  // `succeeded` with zero records, and nothing on the wire to tell that from a
  // page holding nothing.
  const empty = { ...SUMMARY, recordCount: 0, missingFields: [], listPresence: "never_appeared" };
  assert.deepEqual(webAutomationExtractionSummaryValue(empty), empty);
  const found = { ...SUMMARY, listPresence: "appeared" };
  assert.deepEqual(webAutomationExtractionSummaryValue(found), found);
  // A read that never waited for a list of its own -- a continued read -- says
  // nothing, and the summary is the one it always was.
  assert.deepEqual(webAutomationExtractionSummaryValue(SUMMARY), SUMMARY);
  assert.equal("listPresence" in (webAutomationExtractionSummaryValue(SUMMARY) ?? {}), false);
});

test("a word this contract does not know drops the whole summary rather than riding beside it", () => {
  const rows: unknown[] = ["maybe", "", "APPEARED", 0, true, null, ["appeared"], { presence: "appeared" }];
  for (const listPresence of rows) {
    assert.equal(webAutomationExtractionSummaryValue({ ...SUMMARY, listPresence }), undefined, `listPresence: ${JSON.stringify(listPresence)}`);
  }
});

test("the list word and the condition report travel together, since a read can have both", () => {
  const both = { ...SUMMARY, listPresence: "appeared", conditions: { applied: 30, kept: 0, rejected: [30], unfiltered: true } };
  assert.deepEqual(webAutomationExtractionSummaryValue(both), both);
});
