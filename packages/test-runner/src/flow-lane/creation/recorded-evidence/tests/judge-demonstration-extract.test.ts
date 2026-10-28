import assert from "node:assert/strict";
import test from "node:test";
import { judgeExactExtract, judgeRatedExtract } from "../judge-demonstration-extract.js";

const record = (n: number) => ({ name: `Item ${n}`, url: `/p/${n}` });
const expected = [record(1), record(2)];

test("an exact extract passes only on the same records in the same order", () => {
  assert.equal(judgeExactExtract("extract-x", expected, expected).passed, true);
  const reordered = judgeExactExtract("extract-x", [record(2), record(1)], expected);
  assert.equal(reordered.passed, false);
  assert.deepEqual(reordered.mismatches, [{ position: 1, kind: "different" }, { position: 2, kind: "different" }]);
});

test("a short or long extract names the missing and unexpected positions, and an empty expectation never passes", () => {
  assert.deepEqual(judgeExactExtract("e", [record(1)], expected).mismatches, [{ position: 2, kind: "missing" }]);
  assert.deepEqual(judgeExactExtract("e", [...expected, record(3)], expected).mismatches, [{ position: 3, kind: "unexpected" }]);
  assert.equal(judgeExactExtract("e", [], []).passed, false);
});

test("a differing field fails even when the keys match", () => {
  assert.equal(judgeExactExtract("e", [record(1), { ...record(2), name: "Item two" }], expected).passed, false);
});

test("the rated judgement keeps four-star cards that are not accessories, in the order the pages show them", () => {
  const read = [record(1), record(2), record(3), record(4)];
  const cards = [
    { url: "/p/1", name: "Earbuds one", rating: "4.5" },
    { url: "/p/3", name: "Replacement ear tips", rating: "5" },
    { url: "/p/2", name: "Earbuds two", rating: "4" },
    { url: "/p/4", name: "Earbuds four", rating: "3.9" },
    { url: "/p/9", name: "Not in the extract", rating: "5" },
    { url: "/p/1", name: "Earbuds one again", rating: "5" },
  ];
  const verdict = judgeRatedExtract("e", read, cards, expected);
  assert.equal(verdict.passed, true);
  assert.deepEqual([verdict.readCount, verdict.keptCount, verdict.expectedCount], [4, 2, 2]);
  assert.equal(judgeRatedExtract("e", read, cards.filter((card) => card.url !== "/p/2"), expected).passed, false);
});
