import assert from "node:assert/strict";
import test from "node:test";
import { watchMatrixActivity } from "../activity-watch.js";

const LIKE = "node.bootstrap.0123456789abcdef.main.like";

function snapshot(...sequences: number[]) {
  const recent = sequences.map(sequence => ({ sequence, subject: { kind: "run", id: "run-1", projectId: "p" }, detail: { kind: "step", ref: LIKE, recovery: { kind: "reacquire", subject: "Found the item again", outcome: "succeeded" } } }));
  return { current: recent.at(-1) ?? null, recent };
}

test("the watch keeps every recovery row any read saw, once each, though later reads no longer hold it", async () => {
  const answers = [snapshot(1), snapshot(1, 2), snapshot(3)];
  let reads = 0;
  const watch = watchMatrixActivity(async () => answers[Math.min(reads++, answers.length - 1)], 5);
  await new Promise(resolve => setTimeout(resolve, 40));
  const collected = await watch.stop();
  assert.deepEqual(collected.activities?.map(row => row.sequence), [1, 2, 3]);
  assert.ok(collected.reads >= 3);
  assert.equal(collected.failedReads, 0);
});

test("a watch whose every read failed collected nothing, which is not an empty stream", async () => {
  const watch = watchMatrixActivity(async () => { throw new Error("Core went away"); }, 5);
  await new Promise(resolve => setTimeout(resolve, 20));
  const collected = await watch.stop();
  assert.equal(collected.activities, null);
  assert.equal(collected.reads, 0);
  assert.ok(collected.failedReads >= 1);
});
