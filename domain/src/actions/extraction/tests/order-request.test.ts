// How a list request's `dedupe` and `sort` are read off an untrusted value
// (`../order-request.ts`).
//
// Both are written by a model, on a first attempt, in whatever shape the
// instruction's words suggested -- live run `run-mulwm2dc-0bd95f22` asked for
// job-board roles "deduplicated, newest first" -- so both are read forgivingly
// and resolved against the request's own columns. What is refused is only what
// says nothing: a value that is not a dedupe at all, and a sort key naming no
// column the read reads.

import assert from "node:assert/strict";
import test from "node:test";
import { webAutomationExtractListDedupeValue, webAutomationExtractListSortValue } from "../order-request";
import { WEB_AUTOMATION_EXTRACT_MAX_SORT_KEYS } from "../request";

const FIELDS = { title: ".title", company: ".company", posted: ".posted", salary: ".salary", url: "a@href" };

test("every spelling of a dedupe says which columns identify a row", () => {
  for (const [written, by] of [
    ["url", ["url"]],
    ["title, company", ["title", "company"]],
    ["title and company", ["title", "company"]],
    [["title", "company"], ["title", "company"]],
    [{ by: "title" }, ["title"]],
    [{ columns: ["company", "title"] }, ["company", "title"]],
    [["Title"], ["title"]]
  ] as const) {
    assert.deepEqual(webAutomationExtractListDedupeValue(written, FIELDS), { dedupe: { by: [...by] }, refused: false }, JSON.stringify(written));
  }
});

test("a dedupe that says only 'each once' keys on the list's link column, or every column when it reads none", () => {
  for (const written of [true, "yes", "unique", {}, [true]]) {
    assert.deepEqual(webAutomationExtractListDedupeValue(written, FIELDS), { dedupe: { by: ["url"] }, refused: false }, JSON.stringify(written));
  }
  assert.deepEqual(
    webAutomationExtractListDedupeValue(true, { title: ".title", company: ".company" }),
    { dedupe: { by: ["title", "company"] }, refused: false }
  );
});

test("an off dedupe is no dedupe, and only a value that is not a dedupe at all is refused", () => {
  for (const off of [false, null, "no", "none", []]) {
    assert.deepEqual(webAutomationExtractListDedupeValue(off, FIELDS), { refused: false }, JSON.stringify(off));
  }
  for (const nonsense of [7, { colour: "red" }]) {
    assert.deepEqual(webAutomationExtractListDedupeValue(nonsense, FIELDS), { refused: true }, JSON.stringify(nonsense));
  }
});

test("every spelling of a sort says a column, a direction, and optionally a type", () => {
  for (const [written, sort] of [
    ["posted desc", [{ field: "posted", order: "desc" }]],
    ["-salary", [{ field: "salary", order: "desc" }]],
    ["salary:desc", [{ field: "salary", order: "desc" }]],
    ["posted newest", [{ field: "posted", order: "desc" }]],
    ["salary desc number", [{ field: "salary", order: "desc", as: "number" }]],
    [{ salary: "asc" }, [{ field: "salary", order: "asc" }]],
    [{ salary: -1 }, [{ field: "salary", order: "desc" }]],
    [[{ field: "posted", order: "desc", as: "date" }], [{ field: "posted", order: "desc", as: "date" }]],
    ["posted desc, title", [{ field: "posted", order: "desc" }, { field: "title", order: "asc" }]],
    ["posted desc then salary desc", [{ field: "posted", order: "desc" }, { field: "salary", order: "desc" }]],
    [["Posted desc"], [{ field: "posted", order: "desc" }]]
  ] as const) {
    assert.deepEqual(webAutomationExtractListSortValue(written, FIELDS), { sort: sort.map((key) => ({ ...key })), refused: [] }, JSON.stringify(written));
  }
});

test("a sort key that cannot be read is dropped by position, and the keys beside it still sort", () => {
  // A direction naming no column, a key twice, and a type word nothing reads.
  assert.deepEqual(webAutomationExtractListSortValue(["newest", "posted desc", "posted asc", "salary desc weird"], FIELDS), {
    sort: [{ field: "posted", order: "desc" }],
    refused: [0, 2, 3]
  });
  assert.deepEqual(webAutomationExtractListSortValue(42, FIELDS), { sort: [], refused: [0] });
  assert.deepEqual(webAutomationExtractListSortValue([], FIELDS), { sort: [], refused: [] });
});

test("a sort compares by at most the bounded number of keys", () => {
  const keys = ["title", "company", "posted", "salary", "url"];
  const read = webAutomationExtractListSortValue(keys, FIELDS);
  assert.equal(read.sort.length, WEB_AUTOMATION_EXTRACT_MAX_SORT_KEYS);
  assert.deepEqual(read.refused, [WEB_AUTOMATION_EXTRACT_MAX_SORT_KEYS]);
});
