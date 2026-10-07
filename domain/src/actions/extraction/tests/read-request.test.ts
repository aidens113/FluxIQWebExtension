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
  // Page order and once-per-row across pages are the read's defaults and need no
  // parameter, so a request that names neither `dedupe` nor `sort` carries
  // neither (`../request.ts`).
  assert.deepEqual(Object.keys(request ?? {}).sort(), ["fields", "item", "minItems", "paginate", "where"]);
});

// `dedupe` and `sort` live inside the request, beside `where`, and nowhere else
// (decided 2026-09-28). The read keeps them in canonical form, and a part it
// cannot read is dropped and named exactly as a condition is.

test("a request's dedupe and sort are read inside it, in canonical form, beside where", () => {
  const read = webAutomationExtractListRequestRead({
    item: ".job",
    fields: { title: ".title", company: ".company", posted: ".posted", url: "a@href" },
    where: [{ field: "title", contains: "rust" }],
    dedupe: ["title", "company"],
    sort: "posted desc",
    maxItems: 20
  });
  assert.deepEqual(read.dropped, []);
  assert.deepEqual(read.request?.dedupe, { by: ["title", "company"] });
  assert.deepEqual(read.request?.sort, [{ field: "posted", order: "desc" }]);
  assert.deepEqual(Object.keys(read.request ?? {}).sort(), ["dedupe", "fields", "item", "maxItems", "sort", "where"]);
});

test("a dedupe or sort key that cannot be read is dropped and named, and the rest of the request still runs", () => {
  const read = webAutomationExtractListRequestRead({
    item: ".job",
    fields: { title: ".title", posted: ".posted" },
    dedupe: 7,
    sort: ["posted desc", "newest", "title"]
  });
  // `newest` is a direction naming no column, so it sorts by nothing and leaves;
  // the keys either side of it still sort.
  assert.deepEqual(read.dropped, ["dedupe", "sort.1"]);
  assert.equal(read.request?.dedupe, undefined);
  assert.deepEqual(read.request?.sort, [{ field: "posted", order: "desc" }, { field: "title", order: "asc" }]);
  // A dispatch runs it; a producer's wire copy, which must be whole, does not.
  assert.notEqual(webAutomationExtractListRequestValue({ item: ".job", fields: { title: ".title" }, dedupe: 7 }), undefined);
  assert.equal(webAutomationExtractListRequestWhole({ item: ".job", fields: { title: ".title" }, dedupe: 7 }), undefined);
});

test("an off dedupe and an empty sort are no dedupe and no sort, not faults", () => {
  const read = webAutomationExtractListRequestRead({ item: ".job", fields: { title: ".title" }, dedupe: false, sort: [] });
  assert.deepEqual(read.dropped, []);
  assert.deepEqual(Object.keys(read.request ?? {}).sort(), ["fields", "item"]);
});

// A field is read by its kind, and a member its kind does not take is left
// behind rather than refusing the field (t194-w45). The case that forced it:
// Core's rerun merge patches `{kind: "text"}` over `{kind: "column", header}`
// and the `header` stays, because a column's member is not named after its kind.

test("a member the field's kind does not take is dropped, and the field reads by its kind", () => {
  const rows: Array<[why: string, written: Record<string, unknown>, read: Record<string, unknown>]> = [
    ["a rerun's text over a column", { kind: "text", header: "Price", required: false }, { kind: "text", required: false }],
    ["a header on a link", { kind: "link", selector: "a", header: "Title" }, { kind: "link", selector: "a" }],
    ["an attribute on text", { kind: "text", selector: "h3", attribute: "title" }, { kind: "text", selector: "h3" }],
    ["an attribute on a column", { kind: "column", header: "Price", attribute: "data-price" }, { kind: "column", header: "Price" }],
    ["a header on an attribute", { kind: "attribute", selector: "a", attribute: "href", header: "Link" }, { kind: "attribute", selector: "a", attribute: "href" }],
    ["a stray member that is not even a string", { kind: "value", selector: "input", header: 3, attribute: null }, { kind: "value", selector: "input" }]
  ];
  for (const [why, written, read] of rows) {
    const request = { item: "tr", fields: { name: ".name", other: written } };
    const result = webAutomationExtractListRequestRead(request);
    assert.deepEqual(result.request?.fields.other, read, why);
    // Nothing the read can do without was dropped: the field is whole, read by
    // the kind the model chose, so a producer's wire copy reads it the same way.
    assert.deepEqual(result.dropped, [], why);
    assert.deepEqual(webAutomationExtractListRequestWhole(request), result.request, why);
  }
});

test("a condition's read drops a member its kind does not take, and the condition still runs", () => {
  const read = webAutomationExtractListRequestRead({
    item: "tr",
    fields: { name: ".name" },
    where: [{ read: { kind: "text", selector: ".ad", header: "Ad", required: false }, is: "absent" }]
  });
  assert.deepEqual(read.dropped, []);
  assert.deepEqual(read.request?.where, [{ read: { kind: "text", selector: ".ad", required: false }, is: "absent" }]);
});

test("a kind that needs its own member and lacks it is still refused, whatever else it carries", () => {
  for (const [why, spec] of [
    ["an attribute field carrying only a header", { kind: "attribute", selector: "a", header: "Link" }],
    ["a column field carrying only an attribute", { kind: "column", attribute: "data-price" }]
  ] as Array<[string, Record<string, unknown>]>) {
    assert.equal(webAutomationExtractListRequestValue({ item: "tr", fields: { name: ".name", other: spec } }), undefined, why);
    const condition = webAutomationExtractListRequestRead({ item: "tr", fields: { name: ".name" }, where: [{ read: spec, is: "present" }] });
    assert.deepEqual(condition.dropped, ["where.0"], why);
  }
});

// S4 (C3): a Flow's read answers only the rows it kept, possibly none, and the
// domain says so on the request. Any other value is not a read this contract
// knows how to answer, so it is dropped and named like every other part.
test("a request's answer is read as kept, and another value is dropped and named", () => {
  const kept = webAutomationExtractListRequestRead({ ...BASE, answer: "kept" });
  assert.deepEqual(kept.dropped, []);
  assert.equal(kept.request?.answer, "kept");
  assert.equal(webAutomationExtractListRequestWhole({ ...BASE, answer: "kept" })?.answer, "kept");
  for (const answer of ["all", true, 1, null]) {
    const read = webAutomationExtractListRequestRead({ ...BASE, answer });
    assert.deepEqual(read.dropped, ["answer"], JSON.stringify(answer));
    assert.equal(Object.hasOwn(read.request ?? {}, "answer"), false);
    assert.equal(webAutomationExtractListRequestWhole({ ...BASE, answer }), undefined, JSON.stringify(answer));
  }
  assert.equal(Object.hasOwn(webAutomationExtractListRequestValue(BASE) ?? {}, "answer"), false);
});
