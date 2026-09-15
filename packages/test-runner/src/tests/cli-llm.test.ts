import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { runCli } from "../cli.js";

const sourceRoot = path.resolve(import.meta.dirname, "..", "..", "src");
const source = (relative: string) => readFile(path.join(sourceRoot, relative), "utf8");

test("runCli rejects validated live LLM mode before target or process startup", async () => {
  const repositoryRoot = await mkdtemp(path.join(os.tmpdir(), "fluxiq-live-cli-gate-"));
  const stderr: string[] = [];
  const originalWrite = process.stderr.write;
  process.stderr.write = ((chunk: string | Uint8Array) => { stderr.push(String(chunk)); return true; }) as typeof process.stderr.write;
  try {
    const code = await runCli([
      "run", "basic-form", "--live-llm", "--llm-profile", "deepseek-lab",
      "--llm-provider", "deepseek", "--llm-model", "deepseek-chat", "--llm-task", "diagnose",
    ], { FLUXIQ_WEB_EXTENSION_ROOT: repositoryRoot });
    assert.equal(code, 1);
    assert.match(stderr.join(""), /Live LLM execution is fail-closed/);
    assert.equal(stderr.join("").includes("DEEPSEEK_API_KEY"), false);
  } finally {
    process.stderr.write = originalWrite;
    await rm(repositoryRoot, { recursive: true, force: true });
  }
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
