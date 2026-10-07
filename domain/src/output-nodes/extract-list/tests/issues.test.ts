// The `extractList` validator refuses, before a Flow runs, what the dispatch
// would refuse when it ran: each malformed shape gets a code naming the part
// that is wrong, and a well-formed request gets none.
//
// Every case is also put to the dispatch reader, so the invariant the validator
// exists for is checked directly: whatever the reader refuses has a code.

import assert from "node:assert/strict";
import test from "node:test";
import { webAutomationExtractListRequestValue } from "../../../actions/extraction";
import { webAutomationExtractListIssues, type WebAutomationExtractListIssueCode } from "../issues";

const good = {
  item: "li.product",
  fields: {
    name: ".name",
    image: "img@src",
    price: "column:Price",
    link: { kind: "link", selector: "a" },
    sku: { kind: "attribute", selector: ".sku", attribute: "data-sku", required: false },
    email: { kind: "text", selector: ".email", handling: "exclude" }
  },
  // One page, which is what the picker records and all a read now reads.
  paginate: { mode: "next", next: "a.next", maxPages: 1 },
  minItems: 0,
  maxItems: 500
};

function issuesFor(value: unknown): WebAutomationExtractListIssueCode[] {
  const issues = webAutomationExtractListIssues(value);
  if (webAutomationExtractListRequestValue(value) === undefined) {
    assert.notDeepEqual(issues, [], `the reader refuses ${JSON.stringify(value)} but the validator found nothing`);
  }
  return issues;
}

test("a well-formed request has no issues", () => {
  assert.deepEqual(issuesFor(good), []);
  assert.deepEqual(issuesFor({ item: "tr", fields: { name: "td" } }), []);
  for (const paginate of [
    { next: "a.next", maxPages: 1 },
    { mode: "loadMore", control: "button.more", maxPages: 1 },
    { mode: "numbered", pages: "nav a", maxPages: 1 }
  ]) assert.deepEqual(issuesFor({ ...good, paginate }), [], JSON.stringify(paginate));
});

// Read-list redesign S4: a read reads one page, and the Flow goes through pages
// with a Next page step and a repeat. A read that pages by itself is refused by
// name before the Flow runs, as the dispatch refuses it when it runs, whether or
// not the rest of its paging is well formed.
test("a read that goes through more than one page by itself is refused as retired", () => {
  for (const paginate of [
    { next: "a.next", maxPages: 2 },
    { mode: "loadMore", control: "button.more", maxPages: 5 },
    { mode: "scroll", maxScrolls: 20 },
    { mode: "scroll", maxScrolls: 1 },
    { mode: "numbered", pages: "nav a", maxPages: 3 },
    { next: null, maxPages: 5 },
    { mode: "scroll", maxScrolls: 5, limit: 5 }
  ]) assert.deepEqual(issuesFor({ ...good, paginate }), ["web.extract_list.paginate_retired"], JSON.stringify(paginate));
});

test("the gap report's malformed value is refused for its missing parts", () => {
  assert.deepEqual(issuesFor({ nonsense: true }).sort(), ["web.extract_list.invalid_fields", "web.extract_list.invalid_item", "web.extract_list.unknown_key"]);
});

