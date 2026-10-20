// The longest newest-first run of entries a stored value may keep within a
// byte budget, counted as Core counts a value (`../stored-prefix.ts`, t737).

import assert from "node:assert/strict";
import test from "node:test";
import { webNodeStoredPrefix } from "..";

const bytes = (value: unknown): number => new TextEncoder().encode(JSON.stringify(value)).length;

test("a list within the budget is kept whole", () => {
  const entries = ["one", "two", "three"];
  assert.deepEqual(webNodeStoredPrefix(entries, 1_000), entries);
  assert.deepEqual(webNodeStoredPrefix([], 2), []);
});

test("a list exactly at the budget is kept whole, and one byte under it loses its last entry", () => {
  const entries = ["alpha", "beta", "gamma"];
  const exact = bytes(entries);
  assert.deepEqual(webNodeStoredPrefix(entries, exact), entries);
  assert.deepEqual(webNodeStoredPrefix(entries, exact - 1), ["alpha", "beta"]);
});

test("bytes are counted as UTF-8 of the serialized entry, so a wide character counts for more than one", () => {
  const entries = ["é", "ü"];
  // The serialized list is 9 characters but 11 bytes.
  assert.equal(bytes(entries), 11);
  assert.deepEqual(webNodeStoredPrefix(entries, 11), entries);
  assert.deepEqual(webNodeStoredPrefix(entries, 10), ["é"]);
});

test("a budget too small for even an empty list keeps nothing", () => {
  assert.deepEqual(webNodeStoredPrefix(["one"], 1), []);
});
