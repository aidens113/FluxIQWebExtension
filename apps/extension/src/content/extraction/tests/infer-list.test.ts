// T1 coverage of the one rule that decides a level is not the record: a table
// cell is a column of a record, never the record itself, which is what makes
// picking a price cell propose the table's rows rather than its four columns.
// The walk itself needs a document and is proven by
// `e2e/content/tests/extraction/inference.spec.ts`.

import assert from "node:assert/strict";
import test from "node:test";
import { isRecordItemTag } from "../infer-list";

test("a table cell is never a record: it is a column of one", () => {
  for (const tagName of ["TD", "TH", "td", "th"]) assert.equal(isRecordItemTag(tagName), false, tagName);
});

test("everything a page repeats a record with can be one", () => {
  for (const tagName of ["LI", "TR", "ARTICLE", "DIV", "SECTION", "tr"]) assert.equal(isRecordItemTag(tagName), true, tagName);
});
