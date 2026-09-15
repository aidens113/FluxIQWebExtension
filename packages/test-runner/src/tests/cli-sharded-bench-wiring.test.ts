import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const sourceRoot = path.resolve(import.meta.dirname, "..", "..", "src");
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
  const bench = await import("../bench/index.js");
  assert.equal(typeof bench.createShardedBench, "function");
  assert.equal(typeof bench.resumeShardedBench, "function");
  assert.equal(typeof bench.acquireMachineCellSlot, "function");
  assert.equal(typeof bench.prepareAuthenticatedShardMerge, "function");
});

test("CLI creation and resume discriminate serial from saved logical-shard authority without overrides", async () => {
  const cli = await source("cli.ts");
  assert.match(cli, /const savedManifest = "resumeBenchId" in command \? await loadCampaignManifest\(benchDirectory\(runsDirectory, command\.resumeBenchId\)\) : null;/u);
  assert.match(cli, /savedManifest!\.execution\.mode === "serial"\) outcome = await resumeBench\(/u);
  assert.match(cli, /savedManifest!\.execution\.mode === "shard-parent"\) outcome = await resumeShardedBench\(/u);
  assert.match(cli, /command\.shards === undefined\)[\s\S]*?createResumableBench\([\s\S]*?createShardedBench\(/u);
  assert.match(cli, /shardCount: command\.shards, jobs: command\.jobs \?\? Math\.min\(command\.shards, 2\)/u, "creation defaults jobs to the machine-wide cap without changing the saved shard count");
  const shardedResume = cli.slice(cli.indexOf("await resumeShardedBench("), cli.indexOf("else throw", cli.indexOf("await resumeShardedBench(")));
  assert.doesNotMatch(shardedResume, /command\.(?:shards|jobs)|shardCount:|jobs:/u, "resume takes its scheduler shape only from saved authority");
});

test("CLI prepares once, shares one safe OS-temp slot root, and prints only logical create/resume lifecycle", async () => {
  const cli = await source("cli.ts");
  const benchBranch = cli.slice(cli.indexOf('if (command.command === "bench")'), cli.indexOf('if ((command.command === "run"'));
  assert.equal(benchBranch.match(/loadScenarioManifests\(/gu)?.length, 1);
  assert.equal(benchBranch.match(/buildCampaignCompatibility\(/gu)?.length, 1);
  assert.equal(benchBranch.match(/const machineSlotsDirectory = path\.join\(os\.tmpdir\(\), "fluxiq-testing-lab-machine-slots"\);/gu)?.length, 1);
  assert.equal(benchBranch.match(/machineSlotsDirectory/gu)?.length, 3, "one definition is passed to sharded create and resume");
  assert.match(cli, /if \(record\.event === "created" \|\| record\.event === "resumed"\) process\.stderr\.write/u);
  assert.doesNotMatch(cli.slice(cli.indexOf("function reportBenchLifecycle")), /machineSlotsDirectory|tmpdir/u, "the shared machine path is never emitted by lifecycle output");
});
