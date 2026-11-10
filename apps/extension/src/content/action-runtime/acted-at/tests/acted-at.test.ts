// When an action first acted on the page (task speed S10): the first act of an
// action is kept, a read notes nothing, and each action starts afresh.

import assert from "node:assert/strict";
import test from "node:test";
import { actedClock } from "..";

test("the first act of an action is its moment, and a new action starts with none", () => {
  actedClock.begin();
  assert.equal(actedClock.read(), undefined, "an action that only reads acted on nothing");
  actedClock.note(1_000);
  actedClock.note(1_200);
  assert.equal(actedClock.read(), 1_000);
  actedClock.begin();
  assert.equal(actedClock.read(), undefined);
});
