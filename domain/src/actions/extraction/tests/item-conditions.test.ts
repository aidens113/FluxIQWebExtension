// Reading an extraction request's `where` off an untrusted value (C5): which
// conditions a dispatch accepts, and which refuse the whole request.
//
// The rule every row here rests on is the file's own: nothing is dropped
// quietly. A condition that cannot be read refuses the request rather than
// leaving, because a read that quietly lost its conditions returns every item
// of a run the author asked it to narrow -- the page's advertisements among its
// results -- and reports success having done it.

import assert from "node:assert/strict";
import test from "node:test";
import { webAutomationExtractListRequestValue } from "../read-request";
import type { WebAutomationExtractListRequest } from "../request";

const BASE = { item: ".card", fields: { name: ".name", badge: { kind: "text" as const, selector: ".badge", required: false } } };

function read(where: unknown): WebAutomationExtractListRequest | undefined {
  return webAutomationExtractListRequestValue({ ...BASE, where });
}

test("a condition names one value, by a field key this request reads or by a field of its own", () => {
  assert.deepEqual(read([{ field: "badge", is: "absent" }])?.where, [{ field: "badge", is: "absent" }]);
  assert.deepEqual(read([{ read: ".ad-label" }])?.where, [{ read: ".ad-label" }]);
  // A field of the condition's own with no selector reads the item itself,
  // which is where a results page writes its mark on an advertisement.
  assert.deepEqual(read([{ read: { kind: "attribute", attribute: "data-ad-id" }, is: "absent" }])?.where, [
    { read: { kind: "attribute", attribute: "data-ad-id" }, is: "absent" }
  ]);
  // One condition on its own is a list of one: a model with one thing to say
  // about which items it wants should not have to remember a shape to say it in.
  assert.deepEqual(read({ field: "name", is: "present" })?.where, [{ field: "name", is: "present" }]);
  // Absent conditions leave the request exactly as it was.
  assert.equal(Object.hasOwn(webAutomationExtractListRequestValue(BASE)!, "where"), false);
});

test("a numeric bound is kept as written, and a bound beside `absent` is refused", () => {
  assert.deepEqual(read([{ field: "name", atLeast: 4 }])?.where, [{ field: "name", atLeast: 4 }]);
  assert.deepEqual(read([{ field: "name", atLeast: 10, atMost: 50 }])?.where, [{ field: "name", atLeast: 10, atMost: 50 }]);
  assert.deepEqual(read([{ field: "name", lessThan: 50 }, { field: "badge", greaterThan: 0 }])?.where, [
    { field: "name", lessThan: 50 },
    { field: "badge", greaterThan: 0 }
  ]);
  // "The value is not there" and "the number in it is under fifty" cannot both
  // have been meant.
  assert.equal(read([{ field: "name", is: "absent", lessThan: 50 }]), undefined);
  assert.equal(read([{ field: "name", is: "present", lessThan: 50 }])?.where?.length, 1);
});

test("filtering is optional: no clause and an empty clause are the same request, and both keep every item", () => {
  // The direction of 2026-09-24, after conditions a sharper vocabulary made
  // writable emptied a whole run (`run-mug3tnti-9ab80b85`): nothing about
  // filtering is required to get a plain extraction, and where a shape can be
  // read two ways the wider reading wins.
  const plain = webAutomationExtractListRequestValue(BASE);
  assert.notEqual(plain, undefined);
  assert.equal(Object.hasOwn(plain!, "where"), false, "a request that named no conditions carries none");
  // An empty clause says what no clause says. It used to refuse the request.
  const empty = read([]);
  assert.notEqual(empty, undefined, "an empty clause is not a refusal");
  assert.equal(Object.hasOwn(empty!, "where"), false, "an empty clause leaves rather than arriving as a clause that filters nothing");
  assert.deepEqual(empty, plain);
});

test("a textual comparison is kept as a list, whichever way it was written", () => {
  // The everything-store instruction of 2026-09-24, whose two exclusions had
  // nowhere to go (`run-mug1z9k9-ef625d8b`): no sponsored placements, and no
  // accessories. A lone value is read as a list of one, because "no charging
  // cases" is one thing to say and `["..."]` is a shape to remember.
  assert.deepEqual(read([{ field: "name", contains: "charging case" }])?.where, [{ field: "name", contains: ["charging case"] }]);
  assert.deepEqual(read([{ field: "name", contains: ["ear tips", "charging case"], not: true }])?.where, [
    { field: "name", contains: ["ear tips", "charging case"], not: true }
  ]);
  for (const key of ["matches", "startsWith", "endsWith"]) {
    assert.deepEqual(read([{ field: "name", [key]: "case" }])?.where, [{ field: "name", [key]: ["case"] }], key);
  }
  // An equality keeps each value as written, since a number is compared against
  // the number in the value and a string against its text.
  assert.deepEqual(read([{ field: "name", equals: 4 }])?.where, [{ field: "name", equals: [4] }]);
  assert.deepEqual(read([{ field: "name", equals: ["Plus", 4] }])?.where, [{ field: "name", equals: ["Plus", 4] }]);
  // A number where a text was expected is read as its digits rather than refused.
  assert.deepEqual(read([{ field: "name", contains: 50 }])?.where, [{ field: "name", contains: ["50"] }]);
  // `not: false` is what no `not` at all means, so it is not carried.
  assert.deepEqual(read([{ field: "name", contains: "case", not: false }])?.where, [{ field: "name", contains: ["case"] }]);
  assert.deepEqual(read([{ field: "name", contains: "case", not: "true" }])?.where, [{ field: "name", contains: ["case"], not: true }]);
  // A condition the resolver emitted reads back as itself, which is what lets
  // the plan resolver hand its output to this reader.
  const canonical = read([{ field: "name", contains: ["case"], not: true }])?.where;
  assert.deepEqual(read(canonical)?.where, canonical);
});

