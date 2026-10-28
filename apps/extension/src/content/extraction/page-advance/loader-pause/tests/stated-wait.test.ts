// The wait a loader's notice states (`../stated-wait.ts`).

import assert from "node:assert/strict";
import test from "node:test";
import { statedWaitMs } from "../stated-wait";

test("a stated count of seconds or minutes is the wait, with a margin", () => {
  assert.equal(statedWaitMs("Try again in 4s"), 4_500);
  assert.equal(statedWaitMs("Too many requests. Try again in 2 seconds."), 2_500);
  assert.equal(statedWaitMs("Please wait 30 seconds before you try again."), 30_000);
  assert.equal(statedWaitMs("Retry in 1 minute"), 30_000, "held to the longest a step sits out");
});

test("a notice that states no count states no wait", () => {
  assert.equal(statedWaitMs("Please wait a few moments before you try again."), undefined);
  assert.equal(statedWaitMs("Server busy"), undefined);
});
