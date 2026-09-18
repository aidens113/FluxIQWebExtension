import assert from "node:assert/strict";
import test from "node:test";
import { extractionMismatchReport, extractionStepMismatches, type ExtractionStepMismatches } from "../mismatches.js";
import { measureExtraction, type ExtractionRecord } from "../judgement.js";

const nothingReported = { nonStringValues: 0 };
const company = (name: string, location: string, employees: string | null): ExtractionRecord => ({ name, sector: "Logistics", location, employees });
const abbeyfield = company("Abbeyfield Logistics", "Framlingham, Suffolk", "201–500");
const alderworth = company("Alderworth Logistics", "Ludlow, Shropshire", "501–1,000");
const garrowby = company("Garrowby Logistics", "Harrogate, North Yorkshire", null);

/** The expectation's records first, then what the run read: the order the artifact states them in. */
const detail = (expected: ExtractionRecord[], observed: ExtractionRecord[], overrides: { optionalFields?: string[]; disclosure?: "fixture-page" | "scenario-declares-secrets" } = {}): ExtractionStepMismatches => {
  const step = extractionStepMismatches({
    stepIndex: 2, stepId: "extract-sector-companies",
    entry: { step: "extract-sector-companies", records: expected, ...(overrides.optionalFields ? { optionalFields: overrides.optionalFields } : {}) },
    records: observed, disclosure: overrides.disclosure ?? "fixture-page",
  });
  assert.ok(step, "expected a mismatch to detail");
  return step;
};

test("the same records in a different order are reported as moved, not as wrong values", () => {
  // The question `matchedRecords` alone could never answer: 40 companies read
  // correctly and rearranged score exactly as 40 read wrongly.
  const expected = [abbeyfield, alderworth, garrowby];
  const step = detail(expected, [alderworth, garrowby, abbeyfield]);
  assert.equal(step.matchedRecords, 0);
  assert.equal(step.matchedInAnyOrder, 3);
  assert.equal(step.orderOnly, true);
  assert.deepEqual(step.records.map((record) => [record.position, record.kind, record.observedAtPosition]), [[0, "moved", 2], [1, "moved", 0], [2, "moved", 1]]);
  for (const record of step.records) assert.deepEqual(record.fields, [], "a moved record differs in no field");
});

test("a value difference names the record, the field, and what each side held", () => {
  const step = detail([abbeyfield, alderworth], [abbeyfield, { ...alderworth, location: "Ludlow, Salop" }]);
  assert.equal(step.orderOnly, false, "a changed value is not an arrangement");
  assert.equal(step.matchedInAnyOrder, 1);
  assert.deepEqual(step.records.map((record) => record.position), [1]);
  assert.deepEqual(step.records[0]?.fields, [{
    field: "location",
    expected: { held: "text", characters: 18, value: "Ludlow, Shropshire" },
    observed: { held: "text", characters: 13, value: "Ludlow, Salop" },
  }]);
});

test("an expected null against an empty cell is stated as the two different things it is", () => {
  // `company-directory`: a company that filed no headcount renders an empty
  // cell, and a read of the cell rather than of the element inside it returns
  // "" where the fixture expects no value at all (D16). The counts made that
  // indistinguishable from a wrong headcount.
  const step = detail([garrowby], [{ ...garrowby, employees: "" }]);
  assert.deepEqual(step.records[0]?.fields, [{
    field: "employees",
    expected: { held: "null" },
    observed: { held: "text", characters: 0, value: "" },
  }]);
  // And a field the record never carried is a third answer, not the same one.
  const absent = detail([garrowby], [{ name: garrowby.name!, sector: garrowby.sector!, location: garrowby.location! }]);
  assert.deepEqual(absent.records[0]?.fields, [{ field: "employees", expected: { held: "null" }, observed: { held: "absent" } }]);
});

test("a field the expectation names nowhere is counted and never named", () => {
  // The one place a page can put something no fixture author chose, so the one
  // place a published value could be something nobody meant to publish.
  const step = detail([abbeyfield], [{ ...abbeyfield, unlockCode: "PLANTED-UNLOCK-CODE-DO-NOT-EXTRACT-4242" }]);
  assert.equal(step.records[0]?.unexpectedFields, 1);
  assert.deepEqual(step.records[0]?.fields, [], "no named field differs, so no value is published");
  assert.equal(JSON.stringify(step).includes("unlockCode"), false, "the field name never leaves");
  assert.equal(JSON.stringify(step).includes("PLANTED"), false, "nor its value");
});

