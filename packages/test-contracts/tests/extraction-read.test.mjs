import assert from "node:assert/strict";
import test from "node:test";
// A namespace import, so a member this build does not export fails its own tests rather than the whole file.
import * as contracts from "../dist/index.js";

const { validateRunExtractionRead, isRunExtractionFieldKey, RUN_EXTRACTION_READ_BOUNDS, RUN_EXTRACTION_WAIT_STOP } = contracts;

// A list read's account of itself. It exists because the bundle published the
// oracle's side of the comparison and nothing of the read's: `observedRecords:
// 0` says the answer was wrong and cannot say whether the selector named
// nothing, the page held nothing, or the conditions rejected every row -- three
// causes with three different repairs.
const read = { recordCount: 8, pagesRead: 1, truncated: false, fieldNames: ["name", "price"], missingFields: [] };

const issuesOf = (value) => {
  const result = validateRunExtractionRead(value);
  return result.valid ? [] : result.issues.map((issue) => `${issue.path} ${issue.message}`);
};

test("a read that found rows carries its counts, its fields and whether the list appeared", () => {
  assert.deepEqual(issuesOf(read), [], "the least a read reports");
  assert.deepEqual(issuesOf({ ...read, listPresence: "appeared" }), [], "the list was there");
  assert.deepEqual(issuesOf({ ...read, missingFields: ["price"] }), [], "a declared field some row did not yield");
  assert.deepEqual(issuesOf({ ...read, truncated: true, pagesRead: 5 }), [], "a read a cap cut short");
});

// The case the record was written for: a successful read of zero records whose
// item selector never named an element. Nothing else in the bundle could tell
// it from a page that genuinely held nothing.
test("a list that never appeared is a fact about a successful read, not a failure", () => {
  assert.deepEqual(issuesOf({ ...read, recordCount: 0, missingFields: [], listPresence: "never_appeared" }), []);
  assert.deepEqual(issuesOf({ ...read, listPresence: "perhaps" }), ["$.listPresence must be one of appeared, never_appeared"], "a word nothing downstream can act on");
});

// The second of the three causes, from live run `run-mug3tnti-9ab80b85`: 0
// records where 13 were wanted, from conditions that rejected every row. The
// read answered with the rows they rejected, and `unfiltered` beside the counts
// is how a reader knows that is what it is looking at.
test("the condition report says what where did, positionally, so one condition can be blamed", () => {
  assert.deepEqual(issuesOf({ ...read, recordCount: 30, conditions: { applied: 30, kept: 0, rejected: [30, 2, 0], unfiltered: true } }), []);
  assert.deepEqual(issuesOf({ ...read, conditions: { applied: 20, kept: 8, rejected: [12], unfiltered: false } }), []);
  assert.deepEqual(issuesOf({ ...read, conditions: { applied: 2, kept: 3, rejected: [0], unfiltered: false } }), ["$.conditions.kept must not exceed the items the conditions were applied to"]);
  assert.deepEqual(issuesOf({ ...read, conditions: { applied: 2, kept: 1, rejected: [], unfiltered: false } }), ["$.conditions.rejected must hold one rejection count per condition, so a report of no conditions is no report"]);
  assert.deepEqual(
    issuesOf({ ...read, conditions: { applied: 2, kept: 1, rejected: Array.from({ length: RUN_EXTRACTION_READ_BOUNDS.maxConditions + 1 }, () => 0), unfiltered: false } }),
    [`$.conditions.rejected must hold at most ${RUN_EXTRACTION_READ_BOUNDS.maxConditions} rejection counts`],
    "an unbounded list from a downstream host is refused rather than republished",
  );
  assert.deepEqual(issuesOf({ ...read, conditions: { applied: 2, kept: 1, rejected: [1], unfiltered: false, reason: "price too high" } }), ["$.conditions.reason unknown property"], "prose beside the counts");
});

// The three members that existed, were produced by the extension, and reached
// no bundle. Before they did, six identical-looking zero reads had to be told
// apart by arithmetic on `durationMs` -- which is how a regression in the read's
// own wait survived ten live attempts.
test("the wait's account, the items the selector matched and the records that came back empty are all publishable", () => {
  assert.deepEqual(issuesOf({ ...read, itemsSeen: 12, emptyRecords: 0 }), [], "a read that matched more items than it returned");
  assert.deepEqual(
    issuesOf({ ...read, recordCount: 0, itemsSeen: 0, listPresence: "never_appeared", listWait: { stoppedOn: "page_settled", waitedMs: 2089, waitedFor: 1 } }),
    [],
    "the 2026-09-25 regression as fields rather than as a duration to be compared against a constant",
  );
  for (const stoppedOn of RUN_EXTRACTION_WAIT_STOP) {
    assert.deepEqual(issuesOf({ ...read, listWait: { stoppedOn, waitedMs: 0, waitedFor: 1 } }), [], stoppedOn);
  }
  // Nothing is cross-checked among the counts, deliberately: each apparently
  // impossible pairing is a real read that a diagnosis needs to see.
  assert.deepEqual(issuesOf({ ...read, itemsSeen: 8, emptyRecords: 8 }), [], "every row matched and every field read off the wrong element");
  assert.deepEqual(issuesOf({ ...read, itemsSeen: 0, emptyRecords: 0 }), [], "a continued read, whose predecessor did the matching");
  assert.deepEqual(issuesOf({ ...read, itemsSeen: 400 }), [], "duplicates, or the item bound");
});