test("each malformed shape is refused with the code for its part", () => {
  const cases: [unknown, WebAutomationExtractListIssueCode[]][] = [
    [null, ["web.extract_list.not_object"]],
    ["li", ["web.extract_list.not_object"]],
    [[good], ["web.extract_list.not_object"]],
    [{ ...good, item: "" }, ["web.extract_list.invalid_item"]],
    [{ ...good, item: 3 }, ["web.extract_list.invalid_item"]],
    [{ fields: good.fields }, ["web.extract_list.invalid_item"]],
    [{ ...good, fields: "name" }, ["web.extract_list.invalid_fields"]],
    [{ ...good, fields: {} }, ["web.extract_list.no_fields"]],
    [{ ...good, fields: { "product name": ".name" } }, ["web.extract_list.invalid_field_key"]],
    [{ ...good, fields: { name: "" } }, ["web.extract_list.invalid_field"]],
    [{ ...good, fields: { name: 4 } }, ["web.extract_list.invalid_field"]],
    [{ ...good, fields: { name: { kind: "html" } } }, ["web.extract_list.invalid_field"]],
    [{ ...good, fields: { name: { kind: "attribute", selector: "a" } } }, ["web.extract_list.invalid_field"]],
    // A member the kind does not take is dropped, not refused (t194-w45).
    [{ ...good, fields: { name: { kind: "text", header: "Name" } } }, []],
    [{ ...good, fields: { name: { kind: "text", handling: "hide" } } }, ["web.extract_list.invalid_field"]],
    [{ ...good, fields: { name: { kind: "text", css: ".name" } } }, ["web.extract_list.unknown_field_key"]],
    [{ ...good, fields: { email: { kind: "text", handling: "exclude" } } }, ["web.extract_list.all_fields_excluded"]],
    [{ ...good, itemElement: "li" }, ["web.extract_list.invalid_item_element"]],
    [{ ...good, paginate: "next" }, ["web.extract_list.invalid_paginate"]],
    [{ ...good, paginate: { mode: "infinite", maxPages: 1 } }, ["web.extract_list.invalid_paginate"]],
    [{ ...good, paginate: { mode: "next", maxPages: 1 } }, ["web.extract_list.invalid_paginate"]],
    [{ ...good, paginate: { mode: "next", next: "a", maxPages: 0 } }, ["web.extract_list.invalid_paginate"]],
    [{ ...good, paginate: { mode: "next", next: "a", maxPages: 1, control: "b" } }, ["web.extract_list.invalid_paginate"]],
    [{ ...good, paginate: { mode: "next", next: "a", maxPages: 1, limit: 5 } }, ["web.extract_list.unknown_paginate_key"]],
    [{ ...good, minItems: -1 }, ["web.extract_list.invalid_min_items"]],
    [{ ...good, minItems: "1" }, ["web.extract_list.invalid_min_items"]],
    [{ ...good, minItems: 600 }, ["web.extract_list.min_items_exceed_max"]],
    [{ ...good, maxItems: undefined, minItems: 1_001 }, ["web.extract_list.min_items_exceed_max"]],
    [{ ...good, maxItems: 0 }, ["web.extract_list.invalid_max_items"]],
    [{ ...good, maxItems: "all" }, ["web.extract_list.invalid_max_items"]],
    [{ ...good, pagination: { next: "a.next", maxPages: 3 } }, ["web.extract_list.unknown_key"]],
    [{ ...good, frameId: 1 }, ["web.extract_list.unknown_key"]]
  ];
  for (const [value, expected] of cases) assert.deepEqual(issuesFor(value), expected, JSON.stringify(value));
});

test("each code is listed once however many parts share it", () => {
  assert.deepEqual(issuesFor({ ...good, fields: { name: "", price: 3, link: { kind: "nope" } } }), ["web.extract_list.invalid_field"]);
});

test("the two stricter checks refuse what the reader would silently drop", () => {
  // The reader ignores an undeclared key and an unreadable maxItems, so a Flow
  // would run with neither and report success.
  for (const value of [{ ...good, pagination: { next: "a" } }, { ...good, maxItems: 0 }]) {
    assert.notEqual(webAutomationExtractListRequestValue(value), undefined);
    assert.notDeepEqual(webAutomationExtractListIssues(value), []);
  }
});

// `dedupe` and `sort` are the request's own keys (decided 2026-09-28), so a plan
// writing them inside `extractList` is accepted in every spelling the reader
// takes, and refused by name only for what the reader would drop.

test("a request's dedupe and sort are accepted in the spellings a model writes", () => {
  const fields = { title: ".title", company: ".company", posted: ".posted", url: "a@href" };
  for (const order of [
    { dedupe: true },
    { dedupe: "url" },
    { dedupe: { by: ["title", "company"] } },
    { dedupe: false, sort: [] },
    { sort: "posted desc" },
    { sort: [{ field: "posted", order: "desc", as: "date" }] },
    { dedupe: ["title", "company"], sort: ["-posted", "title"] }
  ]) {
    assert.deepEqual(issuesFor({ item: ".job", fields, ...order }), [], JSON.stringify(order));
  }
});

test("a dedupe that is not one, and a sort key naming no column, are refused by name", () => {
  const fields = { title: ".title", posted: ".posted" };
  assert.deepEqual(issuesFor({ item: ".job", fields, dedupe: 3 }), ["web.extract_list.invalid_dedupe"]);
  assert.deepEqual(issuesFor({ item: ".job", fields, sort: "newest" }), ["web.extract_list.invalid_sort"]);
  assert.deepEqual(issuesFor({ item: ".job", fields, sort: [{ field: "posted", order: "sideways" }] }), ["web.extract_list.invalid_sort"]);
});
