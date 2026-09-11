// T1 coverage of value-readers.ts: the narrow readers for untyped gateway and
// Core HTTP fields, and the compactor every outgoing payload runs through.

import assert from "node:assert/strict";
import { test } from "node:test";
import { arrayValue, compactObject, numberValue, objectValue, parseJsonBody, rectValue, stringValue, timestampValue } from "../value-readers";

test("compactObject drops undefined members and keeps every other falsy value", () => {
  assert.deepEqual(
    compactObject({ kept: 1, dropped: undefined, nil: null, empty: "", zero: 0, no: false }),
    { kept: 1, nil: null, empty: "", zero: 0, no: false }
  );
});

test("the scalar readers accept only their own type", () => {
  assert.equal(stringValue("text"), "text");
  assert.equal(stringValue(""), "");
  for (const other of [1, null, undefined, {}, ["text"]]) assert.equal(stringValue(other), undefined);
  assert.equal(numberValue(0), 0);
  for (const other of ["1", null, undefined, {}]) assert.equal(numberValue(other), undefined);
});

test("objectValue accepts a plain object but not an array or null", () => {
  const value = { a: 1 };
  assert.equal(objectValue(value), value);
  for (const other of [[1], null, undefined, "object", 1]) assert.equal(objectValue(other), undefined);
});

test("arrayValue falls back to an empty array", () => {
  const value = [1, 2];
  assert.equal(arrayValue(value), value);
  assert.deepEqual(arrayValue({ length: 1 }), []);
  assert.deepEqual(arrayValue(undefined), []);
});

test("rectValue needs four numeric members and copies only those", () => {
  assert.deepEqual(rectValue({ x: 1, y: 2, width: 3, height: 4, extra: true }), { x: 1, y: 2, width: 3, height: 4 });
  assert.equal(rectValue({ x: 1, y: 2, width: 3 }), undefined);
  assert.equal(rectValue({ x: "1", y: 2, width: 3, height: 4 }), undefined);
  assert.equal(rectValue(null), undefined);
});

test("timestampValue reads epoch milliseconds and parseable date strings", () => {
  assert.equal(timestampValue(1_757_548_800_000), 1_757_548_800_000);
  assert.equal(timestampValue("2025-09-11T00:00:00.000Z"), Date.UTC(2025, 8, 11));
  assert.equal(timestampValue("not a date"), undefined);
  assert.equal(timestampValue(null), undefined);
});

test("parseJsonBody returns undefined for an empty or malformed body", () => {
  assert.deepEqual(parseJsonBody('{"ok":true}'), { ok: true });
  assert.equal(parseJsonBody("null"), null);
  assert.equal(parseJsonBody(""), undefined);
  assert.equal(parseJsonBody("{"), undefined);
});
