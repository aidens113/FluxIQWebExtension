// The redaction marker a verb's validation strings use, on its own.
//
// The live proof is e2e/content/tests/redaction.spec.ts, which asserts on a
// real page that no sensitive value reaches a result. These rows pin the two
// properties that proof cannot state directly: that an ordinary field's string
// is byte-for-byte what it always was -- three specs assert those exact strings
// -- and that a withheld one carries a length and no content at any length.

import assert from "node:assert/strict";
import test from "node:test";
import { describeFieldValue } from "../value-redaction";

test("a value that is not withheld is quoted exactly as before", () => {
  assert.equal(describeFieldValue("Ada", false), '"Ada"');
  assert.equal(describeFieldValue("", false), '""');
  assert.equal(describeFieldValue('say "hi"', false), '"say "hi""');
});

// A one-character value is excluded from the substring check on purpose: every
// single letter of "a withheld value of 1 character" trivially "survives" it.
// The shape assertion below covers that case, and the length row covers the
// wording, so nothing about it is untested.
test("a withheld value is named by its length and never by its content", () => {
  for (const value of ["abcd", "a longer entry with spaces", "éèê", "1234-5678-9012-3456", "swordfish"]) {
    const described = describeFieldValue(value, true);
    assert.equal(described.includes(value), false, `the value survived redaction`);
    assert.match(described, /^a withheld value of \d+ characters?$/u);
    assert.ok(described.includes(String(value.length)), `the length is missing from ${described}`);
  }
});

test("the marker's shape leaks nothing beyond a length, at any length", () => {
  for (const length of [1, 2, 7, 64, 4_096]) {
    assert.match(describeFieldValue("x".repeat(length), true), /^a withheld value of \d+ characters?$/u);
  }
});

test("an empty withheld field says so, because emptiness is not a secret", () => {
  assert.equal(describeFieldValue("", true), "an empty value");
});

test("the length is worded for one character as well as many", () => {
  assert.equal(describeFieldValue("x", true), "a withheld value of 1 character");
  assert.equal(describeFieldValue("xy", true), "a withheld value of 2 characters");
});
