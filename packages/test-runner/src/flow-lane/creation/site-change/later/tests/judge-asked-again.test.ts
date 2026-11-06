import assert from "node:assert/strict";
import test from "node:test";
import { askedChangeOf, type AskedAct, type AskedChange } from "../../asked/index.js";
import { judgeAskedAgain } from "../judge-asked-again.js";
import { judgeLaterChange } from "../judge-later-change.js";

const act = (name: string, change: Record<string, number>) => ({ name, change });
const asked = (...acts: AskedAct[]): AskedChange => ({ acts, change: Object.assign({}, ...acts.map((each) => each.change)) as Record<string, number> });
const SAVES = asked(act("Three saved", { "saved:a": 1, "saved:b": 1, "saved:c": 1 }));
const CART = asked(act("Two kettles in the cart", { "cart:k": 2 }));
const DONE = { "saved:a": 1, "saved:b": 1, "saved:c": 1 };

test("a Run again on saves already standing changes nothing, and that is right: each was checked and left as asked", () => {
  const judged = judgeAskedAgain(SAVES, DONE, {});
  assert.equal(judged.held, true);
  assert.deepEqual([judged.foundAsAsked, judged.pressedAgain, judged.undone, judged.notPressed], [["Three saved"], [], [], []]);
});

test("a toggle pressed again on a Run again undoes what was asked, and is wrong, naming each row, as the same words' oracle says", () => {
  const unsaved = { "saved:a": -1, "saved:b": -1, "saved:c": -1 };
  assert.equal(judgeLaterChange(SAVES, DONE, unsaved).held, false);
  const judged = judgeAskedAgain(SAVES, DONE, unsaved);
  assert.equal(judged.held, false);
  assert.deepEqual(judged.undone, ["Three saved"]);
  assert.deepEqual([...judged.unaskedChanges].sort(), ["saved:a", "saved:b", "saved:c"]);
});

test("one row pressed off among three standing is still undone", () => {
  const judged = judgeAskedAgain(SAVES, DONE, { "saved:b": -1 });
  assert.equal(judged.held, false);
  assert.deepEqual(judged.unaskedChanges, ["saved:b"]);
});

test("a count a person asked to do again moves further, and is no repeat", () => {
  const judged = judgeAskedAgain(CART, { "cart:k": 2 }, { "cart:k": 2 });
  assert.equal(judged.held, true);
  assert.deepEqual([judged.pressedAgain, judged.repeatedActs, judged.unaskedChanges], [["Two kettles in the cart"], [], []]);
});

test("what an earlier attempt never reached is still asked: done now is right, not done is missing", () => {
  assert.equal(judgeAskedAgain(SAVES, { "saved:a": 1 }, { "saved:b": 1, "saved:c": 1 }).held, true);
  const short = judgeAskedAgain(SAVES, { "saved:a": 1 }, {});
  assert.equal(short.held, false);
  assert.deepEqual(short.notPressed, ["Three saved"]);
});

test("a change the task never asked for is wrong on a Run again too", () => {
  const judged = judgeAskedAgain(SAVES, DONE, { "hidden:x": 1 });
  assert.equal(judged.held, false);
  assert.deepEqual(judged.unaskedChanges, ["hidden:x"]);
});

const SET_TO_THREE = asked({ name: "Batteries made three packs", change: { "cart:b": 2 }, sets: true }, act("One descaler added", { "cart:d": 1 }));

test("a set-to-3 a person asks for again lands nothing, and that is right: three already stands", () => {
  const judged = judgeAskedAgain(SET_TO_THREE, { "cart:b": 2, "cart:d": 1 }, { "cart:d": 1 });
  assert.equal(judged.held, true);
  assert.deepEqual([judged.foundAsAsked, judged.pressedAgain, judged.repeatedActs, judged.unaskedChanges], [["Batteries made three packs"], ["One descaler added"], [], []]);
});

test("a set-to-3 that lands 5 on a Run again is a repeat, not a press again, while the add beside it may move again", () => {
  const judged = judgeAskedAgain(SET_TO_THREE, { "cart:b": 2, "cart:d": 1 }, { "cart:b": 2, "cart:d": 1 });
  assert.equal(judged.held, false);
  assert.deepEqual(judged.repeatedActs, [{ name: "Batteries made three packs", asked: 0, landed: 2 }]);
  assert.deepEqual([judged.pressedAgain, judged.foundAsAsked, judged.unaskedChanges], [["One descaler added"], [], []]);
});

test("the asked table marks the batteries and the dish soap as set-to acts, and the descaler as an amount", () => {
  const acts = askedChangeOf("everything-store-batteries-and-descaler")?.acts ?? [];
  assert.deepEqual(acts.map((each) => [each.name, each.sets === true]), [["Batteries made three packs", true], ["One descaler added to the cart", false]]);
  assert.equal(askedChangeOf("bigbox-retail-ensure-soap-quantity")?.acts[0]?.sets, true);
});

test("a task that asks for no act has nothing to do again, and is not held as done again", () => {
  assert.equal(judgeAskedAgain(asked(), {}, {}).held, false);
});
