import assert from "node:assert/strict";
import test from "node:test";
import type { AskedChange } from "../../asked/index.js";
import { judgeAskedAgain } from "../judge-asked-again.js";
import { judgeLaterChange } from "../judge-later-change.js";

const act = (name: string, change: Record<string, number>) => ({ name, change });
const asked = (...acts: ReturnType<typeof act>[]): AskedChange => ({ acts, change: Object.assign({}, ...acts.map((each) => each.change)) as Record<string, number> });
const SAVES = asked(act("Three saved", { "saved:a": 1, "saved:b": 1, "saved:c": 1 }));
const CART = asked(act("Two kettles in the cart", { "cart:k": 2 }));
const DONE = { "saved:a": 1, "saved:b": 1, "saved:c": 1 };

test("a toggle a person asked to do again is pressed again, and that is no repeat: the same change the same-words oracle calls wrong", () => {
  const unsaved = { "saved:a": -1, "saved:b": -1, "saved:c": -1 };
  assert.equal(judgeLaterChange(SAVES, DONE, unsaved).held, false);
  assert.deepEqual(judgeAskedAgain(SAVES, unsaved), { pressedAgain: ["Three saved"], notPressed: [], held: true });
});

test("a count a person asked to do again moves further, and is held", () => {
  assert.deepEqual(judgeAskedAgain(CART, { "cart:k": 2 }), { pressedAgain: ["Two kettles in the cart"], notPressed: [], held: true });
});

test("a Run again that changed nothing did not do what was asked, and names the act", () => {
  assert.deepEqual(judgeAskedAgain(SAVES, {}), { pressedAgain: [], notPressed: ["Three saved"], held: false });
});

test("a task that asks for no act has nothing to do again, and is not held as done again", () => {
  assert.equal(judgeAskedAgain(asked(), {}).held, false);
});
