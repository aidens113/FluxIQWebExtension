// T1 coverage of a list read's `dedupe` and `sort` (`../order-rows.ts`): which
// rows count as one, the order the rest are answered in, what a value that
// cannot be read does, and that the bound is applied last.
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

test("newest first over a column a listing states relative to the read", () => {
  // The case this was built for: run `run-mulwm2dc-0bd95f22` asked the job board
  // for roles "newest first", and a job board says when a role was posted as
  // prose.
  const order = listRowOrderFor({ sort: [{ field: "posted", order: "desc" }] }, FIELDS)!;
  const rows: Row[] = [
    { title: "month", posted: "Posted 30+ days ago" },
    { title: "hours", posted: "5 hours ago" },
    { title: "yesterday", posted: "Yesterday" },
    { title: "week", posted: "a week ago" },
    { title: "just", posted: "Just posted" },
    { title: "days", posted: "3 days ago" }
  ];
  const ordered = order.apply(rows, 100, NOW);
  assert.deepEqual(titles(ordered.rows), ["just", "hours", "yesterday", "days", "week", "month"]);
  assert.equal(ordered.unsortable, 0);
  assert.equal(order.sorts, true);
});

test("absolute dates are read in the forms listings write them, a missing year meaning the latest such date", () => {
  const order = listRowOrderFor({ sort: [{ field: "posted", order: "asc", as: "date" }] }, FIELDS)!;
  const rows: Row[] = [
    { title: "iso", posted: "2026-09-12" },
    { title: "dm", posted: "Posted 3 Sep 2026" },
    { title: "md", posted: "Aug 30, 2026" },
    // No year: September 20 has passed by the read, so it is this year's.
    { title: "noyear", posted: "Sep 20" },
    // And December 1 has not, so it is last year's.
    { title: "lastyear", posted: "Dec 1" },
    { title: "numeric", posted: "25/09/2026" }
  ];
  assert.deepEqual(titles(order.apply(rows, 100, NOW).rows), ["lastyear", "md", "dm", "iso", "noyear", "numeric"]);
});

test("numbers sort by the number a value states, and text sorts as a person reads it", () => {
  const bySalary = listRowOrderFor({ sort: [{ field: "salary", order: "desc" }] }, FIELDS)!;
  const rows: Row[] = [
    { title: "low", salary: "£65,000 to £80,000" },
    { title: "high", salary: "£120,000" },
    { title: "mid", salary: "£95,500.50 a year" }
  ];
  assert.deepEqual(titles(bySalary.apply(rows, 100, NOW).rows), ["high", "mid", "low"]);
  const byTitle = listRowOrderFor({ sort: [{ field: "title", order: "asc", as: "text" }] }, FIELDS)!;
  const named: Row[] = [{ title: "item 10" }, { title: "Item 9" }, { title: "apple" }];
  assert.deepEqual(titles(byTitle.apply(named, 100, NOW).rows), ["apple", "Item 9", "item 10"]);
  // Left to `auto`, the same column is numbers -- two of its three values state
  // one -- which is the contract's rule, and why `as` exists.
  const auto = listRowOrderFor({ sort: [{ field: "title", order: "asc" }] }, FIELDS)!;
  assert.deepEqual(titles(auto.apply(named, 100, NOW).rows), ["Item 9", "item 10", "apple"]);
});

test("auto reads a column as the type most of its values state", () => {
  const order = listRowOrderFor({ sort: [{ field: "salary", order: "asc", as: "auto" }] }, FIELDS)!;
  // Two of three state a number, so the column is numbers and "competitive" is
  // a value that cannot be read as one.
  const rows: Row[] = [{ title: "c", salary: "competitive" }, { title: "b", salary: "90,000" }, { title: "a", salary: "70,000" }];
  const ordered = order.apply(rows, 100, NOW);
  assert.deepEqual(titles(ordered.rows), ["a", "b", "c"]);
  assert.equal(ordered.unsortable, 1);
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

test("ties fall to the next key and then to page order", () => {
  const order = listRowOrderFor({ sort: [{ field: "company", order: "asc" }, { field: "salary", order: "desc" }] }, FIELDS)!;
  const rows: Row[] = [
    { title: "1", company: "B", salary: "10" },
    { title: "2", company: "A", salary: "10" },
    { title: "3", company: "A", salary: "30" },
    { title: "4", company: "B", salary: "10" }
  ];
  assert.deepEqual(titles(order.apply(rows, 100, NOW).rows), ["3", "2", "1", "4"]);
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
});
