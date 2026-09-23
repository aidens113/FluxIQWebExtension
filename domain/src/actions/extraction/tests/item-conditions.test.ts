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

test("a condition the page could not act on refuses the whole request", () => {
  const rows: Array<[string, unknown]> = [
    ["no value named", [{ is: "absent" }]],
    ["two values named", [{ field: "name", read: ".other" }]],
    ["a field the request does not read", [{ field: "missing" }]],
    ["a bare string, which could only ever mean present", ["name"]],
    ["an empty list", []],
    ["a key the grammar does not know", [{ field: "name", selector: ".x" }]],
    ["a presence the grammar does not know", [{ field: "name", is: "sometimes" }]],
    ["a bound that is not a number", [{ field: "name", lessThan: "50" }]],
    ["a bound that is not finite", [{ field: "name", atLeast: Number.POSITIVE_INFINITY }]],
    ["a read the page cannot honour", [{ read: { kind: "attribute" } }]],
    ["one good condition and one bad", [{ field: "name" }, { field: "missing" }]]
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