test("a scenario that declares replay secrets withholds every observed value and says so", () => {
  const step = detail([abbeyfield, alderworth], [abbeyfield, { ...alderworth, location: "Ludlow, Salop" }], { disclosure: "scenario-declares-secrets" });
  const field = step.records.flatMap((record) => record.fields).find((entry) => entry.field === "location");
  // Withheld, not omitted: the length still separates a read that returned
  // something from one that returned nothing.
  assert.deepEqual(field?.observed, { held: "withheld", characters: 13, rule: "scenario-declares-secrets" });
  // The expectation's own side is the fixture's authored text and still shows.
  assert.deepEqual(field?.expected, { held: "text", characters: 18, value: "Ludlow, Shropshire" });
  assert.equal(JSON.stringify(step).includes("Salop"), false);
});

test("the detail is bounded, and states how many it did not detail", () => {
  const expected = Array.from({ length: 60 }, (_unused, index) => company(`Company ${index}`, "Wells, Somerset", null));
  const observed = expected.map((record) => ({ ...record, location: "Somewhere else" }));
  const step = detail(expected, observed);
  assert.equal(step.mismatchedRecords, 60);
  assert.equal(step.detailedRecords, 25);
  assert.equal(step.records.length, 25);
});

test("a published value is cut at the cap and says that it was", () => {
  const long = "x".repeat(400);
  const step = detail([{ name: "short" }], [{ name: long }]);
  const value = step.records[0]?.fields[0]?.observed;
  assert.equal(value?.held, "text");
  assert.equal(value?.held === "text" && value.characters, 400, "the true length is stated");
  assert.equal(value?.held === "text" && value.value.length, 200);
  assert.equal(value?.held === "text" && value.cut, true);
});

test("a step whose records all matched, and a step with no records to compare, detail nothing", () => {
  const entry = { step: "read", records: [abbeyfield] };
  assert.equal(extractionStepMismatches({ stepIndex: 0, stepId: "read", entry, records: [abbeyfield], disclosure: "fixture-page" }), undefined);
  // A count-only expectation compared no value, so it has no mismatch to show.
  assert.equal(extractionStepMismatches({ stepIndex: 0, stepId: "read", entry: { step: "read", count: 3 }, records: [abbeyfield], disclosure: "fixture-page" }), undefined);
  assert.equal(extractionStepMismatches({ stepIndex: 0, stepId: "read", entry: undefined, records: [abbeyfield], disclosure: "fixture-page" }), undefined);
  assert.deepEqual(extractionMismatchReport([undefined, undefined]).steps, []);
});

test("a step that read nothing states the counts and details no record", () => {
  const step = extractionStepMismatches({ stepIndex: 2, stepId: "read", entry: { step: "read", records: [abbeyfield, alderworth] }, records: [], disclosure: "fixture-page" });
  assert.equal(step?.mismatchedRecords, 2);
  assert.equal(step?.detailedRecords, 0);
  assert.equal(step?.observedRecords, 0);
});

test("the measurement states what matched in any order and what it never judged", () => {
  const expected = [abbeyfield, alderworth];
  const reversed = measureExtraction({ step: "read", records: expected, pages: 3 }, [alderworth, abbeyfield], nothingReported);
  assert.equal(reversed.matchedRecords, 0);
  assert.equal(reversed.matchedInAnyOrder, 2, "both records are there; only their positions moved");
  // The expectation declared pages and this run reported none, so it was
  // declared and not judged rather than quietly met.
  assert.deepEqual(reversed.unjudged, ["pages"]);
  const judged = measureExtraction({ step: "read", records: expected, pages: 3 }, expected, { ...nothingReported, pagesRead: 3 });
  assert.deepEqual(judged.unjudged, []);
  assert.equal(judged.matchedInAnyOrder, 2);
  // A step with no expectation judged nothing and declares nothing unjudged.
  assert.deepEqual(measureExtraction(undefined, expected, nothingReported).unjudged, []);
  // An expectation holding a value twice cannot match it twice: one observed
  // record answers one expected record.
  const twice = measureExtraction({ step: "read", records: [abbeyfield, abbeyfield] }, [abbeyfield, alderworth], nothingReported);
  assert.equal(twice.matchedInAnyOrder, 1);
});

test("the report states the policy every reader needs to know the values were bounded by", () => {
  const report = extractionMismatchReport([detail([abbeyfield], [alderworth])]);
  assert.equal(report.schemaVersion, "0.1");
  assert.equal(report.policy.maxRecordsPerStep, 25);
  assert.equal(report.policy.maxFieldsPerRecord, 12);
  assert.equal(report.policy.maxValueCharacters, 200);
  assert.equal(report.policy.boundary.length > 0, true);
  assert.equal(report.steps.length, 1);
  assert.equal(report.steps[0]?.disclosure, "fixture-page");
});
