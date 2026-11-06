import assert from "node:assert/strict";
import test from "node:test";
import type { AskedChange } from "../../asked/index.js";
import { judgeSiteChange } from "../../judge-change.js";
import { judgeLaterChange } from "../judge-later-change.js";
import { stillAsked } from "../still-asked.js";

const act = (name: string, change: Record<string, number>) => ({ name, change });
const asked = (...acts: ReturnType<typeof act>[]): AskedChange => ({ acts, change: Object.assign({}, ...acts.map((each) => each.change)) as Record<string, number> });
const SAVES = asked(act("Three saved", { "saved:a": 1, "saved:b": 1, "saved:c": 1 }));
const CART = asked(act("Two kettles in the cart", { "cart:k": 2 }));
const DONE = { "saved:a": 1, "saved:b": 1, "saved:c": 1 };

test("with every act landed nothing is still asked, and a change of nothing is right", () => {
  assert.deepEqual(stillAsked(SAVES, DONE).acts, []);
  assert.deepEqual(judgeLaterChange(SAVES, DONE, {}), { held: true, repeatedActs: [], missingActs: [], unaskedChanges: [] });
});

test("a toggle pressed again is a change away from the end state, and it names each row", () => {
  const judged = judgeLaterChange(SAVES, DONE, { "saved:a": -1, "saved:c": -1 });
  assert.equal(judged.held, false);
  assert.deepEqual(judged.unaskedChanges, ["saved:a", "saved:c"]);
  assert.deepEqual(judged.repeatedActs, []);
  assert.deepEqual(judged.missingActs, []);
});

test("a count pressed again is a repeat of an act already done: asked 0, and what landed", () => {
  const judged = judgeLaterChange(CART, { "cart:k": 2 }, { "cart:k": 2 });
  assert.equal(judged.held, false);
  assert.deepEqual(judged.repeatedActs, [{ name: "Two kettles in the cart", asked: 0, landed: 2 }]);
  assert.deepEqual(judged.unaskedChanges, []);
});

test("what the earlier attempt left undone is still asked, and doing just that is right", () => {
  const left = { "saved:a": 1 };
  assert.deepEqual(stillAsked(SAVES, left).change, { "saved:b": 1, "saved:c": 1 });
  assert.equal(judgeLaterChange(SAVES, left, { "saved:b": 1, "saved:c": 1 }).held, true);
  assert.deepEqual(judgeLaterChange(SAVES, left, { "saved:b": 1 }).missingActs, ["Three saved"]);
  const again = judgeLaterChange(SAVES, left, { "saved:a": 1, "saved:b": 1, "saved:c": 1 });
  assert.deepEqual(again.repeatedActs, [{ name: "Three saved", asked: 0, landed: 1 }]);
});

test("an act part-counted has only its rest asked, and landing more than that is a repeat", () => {
  const left = { "cart:k": 1 };
  assert.equal(judgeLaterChange(CART, left, { "cart:k": 1 }).held, true);
  assert.deepEqual(judgeLaterChange(CART, left, { "cart:k": 3 }).repeatedActs, [{ name: "Two kettles in the cart", asked: 1, landed: 3 }]);
});

test("a name the task never asked to move is still named, and a read-only task holds to no change", () => {
  assert.deepEqual(judgeLaterChange(SAVES, DONE, { "hidden:z": 1 }).unaskedChanges, ["hidden:z"]);
  assert.deepEqual(judgeLaterChange(asked(), {}, { "saved:z": 1 }).unaskedChanges, ["saved:z"]);
  assert.equal(judgeLaterChange(asked(), {}, {}).held, true);
});

test("the first attempt's oracle is untouched: from the seed, all of it is asked, and a repeat is still a repeat", () => {
  assert.deepEqual(stillAsked(SAVES, {}).change, SAVES.change);
  assert.equal(judgeLaterChange(CART, {}, { "cart:k": 2 }).held, judgeSiteChange(CART, { "cart:k": 2 }).held);
  assert.deepEqual(judgeLaterChange(CART, {}, { "cart:k": 4 }).repeatedActs, judgeSiteChange(CART, { "cart:k": 4 }).repeatedActs);
});