// `unknown` is a published word rather than a leniency in the validator. This is
// the strict side of the boundary: `extractionReadOf` resolves an unfamiliar word
// to `unknown` as a read is ingested, so one reaching here means that did not
// happen, and saying so is the only way that stays true.
test("a stop word outside the set is an issue here, because the reader was meant to have resolved it", () => {
  assert.deepEqual(
    issuesOf({ ...read, listWait: { stoppedOn: "items_stopped_growing", waitedMs: 10, waitedFor: 1 } }),
    [`$.listWait.stoppedOn must be one of ${RUN_EXTRACTION_WAIT_STOP.join(", ")}`],
  );
  assert.deepEqual(issuesOf({ ...read, listWait: { stoppedOn: "page_settled", waitedMs: 10, waitedFor: 1, itemSelector: ".card" } }), ["$.listWait.itemSelector unknown property"], "no room beside the three members for a selector");
  assert.deepEqual(issuesOf({ ...read, listWait: { stoppedOn: "page_settled", waitedMs: "2089", waitedFor: 1 } }), [`$.listWait.waitedMs must be a finite integer from 0 to ${Number.MAX_SAFE_INTEGER}`]);
  assert.deepEqual(issuesOf({ ...read, listWait: "page_settled after 2089ms" }), ["$.listWait must be an object"], "the account as prose");
  assert.deepEqual(issuesOf({ ...read, itemsSeen: "twelve" }), [`$.itemsSeen must be a finite integer from 0 to ${Number.MAX_SAFE_INTEGER}`]);
  assert.deepEqual(issuesOf({ ...read, emptyRecords: -1 }), [`$.emptyRecords must be a finite integer from 0 to ${Number.MAX_SAFE_INTEGER}`]);
});

// The field key is the only member with any room in it, so its shape is the
// whole boundary. It admits no space, which is what keeps a selector, a page
// value or a model's sentence out of the bundle.
test("a field key admits no space, so no page text, selector or sentence can ride on one", () => {
  assert.equal(isRunExtractionFieldKey("unit_price-2"), true);
  assert.equal(isRunExtractionFieldKey("Ships in 2 days"), false);
  assert.equal(isRunExtractionFieldKey("div.card > span"), false);
  assert.equal(isRunExtractionFieldKey("__proto__"), false);
  assert.equal(isRunExtractionFieldKey("a".repeat(101)), false);
  assert.deepEqual(issuesOf({ ...read, fieldNames: ["name", "Ships in 2 days"] }), ["$.fieldNames[1] must be a record field key of letters, digits, _ and -"]);
  assert.deepEqual(issuesOf({ ...read, fieldNames: ["name", "name"] }), ["$.fieldNames field keys must be unique"]);
  assert.deepEqual(
    issuesOf({ ...read, fieldNames: Array.from({ length: RUN_EXTRACTION_READ_BOUNDS.maxFields + 1 }, (_, index) => `f${index}`) }),
    [`$.fieldNames must hold at most ${RUN_EXTRACTION_READ_BOUNDS.maxFields} field keys`],
  );
});

test("a missing field must be one the read declared, or it names something the request never asked for", () => {
  assert.deepEqual(issuesOf({ ...read, missingFields: ["discount"] }), ["$.missingFields must name only fields the read declared in fieldNames"]);
});

test("a count that is not a count, and a member nothing declared, are both refused", () => {
  assert.deepEqual(issuesOf({ ...read, recordCount: "eight" }), [`$.recordCount must be a finite integer from 0 to ${Number.MAX_SAFE_INTEGER}`]);
  assert.deepEqual(issuesOf({ ...read, pagesRead: -1 }), [`$.pagesRead must be a finite integer from 0 to ${Number.MAX_SAFE_INTEGER}`]);
  assert.deepEqual(issuesOf({ ...read, truncated: "no" }), ["$.truncated must be a boolean"]);
  assert.deepEqual(issuesOf({ ...read, itemSelector: ".product-card" }), ["$.itemSelector unknown property"], "the selector is the one thing this record must never hold");
  assert.deepEqual(issuesOf(null), ["$ must be an object"]);
});

// How a paginated read ended (`run-munnhi5q-4867dabe`: the everything store's
// 429 page mid-pagination, answered as a complete read and unexplained in the bundle).
test("a paginated read says how it ended, in one word from the set, unknown included", () => {
  assert.deepEqual(issuesOf({ ...read, pagesRead: 4, truncated: true, paginationStop: "list_vanished" }), []);
  assert.deepEqual(issuesOf({ ...read, pagesRead: 4, truncated: true, paginationStop: "rate_limited" }), []);
  assert.deepEqual(issuesOf({ ...read, paginationStop: "unknown" }), []);
  assert.ok(contracts.RUN_EXTRACTION_PAGINATION_STOP.includes("control_absent"));
  assert.deepEqual(issuesOf({ ...read, paginationStop: "went for lunch" }).map((issue) => issue.split(" must")[0]), ["$.paginationStop"]);
});
