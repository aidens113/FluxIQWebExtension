// The two ways an extraction request may be read, and which caller wants which.
//
// `webAutomationExtractListRequestValue` is what a **dispatch** asks: the request
// the page would run, with the parts it could not read dropped and named. On
// 2026-09-26 that replaced refusing the whole request over one bad part, because
// a refusal at dispatch is not a narrower answer -- it is an extraction that
// never runs, and of the ten Flows built on the everything-store rung six stored
// no records at all. Run `run-muhubegx-9469de5e` authored
// `paginate: { next: null, maxPages: 5 }`, which plainly means "keep reading, I
// was never shown the control", and the old rule answered it with nothing.
//
// `webAutomationExtractListRequestWhole` is what a **wire copy of a producer's
// value** asks: all of it, or none. A model's slip is nobody's to repair by the
// time it reaches the page; a detector's or a recorder's malformed pagination is
// a producer saying something this contract cannot read back, and arriving as a
// definition that claims no pagination would be a misstatement no one can see.
//
// The author-facing codes ask the whole question too
// (`output-nodes/extract-list/issues.ts`), which is what keeps the tolerance from
// being a licence: a plan carrying any of these is still refused by name, before
// it runs, at the one moment a model can act on it.

import assert from "node:assert/strict";
import test from "node:test";
import {
  webAutomationExtractListRequestRead,
  webAutomationExtractListRequestValue,
  webAutomationExtractListRequestWhole
} from "../read-request";

const BASE = { item: "li.product", fields: { name: ".name", price: ".price" } };

/** Every part a read does without, with what a model plausibly wrote for it. */
const DROPPABLE: Array<[part: string, written: Record<string, unknown>]> = [
  // The run this change was written for.
  ["paginate", { paginate: { next: null, maxPages: 5 } }],
  ["paginate", { paginate: { mode: "infinite", maxPages: 3 } }],
  ["paginate", { paginate: "next" }],
  ["minItems", { minItems: -1 }],
  ["minItems", { minItems: "1" }],
  ["minItems", { minItems: 9, maxItems: 8 }],
  ["itemElement", { itemElement: { unrelated: true } }],
  ["itemElement", { itemElement: "li.product" }],
  ["where.0", { where: [{ is: "absent" }] }],
  ["where.0", { where: "name" }]
];

test("a part a read can do without is dropped and named, and the read still runs", () => {
  for (const [part, written] of DROPPABLE) {
    const why = JSON.stringify(written);
    const read = webAutomationExtractListRequestRead({ ...BASE, ...written });
    assert.notEqual(read.request, undefined, why);
    assert.deepEqual(read.dropped, [part], why);
    // What survives is the read the page performs: the item, the columns, and
    // nothing the request could not say.
    assert.equal(read.request?.item, "li.product", why);
    assert.deepEqual(Object.keys(read.request?.fields ?? {}), ["name", "price"], why);
    // The same value read whole is no request at all, which is what a wire copy
    // of a producer's value gets.
    assert.equal(webAutomationExtractListRequestWhole({ ...BASE, ...written }), undefined, why);
  }
});

test("the parts a read cannot do without still refuse it whole, and each has a code of its own", () => {
  // An item selector names which elements are rows and `fields` names what to
  // read in them: without either there is no wider answer to give, only a
  // different one. Both are named before the Flow runs --
  // `web.extract_list.invalid_item`, `invalid_fields`, `no_fields`,
  // `invalid_field`, `all_fields_excluded` -- so nothing about them is silent.
  const rows: Array<[string, Record<string, unknown>]> = [
    ["no item selector", { fields: { name: ".name" } }],
    ["an item selector that is not a string", { item: 7, fields: { name: ".name" } }],
    ["no fields", { item: "li", fields: {} }],
    ["a field that reads nothing", { item: "li", fields: { name: "" } }],
    ["a field spec the page could not honour", { item: "li", fields: { name: { kind: "attribute" } } }],
    ["every field excluded", { item: "li", fields: { name: { kind: "text", selector: ".n", handling: "exclude" } } }],
    // The frame is the command's, never the request's: read without it, the page
    // would search the document it was delivered to while the author believed it
    // had named another. A different answer rather than a wider one.
    ["a request naming a frame", { ...BASE, frameId: 3 }]
  ];
  for (const [why, written] of rows) {
    const read = webAutomationExtractListRequestRead(written);
    assert.equal(read.request, undefined, why);
    assert.deepEqual(read.dropped, [], why);
  }
});

test("a request with nothing wrong reads the same either way, and reports neither a drop nor an assumption", () => {
  const written = {
    ...BASE,
    itemElement: { selector: "li.product", tagName: "li" },
    paginate: { mode: "next", next: "a.next", maxPages: 5 },
    minItems: 0,
    maxItems: 40,
    where: [{ field: "price", lessThan: 50 }]
  };
  const read = webAutomationExtractListRequestRead(written);
  assert.deepEqual(read.dropped, []);
  assert.deepEqual(read.assumed, []);
  assert.deepEqual(webAutomationExtractListRequestWhole(written), read.request);
  assert.deepEqual(webAutomationExtractListRequestValue(written), read.request);
});

test("every clause of an instruction's qualifying conditions reaches one request, which is what the node had to be able to say", () => {
  // The instruction of `run-muhubegx-9469de5e`, clause by clause: a badge that
  // must be there, a rating floor, a price ceiling, and two exclusions -- the
  // sponsored placements and the accessories -- one of which names two words.
  // The Flow it produced carried one condition. This is what carrying all six
  // looks like, and that the reader keeps every one of them to the character.
  const request = webAutomationExtractListRequestValue({
    item: "li.product",
    fields: { name: ".title", price: ".price", rating: ".rating", url: { kind: "link", selector: "a.title" } },
    where: [
      { read: ".badge-plus", is: "present" },
      { field: "rating", atLeast: 4 },
      { field: "price", lessThan: 50 },
      { read: ".sponsored-label", is: "absent" },
      { field: "name", contains: ["ear tip", "charging case"], not: true }
    ],
    paginate: { mode: "next", next: "a.next", maxPages: 10 },
    minItems: 0
  });
  assert.deepEqual(request?.where, [
    { read: ".badge-plus", is: "present" },
    { field: "rating", atLeast: 4 },
    { field: "price", lessThan: 50 },
    { read: ".sponsored-label", is: "absent" },
    { field: "name", contains: ["ear tip", "charging case"], not: true }
  ]);
  // Order and once-per-row across pages are the read's own behaviour and need no
  // parameter, so nothing here says them (`../request.ts`). What the request
  // still cannot say is *which column* identifies a row: the de-duplication key
  // is the whole record.
  assert.deepEqual(Object.keys(request ?? {}).sort(), ["fields", "item", "minItems", "paginate", "where"]);
});
