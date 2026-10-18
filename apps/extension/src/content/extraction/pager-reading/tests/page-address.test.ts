// Coverage of `sameDocument` (`../page-address.ts`): a query parameter with an
// empty value counts as absent on either side (run-mvd0pbn9-bad36023), and
// nothing else about the comparison moved.

import assert from "node:assert/strict";
import test from "node:test";
import { sameDocument } from "..";

const same = (left: string, right: string): boolean => sameDocument(new URL(left), new URL(right));

test("an empty parameter on either side is the same document as one without it", () => {
  assert.equal(same("http://shop.test/find?kind=&q=lamp", "http://shop.test/find?q=lamp"), true);
  assert.equal(same("http://shop.test/find?q=lamp", "http://shop.test/find?q=lamp&kind="), true);
  assert.equal(same("http://shop.test/find?kind=&q=lamp&sort=", "http://shop.test/find?q=lamp&size="), true);
  assert.equal(same("http://shop.test/find?kind=", "http://shop.test/find"), true);
});

test("a parameter with a value still tells two documents apart, empty or not on the other side", () => {
  assert.equal(same("http://shop.test/find?kind=desk&q=lamp", "http://shop.test/find?q=lamp"), false);
  assert.equal(same("http://shop.test/find?kind=desk&q=lamp", "http://shop.test/find?kind=&q=lamp"), false);
  assert.equal(same("http://shop.test/find?q=lamp&page=2", "http://shop.test/find?q=lamp&page=3"), false);
});

test("the query in any order and the fragment are ignored, the origin and path are not, as before", () => {
  assert.equal(same("http://shop.test/find?q=lamp&page=2#top", "http://shop.test/find?page=2&q=lamp"), true);
  assert.equal(same("http://shop.test/find?q=lamp", "http://shop.test/search?q=lamp"), false);
  assert.equal(same("http://shop.test/find?q=lamp", "http://other.test/find?q=lamp"), false);
});
