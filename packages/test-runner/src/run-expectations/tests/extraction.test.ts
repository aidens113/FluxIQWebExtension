import assert from "node:assert/strict";
import test from "node:test";
import { RunnerFailure } from "../../failure.js";
import { assertExtraction, measureExtraction } from "../extraction.js";

const records = [{ name: "Kettle", price: "$25.00" }, { name: "Lamp", price: "$40.00" }];
const nothingReported = { nonStringValues: 0 };

test("count is exact and records are the complete list in order; both must hold when both are given", () => {
  assert.doesNotThrow(() => assertExtraction([{ step: "read", count: 2, records }], "read", records));
  assert.throws(() => assertExtraction([{ step: "read", count: 3 }], "read", records), /yielded 2 record\(s\), expected 3/);
  assert.throws(() => assertExtraction([{ step: "read", records: records.slice(0, 1) }], "read", records), /expected the 1 listed/);
  assert.throws(() => assertExtraction([{ step: "read", records: [...records].reverse() }], "read", records), /record 0 does not match/);
  assert.throws(() => assertExtraction([{ step: "read", count: 2, records: [records[0]!, { name: "Lamp", price: "$41.00" }] }], "read", records), (error: unknown) => {
    assert.ok(error instanceof RunnerFailure);
    assert.equal(error.details?.index, 1);
    return true;
  });
});

test("a record with a missing or extra field does not match", () => {
  assert.throws(() => assertExtraction([{ step: "read", records: [{ name: "Kettle" }, { name: "Lamp", price: "$40.00" }] }], "read", records), /record 0/);
  assert.throws(() => assertExtraction([{ step: "read", records: [{ name: "Kettle", price: "$25.00", rating: "4" }, records[1]!] }], "read", records), /record 0/);
});

test("an expected null matches only a field present with null, never a missing field or an empty string", () => {
  const withNull = [{ name: "Kettle", price: null }];
  assert.doesNotThrow(() => assertExtraction([{ step: "read", count: 1, records: withNull }], "read", withNull));
  assert.throws(() => assertExtraction([{ step: "read", records: withNull }], "read", [{ name: "Kettle" }]), /record 0/);
  assert.throws(() => assertExtraction([{ step: "read", records: withNull }], "read", [{ name: "Kettle", price: "" }]), /record 0 does not match/);
  assert.throws(() => assertExtraction([{ step: "read", records: [{ name: "Kettle", price: "" }] }], "read", withNull), /record 0 does not match/);
});

test("only entries naming this step apply, and no entries means nothing to assert", () => {
  assert.doesNotThrow(() => assertExtraction([{ step: "other", count: 9 }], "read", records));
  assert.doesNotThrow(() => assertExtraction(undefined, "read", []));
});

test("a field optionalFields names may be absent from either side; one outside it must be present", () => {
  const withRating = [{ name: "Kettle", price: "$25.00", rating: "4" }, { name: "Lamp", price: "$40.00" }];
  assert.doesNotThrow(() => assertExtraction([{ step: "read", records: withRating, optionalFields: ["rating"] }], "read", records));
  assert.doesNotThrow(() => assertExtraction([{ step: "read", records, optionalFields: ["rating"] }], "read", withRating));
  assert.throws(() => assertExtraction([{ step: "read", records: withRating }], "read", records), /record 0 is missing 1 required field\(s\)/);
  assert.throws(() => assertExtraction([{ step: "read", records: withRating, optionalFields: ["price"] }], "read", records), /record 0 is missing 1 required field\(s\)/);
});

test("an optional field is left out of expectedFields, so an item lacking it is still complete", () => {
  const measured = measureExtraction({ step: "read", records: [{ name: "Kettle", price: "$25.00" }], optionalFields: ["price"] }, [{ name: "Kettle" }], nothingReported);
  assert.equal(measured.expectedFields, 1);
  assert.equal(measured.presentFields, 1);
  assert.equal(measured.matchedRecords, 1);
  assert.equal(measured.unexpectedFields, 0);
});

test("a field the expectation names nowhere counts in unexpectedFields and fails", () => {
  const extra = [{ name: "Kettle", price: "$25.00", rating: "4" }, records[1]!];
  assert.equal(measureExtraction({ step: "read", records }, extra, nothingReported).unexpectedFields, 1);
  assert.equal(measureExtraction({ step: "read", records, optionalFields: ["rating"] }, extra, nothingReported).unexpectedFields, 0);
  assert.throws(() => assertExtraction([{ step: "read", records }], "read", extra), /record 0 does not match/);
});

test("records and non-optional fields are measured positionally, and what the step reported is carried through", () => {
  const observed = [{ name: "Kettle", price: "$25.00" }, { name: "Lamp", price: "$41.00" }];
  assert.deepEqual(measureExtraction({ step: "read", records }, observed, { pagesRead: 2, truncated: false, durationMs: 1_200, nonStringValues: 3 }), {
    expectedRecords: 2, observedRecords: 2, matchedRecords: 1,
    expectedFields: 4, presentFields: 4, unexpectedFields: 0,
    pagesFollowed: 2, truncated: false, durationMs: 1_200, nonStringValues: 3,
  });
});

