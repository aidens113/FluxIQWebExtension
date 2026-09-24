// The rule that separates an identifier an author wrote from one a rendering
// generated. Both halves matter, so both are enumerated: a generated token
// called stable costs a Flow every future replay, and a stable one called
// generated costs it its strongest anchor for nothing.
//
// The first row is the one this module was written for. `:r13b8o:` is the
// everything store's notifications modal on seed 241, and a Flow built on
// 2026-09-23 (`test-runs/run-muesyox4-930bef98`) carried
// `#\:r13b8o\: > div > div:nth-of-type(2) > button:nth-of-type(1)` -- an
// address to a token that belongs to one rendering of one page.

import assert from "node:assert/strict";
import test from "node:test";
import { isVolatileIdentifier, selectorQuotesVolatileIdentifier } from "../volatile-identifier";

/** Identifiers a rendering generated, and the generator each shape comes from. */
const GENERATED = [
  [":r13b8o:", "the run this module was written for: React's shape, drawn from a build seed"],
  [":r0:", "React useId, the first id on the page"],
  [":r1a:", "React useId, once the counter turns over into base 32"],
  [":ra:", "React useId, a counter of ten, with no digit left in the token"],
  ["radix-:r1:", "Radix, which wraps useId and bolts its own stem on"],
  ["headlessui-dialog-:r7:", "Headless UI, the same shape with two stems"],
  ["a3f91c2e", "a content hash: eight hex characters"],
  ["field-9b2c4d1e7f", "a hash on an authored stem; the stem does not rescue it"],
  ["3f2504e0-4f89-11d3-9a0c-0305e82c3301", "a UUID"],
  ["x7k2m9q1", "a token counted out by a machine: digits dense, no word to hold them"],
  ["mat-input-3", "Angular Material, whose tokens are a stem and a counter"],
  ["cdk-overlay-0", "the Angular CDK"],
  ["ember1234", "Ember, whose counter runs straight on from the stem"]
] as const;

/** Identifiers an author wrote, including every shape the rules above come closest to. */
const AUTHORED = [
  ["search", "the ordinary case"],
  ["section2", "a word with a number on it"],
  ["checkout2024", "a word with a year on it, which is a quarter digits"],
  ["h2", "too short to be anything but a name"],
  ["col-md-6", "a grid class shape: every segment too short to be opaque"],
  ["form:email", "a colon separating two words the author chose"],
  ["main-navigation", "words, and nothing else"],
  ["step-1", "a counter on a stem no generator uses"],
  ["utf8-preferences", "a word holding digits, held together by two syllables"],
  ["product-grid", "the shape a test id usually takes"]
] as const;

test("an identifier a rendering generated is volatile, whichever generator drew it", () => {
  for (const [identifier, why] of GENERATED) {
    assert.equal(isVolatileIdentifier(identifier), true, `${identifier} is generated: ${why}`);
  }
});

test("an identifier an author wrote is kept, including the shapes the rules come closest to", () => {
  for (const [identifier, why] of AUTHORED) {
    assert.equal(isVolatileIdentifier(identifier), false, `${identifier} is authored: ${why}`);
  }
});

test("nothing at all is not a generated identifier", () => {
  assert.equal(isVolatileIdentifier(""), false);
  assert.equal(isVolatileIdentifier("   "), false);
});

test("a selector addressed through a generated identifier is recognised through its CSS escaping", () => {
  const recorded = String.raw`#\:r13b8o\: > div > div:nth-of-type(2) > button:nth-of-type(1)`;
  assert.equal(selectorQuotesVolatileIdentifier(recorded), true, "the selector the failed run carried");
  assert.equal(selectorQuotesVolatileIdentifier("#\\:r0\\: input"), true);
});

test("a selector quoting only authored identifiers and structure is left alone", () => {
  for (const selector of [
    "#search",
    `[data-testid="product-link"]`,
    `input[name="email"]`,
    "main > div:nth-of-type(2) > aside > div:nth-of-type(1) > a",
    "#checkout-form > fieldset:nth-of-type(3) > button:nth-of-type(1)"
  ]) {
    assert.equal(selectorQuotesVolatileIdentifier(selector), false, selector);
  }
});
