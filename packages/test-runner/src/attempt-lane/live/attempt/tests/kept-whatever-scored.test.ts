import assert from "node:assert/strict";
import test from "node:test";
import { keptWhateverScored } from "../kept-whatever-scored.js";

test("a scoring that throws still keeps the ending, and its own error is the one the run fails with", async () => {
  const kept: string[] = [];
  const thrown = new Error("Core stored 4 record(s) for a run dataset and returned 28");
  await assert.rejects(keptWhateverScored(async () => { throw thrown; }, async () => { kept.push("ending"); }, () => undefined), (error) => error === thrown);
  assert.deepEqual(kept, ["ending"]);
});

test("an ending that cannot be kept is logged and never replaces the scoring's error", async () => {
  const logged: string[] = [];
  const thrown = new Error("the dataset read failed");
  await assert.rejects(keptWhateverScored(async () => { throw thrown; }, async () => { throw new Error("no picture"); }, (line) => logged.push(line)), (error) => error === thrown);
  assert.deepEqual(logged, ["[attempt] the attempt's ending could not be kept: no picture"]);
});

test("a scoring that works keeps nothing here: the caller keeps the ending with its score", async () => {
  let kept = false;
  assert.equal(await keptWhateverScored(async () => "right", async () => { kept = true; }, () => undefined), "right");
  assert.equal(kept, false);
});