test("a count-only entry names no field, and what the step did not report is null", () => {
  assert.deepEqual(measureExtraction({ step: "read", count: 2 }, records, nothingReported), {
    expectedRecords: 2, observedRecords: 2, matchedRecords: 2,
    expectedFields: 0, presentFields: 0, unexpectedFields: 0,
    pagesFollowed: null, truncated: null, durationMs: null, nonStringValues: 0,
  });
  assert.equal(measureExtraction({ step: "read", count: 3 }, records, nothingReported).matchedRecords, 2);
});

test("a step that ran with no expectation expected nothing", () => {
  const measured = measureExtraction(undefined, records, nothingReported);
  assert.equal(measured.expectedRecords, 0);
  assert.equal(measured.matchedRecords, 0);
  assert.equal(measured.observedRecords, 2);
  assert.equal(measured.unexpectedFields, 0);
});

test("pages is asserted against the pages the step read, and refused when nothing read them", () => {
  assert.doesNotThrow(() => assertExtraction([{ step: "read", pages: 3 }], "read", records, { pagesRead: 3, nonStringValues: 0 }));
  assert.throws(() => assertExtraction([{ step: "read", pages: 3 }], "read", records, { pagesRead: 2, nonStringValues: 0 }), /read 2 page\(s\), expected 3/);
  assert.throws(() => assertExtraction([{ step: "read", pages: 3 }], "read", records), /declares pages, which nothing reported/);
});

test("an expectation nothing can judge is refused as fixture.invalid, naming the entry and every unjudgeable field", () => {
  // The count is right and the records match: without the refusal this entry reads as a pass while `pages` is checked by nothing.
  assert.throws(() => assertExtraction([{ step: "read", count: 2, records, pages: 3 }], "read", records), (error: unknown) => {
    assert.ok(error instanceof RunnerFailure);
    assert.equal(error.category, "fixture.invalid", "the facility could not judge the entry; the automation did not misbehave");
    assert.match(error.message, /^Extract step read declares pages, which nothing reported for this run, so the expectation cannot be judged$/);
    assert.deepEqual(error.details, { stepId: "read", unjudgeableFields: ["pages"], expectedPages: 3 });
    return true;
  });
  // Both fields at once are named in one failure, and a half-observation still refuses the half nothing reported.
  assert.throws(() => assertExtraction([{ step: "read", pages: 3, truncated: true }], "read", records), (error: unknown) => {
    assert.ok(error instanceof RunnerFailure);
    assert.deepEqual((error.details as { unjudgeableFields: string[] }).unjudgeableFields, ["pages", "truncated"]);
    assert.match(error.message, /declares pages and truncated, which nothing reported/);
    return true;
  });
  assert.throws(() => assertExtraction([{ step: "read", pages: 3, truncated: true }], "read", records, { pagesRead: 3, nonStringValues: 0 }), /declares truncated, which nothing reported/);
  // An entry declaring neither field is judgeable in full, and an entry naming another step is not this step's to judge.
  assert.doesNotThrow(() => assertExtraction([{ step: "read", count: 2, records }], "read", records));
  assert.doesNotThrow(() => assertExtraction([{ step: "other", pages: 3 }], "read", records));
});

test("the refused entry passes unchanged once observed supplies what it declares", () => {
  const entry = { step: "read", count: 2, records, pages: 3, truncated: false };
  assert.throws(() => assertExtraction([entry], "read", records), /cannot be judged/);
  assert.doesNotThrow(() => assertExtraction([entry], "read", records, { pagesRead: 3, truncated: false, nonStringValues: 0 }));
  // Supplying the observation judges it rather than waving it through: a wrong value now fails on its own terms.
  assert.throws(() => assertExtraction([entry], "read", records, { pagesRead: 2, truncated: false, nonStringValues: 0 }), /read 2 page\(s\), expected 3/);
});

test("truncated is asserted against what the step reported, and refused when nothing reported it", () => {
  assert.doesNotThrow(() => assertExtraction([{ step: "read", truncated: true }], "read", records, { truncated: true, nonStringValues: 0 }));
  assert.throws(() => assertExtraction([{ step: "read", truncated: true }], "read", records, { truncated: false, nonStringValues: 0 }), /reported truncated=false, expected true/);
  assert.throws(() => assertExtraction([{ step: "read", truncated: false }], "read", records, { truncated: true, nonStringValues: 0 }), /reported truncated=true, expected false/);
  assert.throws(() => assertExtraction([{ step: "read", truncated: true }], "read", records), /declares truncated, which nothing reported/);
});
