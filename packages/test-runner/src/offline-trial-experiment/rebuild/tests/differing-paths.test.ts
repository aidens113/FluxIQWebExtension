import assert from "node:assert/strict";
import test from "node:test";
import { differingPaths } from "../differing-paths.js";

const canonical = (value: unknown): string => JSON.stringify(value);

test("names each dotted path at which two objects differ, down to the first non-object", () => {
  assert.deepEqual(differingPaths({ a: { b: 1, c: [1, 2] }, d: "x" }, { a: { b: 1, c: [1, 3] }, d: "x", e: true }, canonical), ["a.c", "e"]);
  assert.deepEqual(differingPaths({ a: 1 }, { a: 1 }, canonical), []);
  assert.deepEqual(differingPaths({ a: { b: 1 } }, { a: 2 }, canonical), ["a"]);
});
