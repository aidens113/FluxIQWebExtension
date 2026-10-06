// Coverage of cut-at-word.ts: a sentence longer than its bound is cut where
// a word ends, never inside one (U-4 of the run-muw60j7c-bb7c9a62 UI review:
// "Search Bri…", "trying another w…", "the check found the…" for "they").

import assert from "node:assert/strict";
import test from "node:test";

import { cutAtWord } from "../index";

test("a sentence within its bound is left whole", () => {
  assert.equal(cutAtWord("Running step 2 of 5: Open the cart", 160), "Running step 2 of 5: Open the cart");
  assert.equal(cutAtWord("exactly ten", 11), "exactly ten");
});

test("a longer sentence ends on the last whole word that fits, then an ellipsis", () => {
  const sentence = "Run failed: It returned 30 rows, but the check found they don't answer what you asked";
  for (let max = 12; max < sentence.length; max += 1) {
    const cut = cutAtWord(sentence, max);
    assert.ok(cut.length <= max, `${max}: ${cut}`);
    assert.ok(cut.endsWith("…"), cut);
    const kept = cut.slice(0, -1);
    assert.ok(sentence.startsWith(kept), cut);
    // The character after what was kept is a space or punctuation the cut dropped: never the inside of a word.
    assert.match(sentence.charAt(kept.length), /[\s,;:—-]/u, `${max}: "${cut}" cuts inside a word`);
  }
  assert.equal(cutAtWord("the check found they don't answer", 21), "the check found they…");
  assert.equal(cutAtWord("the check found they don't answer", 19), "the check found…");
});

test("no dangling comma, colon or dash is left before the ellipsis", () => {
  assert.equal(cutAtWord("Updating the Flow — that didn't work, trying another way", 22), "Updating the Flow…");
  assert.equal(cutAtWord("It returned 30 rows, but the check", 22), "It returned 30 rows…");
});

test("a quote left open by the cut is closed, so the name reads as cut", () => {
  assert.equal(cutAtWord("Trying again: typing \"wireless earbuds\" into “Search Brightaisle”", 54), "Trying again: typing \"wireless earbuds\" into “Search…”");
});

test("one word longer than the bound has no word end to cut at, so it is cut where the bound falls", () => {
  assert.equal(cutAtWord("x".repeat(400), 160).length, 160);
});
