// W1: words a page wrote twice print once, and a real word or number is never halved.

import assert from "node:assert/strict";
import test from "node:test";
import { undoubledWords } from "../doubling";

test("a price written for the screen and again for a screen reader prints once", () => {
  assert.equal(undoubledWords("$39.99$39.99"), "$39.99");
  assert.equal(undoubledWords("$39.99 $39.99"), "$39.99");
  assert.equal(undoubledWords("Add to cart Add to cart"), "Add to cart");
  assert.equal(undoubledWords("4.54.5"), "4.5");
});

test("words that only look doubled are printed as the page wrote them", () => {
  for (const words of ["2020", "11", "1212", "Bora Bora", "couscous", "aa", "$", "Sponsored"]) {
    assert.equal(undoubledWords(words), words, words);
  }
});

test("whitespace is collapsed and trimmed first", () => {
  assert.equal(undoubledWords("  Add   to cart  Add to cart "), "Add to cart");
});
