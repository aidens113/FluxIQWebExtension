// T1 coverage of a list read's `dedupe` and `sort` (`../order-rows.ts`): the
// binding of a request to the columns the read reads, what the read reports
// (duplicates, unsortable rows, the cut) and that the bound is applied last.
// How values are read, compared and identified is Core's
// (`automationStudioRecordRowIdentity`, `sortAutomationStudioRecordRows`,
// `countAutomationStudioRecordUnsortableRows`) and is pinned by Core's tests:
// relative dates, numbers and their magnitudes, collation, `auto` and ties.
//
// The rows are records as the list reader builds them -- each field's text, or
// `null` for one the page had nothing for -- so nothing here needs a page.

import assert from "node:assert/strict";
import test from "node:test";
import { listRowOrderFor } from "../order-rows";

type Row = Record<string, string | null>;

const FIELDS = ["title", "company", "posted", "salary", "url"];
/** One instant every relative date in these rows is measured from: 2026-09-28T12:00:00Z. */
const NOW = Date.UTC(2026, 8, 28, 12);

function titles(rows: readonly Row[]): (string | null)[] {
  return rows.map((row) => row.title ?? null);
}

test("a request that names neither dedupe nor sort orders nothing", () => {
  assert.equal(listRowOrderFor({}, FIELDS), undefined);
  // Nor one whose only columns are ones the read does not read: the domain's
  // reader resolved those away already, and the page does not guess again.
  assert.equal(listRowOrderFor({ sort: [{ field: "rating", order: "desc" }] }, FIELDS), undefined);
});

test("dedupe keeps the first row of each identity, with layout and case ignored, and counts the rest", () => {
  const order = listRowOrderFor({ dedupe: { by: ["title", "company"] } }, FIELDS)!;
  const rows: Row[] = [
    { title: "Rust Engineer", company: "Acme", url: "/a" },
    { title: "Rust  engineer ", company: "ACME", url: "/b" },
    { title: "Rust Engineer", company: "Globex", url: "/c" },
    { title: "Go Engineer", company: "Acme", url: "/d" }
  ];
  const ordered = order.apply(rows, 100, NOW);
  assert.deepEqual(ordered.rows.map((row) => row.url), ["/a", "/c", "/d"]);
  assert.equal(ordered.duplicates, 1);
  assert.equal(ordered.cut, false);
  assert.equal(order.sorts, false);
});

test("a row with none of the dedupe values is never a duplicate", () => {
  // Folding every row that lacks a link into one would drop rows that differ in
  // everything else, which is a narrower answer nobody asked for.
  const order = listRowOrderFor({ dedupe: { by: ["url"] } }, FIELDS)!;
  const rows: Row[] = [{ title: "A", url: null }, { title: "B", url: null }, { title: "C" }, { title: "D", url: "/x" }, { title: "E", url: "/x" }];
  const ordered = order.apply(rows, 100, NOW);
  assert.deepEqual(titles(ordered.rows), ["A", "B", "C", "D"]);
  assert.equal(ordered.duplicates, 1);
  assert.equal(order.identity({ title: "A", url: null }), undefined);
});

test("a dedupe whose every column the read does not read falls back to the whole row", () => {
  const order = listRowOrderFor({ dedupe: { by: ["rating"] } }, ["title", "url"])!;
  const ordered = order.apply([{ title: "A", url: "/a" }, { title: "A", url: "/a" }, { title: "A", url: "/b" }], 100, NOW);
  assert.deepEqual(ordered.rows.map((row) => row.url), ["/a", "/b"]);
  assert.equal(ordered.duplicates, 1);
});

test("absolute dates are read in the forms listings write them, a missing year meaning the nearest such date", () => {
  const order = listRowOrderFor({ sort: [{ field: "posted", order: "asc", as: "date" }] }, FIELDS)!;
  const rows: Row[] = [
    { title: "iso", posted: "2026-09-12" },
    { title: "dm", posted: "Posted 3 Sep 2026" },
    { title: "md", posted: "Aug 30, 2026" },
    // No year: the occurrence nearest the read, within six months either way
    // (Core's rule, t510). September 20 is this year's, just past.
    { title: "noyear", posted: "Sep 20" },
    // And December 1 is this year's too, two months ahead, not last year's.
    { title: "nextdec", posted: "Dec 1" },
    { title: "numeric", posted: "25/09/2026" }
  ];
  assert.deepEqual(titles(order.apply(rows, 100, NOW).rows), ["md", "dm", "iso", "noyear", "numeric", "nextdec"]);
});

test("a value that cannot be read goes last whichever the direction, and is counted", () => {
  const rows: Row[] = [
    { title: "none", posted: null },
    { title: "old", posted: "2026-01-01" },
    { title: "prose", posted: "Apply today" },
    { title: "new", posted: "2026-09-01" },
    { title: "absent" }
  ];
  for (const [direction, expected] of [["desc", ["new", "old"]], ["asc", ["old", "new"]]] as const) {
    const order = listRowOrderFor({ sort: [{ field: "posted", order: direction, as: "date" }] }, FIELDS)!;
    const ordered = order.apply(rows, 100, NOW);
    // Readable rows in the key's order, then the three it could not read, in page order.
    assert.deepEqual(titles(ordered.rows), [...expected, "none", "prose", "absent"], direction);
    assert.equal(ordered.unsortable, 3);
  }
});

test("dedupe, then sort, then the bound: the answer is the first rows of the sorted distinct rows", () => {
  const order = listRowOrderFor({ dedupe: { by: ["url"] }, sort: [{ field: "salary", order: "desc" }] }, FIELDS)!;
  const rows: Row[] = [
    { title: "a", salary: "10", url: "/a" },
    { title: "b", salary: "50", url: "/b" },
    // A repeat of /a that would sort first if it were kept.
    { title: "a-again", salary: "99", url: "/a" },
    { title: "c", salary: "40", url: "/c" }
  ];
  const ordered = order.apply(rows, 2, NOW);
  assert.deepEqual(titles(ordered.rows), ["b", "c"]);
  assert.equal(ordered.duplicates, 1);
  assert.equal(ordered.cut, true);
  assert.equal(order.sorts, true);
});

// Photo note (rerun 3): a list's only date sat inside an image's alt text, a
// sentence around it, and a sort `as: "date"` must still read it.
test("a date inside prose is read by its first full date, as an image's alt text states one", () => {
  const order = listRowOrderFor({ sort: [{ field: "posted", order: "desc", as: "date" }] }, FIELDS)!;
  const rows: Row[] = [
    { title: "oct2", posted: "Picture by A. Baker on October 2, 2026. May show a bowl." },
    { title: "sep14", posted: "Picture by C. Doyle on September 14, 2026. May show a jar of 3 spoons." },
    { title: "oct9", posted: "Picture by E. Fenn on 9 October 2026, edited on 1 January 2026. May show a loaf." },
    { title: "iso", posted: "Uploaded 2026-09-30 by G. Hale." }
  ];
  const ordered = order.apply(rows, 100, NOW);
  assert.deepEqual(titles(ordered.rows), ["oct9", "oct2", "iso", "sep14"]);
  assert.equal(ordered.unsortable, 0);
});
