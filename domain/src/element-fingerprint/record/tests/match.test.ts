import assert from "node:assert/strict";
import test from "node:test";
import { webRecordedRecordMatches } from "..";

test("a stable record key outranks changed text and requires its original attribute", () => {
  const saved = { key: "sheet-A", keyAttribute: "data-sheet-id", text: "Waiting" };
  assert.equal(webRecordedRecordMatches(saved, { ...saved, text: "Ready" }), true);
  assert.equal(webRecordedRecordMatches(saved, { ...saved, key: "sheet-a" }), false);
  assert.equal(webRecordedRecordMatches(saved, { ...saved, keyAttribute: "data-other-id" }), false);
  assert.equal(webRecordedRecordMatches(saved, { text: "Waiting" }), false);
  assert.equal(webRecordedRecordMatches(saved, undefined), false);
  assert.equal(webRecordedRecordMatches({ key: "sheet-A" }, saved), true, "legacy bare-key behavior remains");
});

test("text-only drift, missing provenance and pass-row values do not identify a record", () => {
  assert.equal(webRecordedRecordMatches({ text: "Sheet A" }, { text: "sheet  a" }), true);
  assert.equal(webRecordedRecordMatches({ text: "Sheet A" }, { text: "Sheet B" }), false);
  assert.equal(webRecordedRecordMatches({}, { text: "Sheet A" }), false);
  assert.equal(webRecordedRecordMatches({ values: ["Sheet A"] }, { text: "Sheet A" }), false);
  assert.equal(webRecordedRecordMatches(undefined, undefined), true);
});
