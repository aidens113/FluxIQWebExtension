// Reading an extraction request's `where` off an untrusted value (C5): which
// conditions a dispatch accepts, and what becomes of one it cannot read.
//
// The rule every row here rests on is the file's own, as it stood after
// 2026-09-26: nothing is dropped **quietly**. A condition that cannot be read
// leaves on its own and is named in the read's `dropped`, and the conditions
// beside it still run. It used to refuse the whole request, which is not a wider
// answer but an extraction that cannot run at all -- and nothing is the failure
// that dominated the everything-store rung, where six of ten built Flows stored
// no records.

import assert from "node:assert/strict";
import test from "node:test";
import { webAutomationExtractListRequestRead, webAutomationExtractListRequestValue } from "../read-request";
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

test("a numeric bound is kept as written, and a bound beside `absent` leaves with its condition", () => {
  assert.deepEqual(read([{ field: "name", atLeast: 4 }])?.where, [{ field: "name", atLeast: 4 }]);
  assert.deepEqual(read([{ field: "name", atLeast: 10, atMost: 50 }])?.where, [{ field: "name", atLeast: 10, atMost: 50 }]);
  assert.deepEqual(read([{ field: "name", lessThan: 50 }, { field: "badge", greaterThan: 0 }])?.where, [
    { field: "name", lessThan: 50 },
    { field: "badge", greaterThan: 0 }
  ]);
  // "The value is not there" and "the number in it is under fifty" cannot both
  // have been meant, so that condition leaves and every row is kept.
  assert.equal(Object.hasOwn(read([{ field: "name", is: "absent", lessThan: 50 }])!, "where"), false);
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

test("a condition the page could not act on leaves, and the conditions beside it still run", () => {
  const rows: Array<[string, unknown]> = [
    ["no value named", [{ is: "absent" }]],
    ["two values named", [{ field: "name", read: ".other" }]],
    ["a bare string, which could only ever mean present", ["name"]],
    ["a key the grammar does not know", [{ field: "name", selector: ".x" }]],
    ["a presence the grammar does not know", [{ field: "name", is: "sometimes" }]],
    ["a bound that is not a number", [{ field: "name", lessThan: "50" }]],
    ["a bound that is not finite", [{ field: "name", atLeast: Number.POSITIVE_INFINITY }]],
    ["a read the page cannot honour", [{ read: { kind: "attribute" } }]],
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
  for (const [why, where] of rows) {
    // The request still reads, the clause it could not act on is gone, and the
    // read says which one it was -- so the answer is too wide rather than absent,
    // and an author is still refused by name before the Flow runs
    // (`output-nodes/extract-list/issues.ts`).
    const result = webAutomationExtractListRequestRead({ ...BASE, where });
    assert.notEqual(result.request, undefined, why);
    assert.equal(Object.hasOwn(result.request!, "where"), false, why);
    assert.deepEqual(result.dropped, ["where.0"], why);
  }
  // The conditions beside a bad one are what the tolerance is for: one clause the
  // model wrote badly must not cost the rows the others would have kept.
  const mixed = webAutomationExtractListRequestRead({
    ...BASE,
    where: [{ field: "name", contains: "buds" }, { field: "name", lessThan: "50" }, { field: "badge", is: "absent" }]
  });
  assert.deepEqual(mixed.request?.where, [{ field: "name", contains: ["buds"] }, { field: "badge", is: "absent" }]);
  assert.deepEqual(mixed.dropped, ["where.1"]);
});

test("a condition naming no column that exists resolves to the nearest one, and says it assumed", () => {
  // The standing rule, and the run it was written for: a model that writes a
  // slightly wrong name has not named anything unknown, and the evidence on
  // refusing it is that the model does not correct itself.
  const fields = { name: ".name", price: ".price", rating: ".rating", url: { kind: "link" as const, selector: "a" } };
  const resolve = (where: unknown) => webAutomationExtractListRequestRead({ item: ".card", fields, where });

  const misspelt = resolve([{ field: "ratng", atLeast: 4 }]);
  assert.deepEqual(misspelt.request?.where, [{ field: "rating", atLeast: 4 }], "a typo inside the only word still names the column");
  assert.equal(misspelt.assumed[0]?.how, "nearest");
  assert.equal(misspelt.assumed[0]?.written, "ratng");
  assert.equal(misspelt.assumed[0]?.field, "rating");
  assert.equal(misspelt.assumed[0]?.index, 0);
  assert.deepEqual(misspelt.dropped, [], "an assumption is not a drop");

  // A spelling variant is not a guess: separators and casing are the same name.
  const spelt = resolve([{ field: "Price", lessThan: 50 }]);
  assert.deepEqual(spelt.request?.where, [{ field: "price", lessThan: 50 }]);
  assert.equal(spelt.assumed[0]?.how, "normalized");

  // A name written long, which is how a model names a column it renamed once.
  assert.deepEqual(resolve([{ field: "productName", contains: "buds" }]).request?.where, [{ field: "name", contains: ["buds"] }]);

  // An exact key is never an assumption, however close another key is.
  const exact = resolve([{ field: "name", contains: "buds" }]);
  assert.deepEqual(exact.request?.where, [{ field: "name", contains: ["buds"] }]);
  assert.deepEqual(exact.assumed, []);

  // A name nothing plausible answers to stays an honest failure -- and an honest
  // failure here is one dropped clause and every row kept, never a refused read.
  const unknown = resolve([{ field: "sponsored", is: "absent" }]);
  assert.notEqual(unknown.request, undefined);
  assert.equal(Object.hasOwn(unknown.request!, "where"), false);
  assert.deepEqual(unknown.dropped, ["where.0"]);

  // An excluded column is never read from the page, so it is not a candidate
  // either: a condition over it could only ever be false (D12).
  const excluded = { name: ".name", badge: { kind: "text" as const, selector: ".badge", handling: "exclude" as const } };
  const away = webAutomationExtractListRequestRead({ item: ".card", fields: excluded, where: [{ field: "badge", is: "absent" }] });
  assert.deepEqual(away.dropped, ["where.0"], "the excluded key is not resolved to itself");
  assert.deepEqual(away.assumed, [], "nor guessed at as the one column that is read");
});

test("the one shape a request declares breaks a guess: a number was not asked of an address", () => {
  // A request says what to read and never what type a column holds, so the only
  // shape signal is a field that reads an address. Two keys equally close to
  // `linkk`: the bound picks the one that is not a link, the text comparison
  // leaves the order alone.
  const fields = { linky: ".a", link: { kind: "link" as const, selector: "a" } };
  const numeric = webAutomationExtractListRequestRead({ item: ".card", fields, where: [{ field: "linkk", lessThan: 50 }] });
  assert.equal(numeric.request?.where?.[0]?.field, "linky", "an address column is stood aside for a comparison on a number");
  const textual = webAutomationExtractListRequestRead({ item: ".card", fields, where: [{ field: "linkk", contains: "https" }] });
  assert.equal(textual.request?.where?.[0]?.field, "linky", "and a textual comparison ranks on the name alone");
  // Standing aside is not excluding: with nothing else to pick, the address
  // column is still the answer, because a guess beats a dropped clause.
  const only = webAutomationExtractListRequestRead({
    item: ".card",
    fields: { price: { kind: "link" as const, selector: "a" } },
    where: [{ field: "pricee", lessThan: 50 }]
  });
  assert.equal(only.request?.where?.[0]?.field, "price");
});

test("a condition may not test a column the read never takes, because it could only ever be false", () => {
  // An excluded column is never read from the page (D12), so a condition over it
  // is a filter that removes every row. The condition leaves; the read does not.
  const fields = { name: ".name", badge: { kind: "text" as const, selector: ".badge", handling: "exclude" as const } };
  const over = webAutomationExtractListRequestRead({ item: ".card", fields, where: [{ field: "badge", is: "absent" }] });
  assert.notEqual(over.request, undefined);
  assert.equal(Object.hasOwn(over.request!, "where"), false);
  assert.deepEqual(over.dropped, ["where.0"]);
  assert.notEqual(webAutomationExtractListRequestValue({ item: ".card", fields, where: [{ field: "name", is: "present" }] }), undefined);
  // The same column read as a condition of its own is fine: it is read to
  // decide the row and never becomes one of the record's columns.
  assert.notEqual(
    webAutomationExtractListRequestValue({ item: ".card", fields, where: [{ read: { kind: "text", selector: ".badge" }, is: "absent" }] }),
    undefined
  );
  const excludedRead = webAutomationExtractListRequestRead({
    item: ".card",
    fields,
    where: [{ read: { kind: "text", selector: ".badge", handling: "exclude" } }]
  });
  assert.equal(Object.hasOwn(excludedRead.request!, "where"), false);
  assert.deepEqual(excludedRead.dropped, ["where.0"]);
});
