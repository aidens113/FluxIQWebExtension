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

test("the two counts a zero read is diagnosed by travel when a page sends them, and are absent when it does not", () => {
  // The four things a stored-nothing read could have been, which six Flows of the
  // everything-store rung could not be told apart by: the node never ran; the
  // selector named nothing; it matched rows and every column read empty; the
  // conditions removed them all. `listPresence` separates the second,
  // `conditions` the fourth, and these two are what separate the third.
  const seen = { ...SUMMARY, itemsSeen: 43, emptyRecords: 0 };
  assert.deepEqual(webAutomationExtractionSummaryValue(seen), seen);
  // Rows found and every field read off the wrong element: the selector is right
  // and the fields are not, which `missingFields` alone cannot say -- it reads
  // the same for one bad row as for forty empty ones.
  const hollow = { ...SUMMARY, recordCount: 43, itemsSeen: 43, emptyRecords: 43, missingFields: ["name", "price"] };
  assert.deepEqual(webAutomationExtractionSummaryValue(hollow), hollow);
  // Absent from a page build that predates them, and the summary still arrives
  // whole -- the rule `listPresence` was added under.
  const without = webAutomationExtractionSummaryValue(SUMMARY);
  assert.deepEqual(without, SUMMARY);
  assert.equal("itemsSeen" in (without ?? {}), false);
  assert.equal("emptyRecords" in (without ?? {}), false);
});

test("a count that is not one drops the whole summary rather than arriving as a number the read did not produce", () => {
  const rows: unknown[] = ["43", -1, 1.5, null, true, [43], {}, Number.NaN];
  for (const value of rows) {
    assert.equal(webAutomationExtractionSummaryValue({ ...SUMMARY, itemsSeen: value }), undefined, `itemsSeen: ${JSON.stringify(value)}`);
    assert.equal(webAutomationExtractionSummaryValue({ ...SUMMARY, emptyRecords: value }), undefined, `emptyRecords: ${JSON.stringify(value)}`);
  }
  // `recordCount` above `itemsSeen` is not malformed: a continued read carries
  // its predecessor's records and counts only its own document's items, and
  // dropping the whole account is the one thing a zero read cannot afford.
  const continued = { ...SUMMARY, recordCount: 20, itemsSeen: 8 };
  assert.deepEqual(webAutomationExtractionSummaryValue(continued), continued);
});

test("the wait's account arrives as fields, so a stop reason can be counted rather than read", () => {
  // t143's day of work, in one field. Six zero-record reads were told apart by
  // arithmetic on their durations -- 2089, 2576, 2109 and 2082 ms against reads
  // that succeeded at 255 ms and at 4.6 to 14.3 s -- because the wait's own
  // constant was 2000 ms and nothing published what a read had waited for. A
  // scan over a run's bundles can group by `stoppedOn`; it cannot group by a
  // sentence.
  const waited = { ...SUMMARY, listPresence: "appeared", listWait: { stoppedOn: "list_present", waitedMs: 4024, waitedFor: 1 } };
  assert.deepEqual(webAutomationExtractionSummaryValue(waited), waited);
  // Absent for a read that never waited for a list of its own, exactly as
  // `listPresence` is, and the summary is the one it always was.
  const without = webAutomationExtractionSummaryValue(SUMMARY);
  assert.deepEqual(without, SUMMARY);
  assert.equal("listWait" in (without ?? {}), false);
});

test("a wait that gave up on a still page and one that found its list differ by a field, not by a duration", () => {
  // The two stops that were indistinguishable on the wire, now distinguishable
  // without knowing a single constant. `page_settled` beside `recordCount: 0` is
  // the 2026-09-25 regression's signature and the page can no longer produce it,
  // which is the whole reason it must be recordable: the pair is kept rather than
  // refused, so a bundle that carries it again names the regression itself.
  const settled = {
    ...SUMMARY,
    recordCount: 0,
    missingFields: [],
    itemsSeen: 0,
    listPresence: "never_appeared",
    listWait: { stoppedOn: "page_settled", waitedMs: 2023, waitedFor: 1 }
  };
  const present = { ...SUMMARY, listPresence: "appeared", listWait: { stoppedOn: "list_present", waitedMs: 255, waitedFor: 1 } };
  assert.deepEqual(webAutomationExtractionSummaryValue(settled), settled);
  assert.deepEqual(webAutomationExtractionSummaryValue(present), present);
  assert.notEqual(
    webAutomationExtractionSummaryValue(settled)?.listWait?.stoppedOn,
    webAutomationExtractionSummaryValue(present)?.listWait?.stoppedOn
  );
  // And a read whose list turned up after the wait had ended on the settle is a
  // shape the page can produce, so no pairing of the two fields is refused.
  const contradictory = { ...SUMMARY, listPresence: "never_appeared", missingFields: [], listWait: { stoppedOn: "list_present", waitedMs: 900, waitedFor: 1 } };
  assert.deepEqual(webAutomationExtractionSummaryValue(contradictory), contradictory);
});

test("every one of the four stop words is known, and anything else drops the whole summary", () => {
  for (const stoppedOn of ["list_present", "page_settled", "window_elapsed", "deadline_passed"]) {
    const summary = { ...SUMMARY, listWait: { stoppedOn, waitedMs: 10_004, waitedFor: 2 } };
    assert.deepEqual(webAutomationExtractionSummaryValue(summary), summary, stoppedOn);
  }
  // Dropped rather than kept without its account, because absence already means
  // "this read never waited for a list": an account that quietly went missing
  // would make a reader counting `stoppedOn` treat a continued read and a
  // half-understood one as the same thing, which is the ambiguity this field
  // exists to remove.
  const refused: unknown[] = [
    "settled",
    "PAGE_SETTLED",
    "",
    { stoppedOn: "page_settled", waitedMs: -1, waitedFor: 1 },
    { stoppedOn: "page_settled", waitedMs: 2000.5, waitedFor: 1 },
    { stoppedOn: "page_settled", waitedMs: 2000 },
    { waitedMs: 2000, waitedFor: 1 },
    { stoppedOn: "page_settled", waitedMs: "2000ms", waitedFor: 1 },
    ["page_settled", 2000, 1],
    null,
    2000
  ];
  for (const listWait of refused) {
    assert.equal(webAutomationExtractionSummaryValue({ ...SUMMARY, listWait }), undefined, `listWait: ${JSON.stringify(listWait)}`);
  }
});

test("the wait's numbers are not second-guessed: a surprising one is a fact about a page, not a malformed report", () => {
  // No bound either way. The page holds `waitedFor` to at least one and bounds
  // `waitedMs` by its own render window, and refusing a number outside what this
  // side happens to know would cost the whole account -- the one thing a zero
  // read cannot afford -- for a number that is merely surprising.
  const nothing = { ...SUMMARY, listWait: { stoppedOn: "window_elapsed", waitedMs: 0, waitedFor: 0 } };
  assert.deepEqual(webAutomationExtractionSummaryValue(nothing), nothing);
  const long = { ...SUMMARY, listWait: { stoppedOn: "deadline_passed", waitedMs: 600_000, waitedFor: 5000 } };
  assert.deepEqual(webAutomationExtractionSummaryValue(long), long);
});