test("a phrase written under another name is read as the one it means", () => {
  const rows: Array<[unknown, unknown]> = [
    [{ field: "name", min: 4 }, { field: "name", atLeast: 4 }],
    [{ field: "name", gte: 4 }, { field: "name", atLeast: 4 }],
    [{ field: "name", max: 50 }, { field: "name", atMost: 50 }],
    [{ field: "name", lt: 50 }, { field: "name", lessThan: 50 }],
    [{ field: "name", gt: 0 }, { field: "name", greaterThan: 0 }],
    // Case and punctuation are ignored, so one meaning is not five keys.
    [{ field: "name", greater_than: 0 }, { field: "name", greaterThan: 0 }],
    [{ field: "name", GreaterThan: 0 }, { field: "name", greaterThan: 0 }],
    [{ field: "name", regex: "^Acme" }, { field: "name", matches: ["^Acme"] }],
    [{ field: "name", pattern: "^Acme" }, { field: "name", matches: ["^Acme"] }],
    [{ field: "name", includes: "case" }, { field: "name", contains: ["case"] }],
    [{ field: "name", equalTo: "Plus" }, { field: "name", equals: ["Plus"] }],
    [{ field: "name", contains: "case", exclude: true }, { field: "name", contains: ["case"], not: true }],
    // Canonical order, whatever order it was written in.
    [{ field: "name", not: true, contains: "case", min: 4 }, { field: "name", atLeast: 4, contains: ["case"], not: true }]
  ];
  for (const [written, expected] of rows) {
    assert.deepEqual(read([written])?.where, [expected], JSON.stringify(written));
  }
  // Two spellings of one phrase are one phrase when they agree.
  assert.deepEqual(read([{ field: "name", atLeast: 4, min: 4 }])?.where, [{ field: "name", atLeast: 4 }]);
});

test("a condition the page could not act on refuses the whole request", () => {
  const rows: Array<[string, unknown]> = [
    ["no value named", [{ is: "absent" }]],
    ["two values named", [{ field: "name", read: ".other" }]],
    ["a field the request does not read", [{ field: "missing" }]],
    ["a bare string, which could only ever mean present", ["name"]],
    ["a key the grammar does not know", [{ field: "name", selector: ".x" }]],
    ["a presence the grammar does not know", [{ field: "name", is: "sometimes" }]],
    ["a bound that is not a number", [{ field: "name", lessThan: "50" }]],
    ["a bound that is not finite", [{ field: "name", atLeast: Number.POSITIVE_INFINITY }]],
    ["a read the page cannot honour", [{ read: { kind: "attribute" } }]],
    ["one good condition and one bad", [{ field: "name" }, { field: "missing" }]],
    // A regular expression the page could not compile would fail every row and
    // look like an empty page, so it is refused here instead.
    ["a pattern that does not compile", [{ field: "name", matches: "(unclosed" }]],
    ["a pattern longer than one may be", [{ field: "name", matches: "a".repeat(201) }]],
    // `contains: ""` holds of every item, which is a filter that does nothing.
    ["an empty text", [{ field: "name", contains: "" }]],
    ["an empty list of texts", [{ field: "name", contains: [] }]],
    ["a text that is not one", [{ field: "name", contains: { source: "case" } }]],
    ["an equality that is not a value", [{ field: "name", equals: null }]],
    ["a direction that is not a boolean", [{ field: "name", contains: "case", not: "maybe" }]],
    // "The value is not there" and "its text contains a case" cannot both have
    // been meant, exactly as with a bound.
    ["absent beside a textual comparison", [{ field: "name", is: "absent", contains: "case" }]],
    ["absent beside an equality", [{ field: "name", is: "absent", equals: "Plus" }]],
    // Two spellings of one phrase that disagree name no one condition, and
    // `not: false` is one such value rather than a value that was never said.
    ["two spellings that disagree", [{ field: "name", atLeast: 4, min: 5 }]],
    ["two directions that disagree", [{ field: "name", contains: "case", not: false, exclude: true }]]
  ];
  for (const [why, where] of rows) assert.equal(read(where), undefined, why);
});

test("a condition may not test a column the read never takes, because it could only ever be false", () => {
  // An excluded column is never read from the page (D12), so a condition over
  // it is a filter that removes every row, silently.
  const fields = { name: ".name", badge: { kind: "text" as const, selector: ".badge", handling: "exclude" as const } };
  assert.equal(webAutomationExtractListRequestValue({ item: ".card", fields, where: [{ field: "badge", is: "absent" }] }), undefined);
  assert.notEqual(webAutomationExtractListRequestValue({ item: ".card", fields, where: [{ field: "name", is: "present" }] }), undefined);
  // The same column read as a condition of its own is fine: it is read to
  // decide the row and never becomes one of the record's columns.
  assert.notEqual(
    webAutomationExtractListRequestValue({ item: ".card", fields, where: [{ read: { kind: "text", selector: ".badge" }, is: "absent" }] }),
    undefined
  );
  assert.equal(
    webAutomationExtractListRequestValue({ item: ".card", fields, where: [{ read: { kind: "text", selector: ".badge", handling: "exclude" } }] }),
    undefined
  );
});
