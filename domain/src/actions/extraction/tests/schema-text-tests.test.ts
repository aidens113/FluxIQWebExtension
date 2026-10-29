// The extraction schema accepts every text test the condition grammar allows
// (t790): a lone value is as valid as a list of one, and the executed filter
// reads the two the same.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject, JsonValue } from "fluxiq/core";
import { webAutomationExtractListSchema } from "../schema";
import { webAutomationExtractListRequestValue } from "../read-request";

// Core's fit (`parameter-schema/fit.ts`) reads `type` as one or a list, and
// `items` of an array value; this applies those two rules to a condition's
// property, which is all the text tests are declared with.
const condition = (((webAutomationExtractListSchema({}).properties as JsonObject).where as JsonObject).items as JsonObject).properties as Record<string, JsonObject>;
const BASE = { item: ".card", fields: { name: ".name" } };

function ofType(value: JsonValue, type: string): boolean {
  if (type === "array") return Array.isArray(value);
  if (type === "number") return typeof value === "number";
  return typeof value === type && !Array.isArray(value);
}

function fits(value: JsonValue, schema: JsonObject): boolean {
  const types = ([] as JsonValue[]).concat(schema.type ?? []) as string[];
  if (types.length > 0 && !types.some((type) => ofType(value, type))) return false;
  if (Array.isArray(value) && schema.items) return value.every((item) => fits(item, schema.items as JsonObject));
  return true;
}

function misfits(written: Record<string, JsonValue>): number {
  return Object.entries(written).filter(([key, value]) => !fits(value, condition[key]!)).length;
}

test("a lone string or a list is accepted for every text test", () => {
  for (const key of ["contains", "startsWith", "endsWith", "matches", "equals"]) {
    assert.equal(misfits({ [key]: "case" }), 0, `${key} one string`);
    assert.equal(misfits({ [key]: ["case", "tip"] }), 0, `${key} list`);
  }
  assert.equal(misfits({ equals: 4 }), 0);
});

test("a value of no allowed type is still refused", () => {
  for (const key of ["contains", "startsWith", "endsWith", "matches", "equals"]) {
    assert.equal(misfits({ [key]: true }), 1, `${key} boolean`);
    assert.equal(misfits({ [key]: { a: 1 } }), 1, `${key} object`);
  }
  assert.equal(misfits({ contains: [true] }), 1);
  assert.equal(misfits({ matches: [4] }), 1);
});

test("the executed filter reads a lone string as its one-item list", () => {
  for (const key of ["contains", "startsWith", "endsWith", "matches", "equals"]) {
    const lone = webAutomationExtractListRequestValue({ ...BASE, where: [{ field: "name", [key]: "case" }] });
    const list = webAutomationExtractListRequestValue({ ...BASE, where: [{ field: "name", [key]: ["case"] }] });
    assert.deepEqual(lone?.where, list?.where, key);
    assert.deepEqual(lone?.where, [{ field: "name", [key]: ["case"] }], key);
  }
});
