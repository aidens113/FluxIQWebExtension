// A tier-2 answer compared with a read's live result on what the page
// decided: status, failure code, records one by one with their cell counts,
// a single value, and the extraction summary's counts. Timings, ids and
// addresses never count, and nothing compared is copied into the comparison.

import assert from "node:assert/strict";
import test from "node:test";
import { compareReadAnswer } from "../answer-comparison.js";

const live = (payload: Record<string, unknown>, rest: Record<string, unknown> = {}) => ({ commandId: "live-1", status: "succeeded", startedAt: 1, completedAt: 2, payload: { sourceId: "tab:1", ...payload }, ...rest });
const summary = { recordCount: 2, pagesRead: 1, itemsSeen: 3, emptyRecords: 0 };

test("equal records, status and summary are equal whatever the timings, ids and source", () => {
  const records = [{ name: "a", when: "b" }, { name: "c", when: "d" }];
  const answer = { commandId: "offline-9", status: "succeeded", startedAt: 50, completedAt: 90, payload: { extracted: records.map((record) => ({ when: record.when, name: record.name })), extraction: summary } };
  const comparison = compareReadAnswer(answer, live({ extracted: records, extraction: summary }));
  assert.equal(comparison.equal, true);
  assert.deepEqual(comparison.rows, { live: 2, answer: 2, equalPositions: 2, cellCountsEqual: 2, cellsLive: 4, cellsAnswer: 4, firstDifference: null, differingFields: [] });
  assert.equal(comparison.value, null);
  assert.deepEqual(comparison.summary, { equal: true, differing: [] });
});

test("a differing record is counted by position and field name, never by value", () => {
  const answer = live({ extracted: [{ name: "a", when: "b" }, { name: "SECRET", when: "d", extra: "e" }], extraction: { ...summary, itemsSeen: 4 } });
  const comparison = compareReadAnswer(answer, live({ extracted: [{ name: "a", when: "b" }, { name: "c", when: "d" }, { name: "f", when: "g" }], extraction: summary }));
  assert.equal(comparison.equal, false);
  assert.deepEqual(comparison.rows, { live: 3, answer: 2, equalPositions: 1, cellCountsEqual: 1, cellsLive: 6, cellsAnswer: 5, firstDifference: 1, differingFields: ["extra", "name"] });
  assert.deepEqual(comparison.summary, { equal: false, differing: ["itemsSeen"] });
  assert.doesNotMatch(JSON.stringify(comparison), /SECRET/u);
});

test("status and failure code are compared, a missing failure on both sides counts as equal", () => {
  const failed = { status: "failed", failure: { code: "web.validation.output_not_observed", stage: "validation" } };
  const comparison = compareReadAnswer(live({ extracted: [] }, failed), live({ extracted: [] }, { status: "failed", failure: { code: "web.target.not_found" } }));
  assert.deepEqual([comparison.status.equal, comparison.failureCode], [true, { live: "web.target.not_found", answer: "web.validation.output_not_observed", equal: false }]);
  assert.equal(comparison.equal, false);
  const both = compareReadAnswer(live({ extracted: [] }), live({ extracted: [] }, { status: "failed" }));
  assert.deepEqual([both.status, both.failureCode.equal, both.equal], [{ live: "failed", answer: "succeeded", equal: false }, true, false]);
});

test("a single extracted value is compared by value and reported by kind only", () => {
  assert.deepEqual(compareReadAnswer(live({ extracted: "SECRET" }), live({ extracted: "SECRET" })).value, { live: "string", answer: "string", equal: true });
  const differs = compareReadAnswer(live({ extracted: "SECRET" }), live({ extracted: "other" }));
  assert.deepEqual([differs.value, differs.rows, differs.equal], [{ live: "string", answer: "string", equal: false }, null, false]);
  assert.doesNotMatch(JSON.stringify(differs), /SECRET|other/u);
});

test("a summary on one side only, or a list against no list, is a difference", () => {
  assert.deepEqual(compareReadAnswer(live({ extracted: [] }), live({ extracted: [], extraction: summary })).summary, { equal: false, differing: ["recordCount", "pagesRead", "itemsSeen", "emptyRecords"] });
  const listAgainstNone = compareReadAnswer(live({ extracted: [{ a: "b" }] }), live({}));
  assert.deepEqual([listAgainstNone.rows?.live, listAgainstNone.rows?.answer, listAgainstNone.value, listAgainstNone.equal], [null, 1, { live: "absent", answer: "list", equal: false }, false]);
});
