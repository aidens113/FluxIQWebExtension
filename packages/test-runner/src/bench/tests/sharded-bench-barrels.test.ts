import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const sourceRoot = path.resolve(import.meta.dirname, "..", "..", "..", "src");
const source = (relative: string) => readFile(path.join(sourceRoot, relative), "utf8");

test("the public bench barrels expose the approved shard authority and machine-slot seams", async () => {
  const [bench, campaign] = await Promise.all([source("bench/index.ts"), source("bench/campaign/index.ts")]);
  assert.match(bench, /export \* from "\.\/shard-merge\.js";/u);
  assert.match(bench, /export \* from "\.\/sharded-bench\.js";/u);
  assert.match(campaign, /export \* from "\.\/machine-slots\/index\.js";/u);
  assert.match(campaign, /export \* from "\.\/shard-group-store\.js";/u);
  assert.match(campaign, /export \* from "\.\/shard-plan\.js";/u);
  assert.match(campaign, /export \* from "\.\/store\.js";/u);
});

test("the runtime barrel exposes the logical orchestration entry points", async () => {
  const bench = await import("../index.js");
  assert.equal(typeof bench.createShardedBench, "function");
  assert.equal(typeof bench.resumeShardedBench, "function");
  assert.equal(typeof bench.acquireMachineCellSlot, "function");
  assert.equal(typeof bench.prepareAuthenticatedShardMerge, "function");
});
