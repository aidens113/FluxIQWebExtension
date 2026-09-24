// Which conditions reject an item, rather than whether any did (C5).
//
// A read that kept nothing has to be able to say which condition emptied it, or
// a repair is guessing among however many the model wrote. So the filter answers
// with the positions of the conditions that rejected the item, every condition
// is asked, and none short-circuits the rest -- otherwise each count would
// depend on the order they happened to be written in.
//
// Conditions naming a `field` test a value the record already carries, so these
// rows need no document. A condition with its own `read` selector does, and is
// covered on real fixtures by
// `e2e/content/tests/extraction/tests/item-conditions.spec.ts`.

import assert from "node:assert/strict";
import test from "node:test";
import { itemFilterFor } from "../item-filter";

/** Never touched: every condition here names a field of the record. */
const ITEM = {} as Element;

const FIELDS = { name: ".name", price: ".price", badge: ".badge" };

function rejections(where: Parameters<typeof itemFilterFor>[0]["where"], record: Record<string, string | null>): readonly number[] {
  const rejects = itemFilterFor({ item: ".card", fields: FIELDS, where });
  assert.notEqual(rejects, undefined, "a request with conditions has a filter");
  return rejects!(ITEM, record);
}

test("no conditions is no filter at all, whether the clause is absent or empty", () => {
  // Filtering is optional in every sense: a request that says nothing about it
  // gets no filter, and neither an absent clause nor an empty one is a filter
  // that keeps nothing.
  assert.equal(itemFilterFor({ item: ".card", fields: FIELDS }), undefined);
  assert.equal(itemFilterFor({ item: ".card", fields: FIELDS, where: [] }), undefined);
});

test("an item every condition holds of is rejected by none", () => {
  const kept = rejections(
    [{ field: "badge", is: "absent" }, { field: "price", lessThan: 50 }, { field: "name", contains: "case", not: true }],
    { name: "Acme Earbuds", price: "$39.00" }
  );
  assert.deepEqual([...kept], []);
});

test("the conditions that rejected an item are named by their position in where", () => {
  const where = [
    { field: "badge", is: "absent" as const },
    { field: "price", lessThan: 50 },
    { field: "name", contains: "case", not: true }
  ];
  // The sponsored badge alone.
  assert.deepEqual([...rejections(where, { name: "Acme Earbuds", price: "$39.00", badge: "Sponsored" })], [0]);
  // The price alone.
  assert.deepEqual([...rejections(where, { name: "Acme Earbuds", price: "$79.00" })], [1]);
  // The accessory alone.
  assert.deepEqual([...rejections(where, { name: "Acme Charging Case", price: "$19.00" })], [2]);
  // Every condition is asked, so an item that fails several is reported as
  // failing several rather than as failing the first one checked.
  assert.deepEqual([...rejections(where, { name: "Acme Charging Case", price: "$79.00", badge: "Sponsored" })], [0, 1, 2]);
});

test("a comparison against a value the page did not state rejects the item, which is how a filter empties a list", () => {
  // The shape of the 2026-09-24 failure: the column resolved, the page had no
  // number in it, and every row failed. The filter says so per condition, which
  // is what lets the read report which one emptied it rather than only that it
  // is empty.
  const where = [{ field: "price", lessThan: 50 }];
  assert.deepEqual([...rejections(where, { name: "Acme Earbuds", price: "Currently unavailable" })], [0]);
  assert.deepEqual([...rejections(where, { name: "Acme Earbuds", price: null })], [0]);
  // And an expression that compiles and matches nothing does the same.
  assert.deepEqual([...rejections([{ field: "name", matches: "^Zeta" }], { name: "Acme Earbuds" })], [0]);
});

test("a condition over a column the request does not read refuses the read rather than emptying it", () => {
  // A named refusal reaches the model as a code it can repair from, before
  // anything on the page is read. Silently rejecting every row would not.
  assert.throws(() => itemFilterFor({ item: ".card", fields: FIELDS, where: [{ field: "rating", atLeast: 4 }] }), /does not read/u);
  assert.throws(
    () => itemFilterFor({ item: ".card", fields: { name: ".name", badge: { kind: "text", selector: ".badge", handling: "exclude" } }, where: [{ field: "badge", is: "absent" }] }),
    /excluded/u
  );
});
