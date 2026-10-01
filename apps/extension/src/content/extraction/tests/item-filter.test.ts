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
import { extractList } from "../list-reader";
import type { ExtractionCheckpoint } from "../../../shared/extraction-continuation";
import type { WebAutomationExtractListRequest } from "../../types";

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

// What a condition's own read found (`seen`), so a condition described without
// its locator is still recognisable. Live run `run-munw7ffn-fe1cecd2` filtered on
// the aria-label of the store's Brightaisle Plus icon; its judge was told only
// `attribute aria-label is present` and advised adding a Plus condition.

/** Items that answer `getAttribute` (`aria-label`, and `data-*` from `values`), under `.row`, with a `.more` control whose click adds `more`. */
function fakePage(rows: Array<Record<string, string>>, more: Array<Record<string, string>> = []): { restore(): void } {
  const saved = { document: globalThis.document, element: globalThis.HTMLElement, input: globalThis.HTMLInputElement };
  const row = (values: Record<string, string>) => ({
    getAttribute: (name: string) => (name === "aria-label" ? values.label ?? null : name.startsWith("data-") ? values[name.slice(5)] ?? null : null),
    parentElement: null
  }) as unknown as Element;
  const shown = rows.map(row);
  class FakeElement {}
  const globals = globalThis as Record<string, unknown>;
  globals.HTMLElement = FakeElement;
  globals.HTMLInputElement = class {};
  const button = Object.assign(new FakeElement(), { matches: () => false, getAttribute: () => null, isConnected: true, click: () => { shown.push(...more.splice(0).map(row)); } });
  globals.document = { readyState: "complete", querySelectorAll: (selector: string) => (selector === ".row" ? shown : []), querySelector: (selector: string) => (selector === ".more" ? button : null) };
  return { restore: () => Object.assign(globals, { document: saved.document, HTMLElement: saved.element, HTMLInputElement: saved.input }) };
}

/** Plus members under $50: the Plus condition reads the icon's accessible name, the price condition names a column. */
const PLUS: WebAutomationExtractListRequest = {
  item: ".row",
  fields: { name: { kind: "attribute", attribute: "data-name" }, price: { kind: "attribute", attribute: "data-price" } },
  where: [{ read: { kind: "attribute", attribute: "aria-label" }, is: "present" }, { field: "price", lessThan: 50 }]
};

const START: ExtractionCheckpoint = { records: [], pagesRead: 0, scrolls: 0, missingFields: [], itemsSeen: 0 };

test("a condition with its own read keeps the first value it read on an item it held of, cut to sixty characters; a column's condition keeps none", async () => {
  const page = fakePage([
    { name: "No badge", price: "$10" },
    { name: "Dear", price: "$99", label: "Brightaisle Plus" },
    { name: "Cheap", price: "$20", label: "Brightaisle Plus Premium" }
  ]);
  try {
    const outcome = await extractList(PLUS, { resume: START });
    assert.deepEqual(outcome.records.map((record) => record.name), ["Cheap"]);
    // Held on "Dear" (which the price then rejected), so that is the first; the
    // value on the row the read rejected for want of it is never a candidate.
    assert.deepEqual(outcome.conditions?.seen, ["Brightaisle Plus", null]);
  } finally {
    page.restore();
  }
  const long = fakePage([{ name: "A", price: "$1", label: "x".repeat(100) }]);
  try {
    // Whole: no character cut.
    assert.deepEqual((await extractList(PLUS, { resume: START })).conditions?.seen, ["x".repeat(100), null]);
  } finally {
    long.restore();
  }
});

test("the value is the whole read's first: the checkpoint carries it, and the next document keeps it rather than its own", async () => {
  const taken: ExtractionCheckpoint[] = [];
  const page = fakePage([{ name: "A", price: "$10", label: "Brightaisle Plus" }], [{ name: "B", price: "$10", label: "Later label" }]);
  try {
    await extractList({ ...PLUS, paginate: { mode: "loadMore", control: ".more", maxPages: 2 } }, { resume: START, checkpoint: async (progress) => { taken.push(progress); } });
    assert.deepEqual(taken[0]?.conditions?.seen, ["Brightaisle Plus", null]);
  } finally {
    page.restore();
  }
  const next = fakePage([{ name: "C", price: "$10", label: "Later label" }]);
  try {
    const carried: ExtractionCheckpoint = { ...START, pagesRead: 1, conditions: taken[0]!.conditions! };
    assert.deepEqual((await extractList(PLUS, { resume: carried })).conditions?.seen, ["Brightaisle Plus", null]);
    // A document that carried nothing reports its own.
    assert.deepEqual((await extractList(PLUS, { resume: START })).conditions?.seen, ["Later label", null]);
  } finally {
    next.restore();
  }
});
