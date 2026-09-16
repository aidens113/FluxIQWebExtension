import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { runCli } from "../cli.js";

const sourceRoot = path.resolve(import.meta.dirname, "..", "..", "src");
const source = (relative: string) => readFile(path.join(sourceRoot, relative), "utf8");

/**
 * Live LLM execution is no longer gated off; it is gated *closed*. These pin
 * the three refusals that stand between a command line and a provider call,
 * each of which happens before a topology or a browser starts: a live run that
 * did not ask for the Flow lane, and a live run with no credential to use.
 *
 * The second one deliberately names `DEEPSEEK_API_KEY`. Naming the variable is
 * how an operator learns what to set; the refusal carries no value, because at
 * that point there is none to carry.
 */
test("runCli refuses a live LLM run that did not ask for the Flow lane, before anything starts", async () => {
  const result = await liveRun(["run", "basic-form"]);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /A live LLM run needs the Flow lane: pass --flow/u);
  assert.equal(result.stderr.includes("DEEPSEEK_API_KEY"), false);
});

test("runCli refuses a live Flow-lane run with no provider credential, naming what is missing", async () => {
  const result = await liveRun(["run", "basic-form", "--flow"]);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /Live LLM execution needs a provider credential: DEEPSEEK_API_KEY is not set in the environment/u);
});

test("runCli refuses a live run whose budget could not authorize a call, before a credential is read", async () => {
  const result = await liveRun(["run", "basic-form", "--flow", "--llm-max-cost-usd", "0"]);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /Live LLM execution refused: --llm-max-cost-usd 0 cannot authorize a live provider call/u);
  assert.equal(result.stderr.includes("DEEPSEEK_API_KEY"), false);
});

async function liveRun(argv: readonly string[]): Promise<{ code: number; stderr: string }> {
  const repositoryRoot = await mkdtemp(path.join(os.tmpdir(), "fluxiq-live-cli-gate-"));
  const stderr: string[] = [];
  const originalWrite = process.stderr.write;
  process.stderr.write = ((chunk: string | Uint8Array) => { stderr.push(String(chunk)); return true; }) as typeof process.stderr.write;
  try {
    const code = await runCli([
      ...argv, "--live-llm", "--llm-profile", "deepseek-lab",
      "--llm-provider", "deepseek", "--llm-model", "deepseek-chat", "--llm-task", "diagnose",
    ], { FLUXIQ_WEB_EXTENSION_ROOT: repositoryRoot, FLUXIQ_TEST_ENV_FILES: "none" });
    return { code, stderr: stderr.join("") };
  } finally {
    process.stderr.write = originalWrite;
    await rm(repositoryRoot, { recursive: true, force: true });
  }
}

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
  const benchBranch = cli.slice(cli.indexOf('if (command.command === "bench")'), cli.indexOf('if (command.command === "run")'));
  assert.equal(benchBranch.match(/loadScenarioManifests\(/gu)?.length, 1);
  assert.equal(benchBranch.match(/buildCampaignCompatibility\(/gu)?.length, 1);
  assert.equal(benchBranch.match(/const machineSlotsDirectory = path\.join\(os\.tmpdir\(\), "fluxiq-testing-lab-machine-slots"\);/gu)?.length, 1);
  assert.equal(benchBranch.match(/machineSlotsDirectory/gu)?.length, 3, "one definition is passed to sharded create and resume");
  assert.match(cli, /if \(record\.event === "created" \|\| record\.event === "resumed"\) process\.stderr\.write/u);
  assert.doesNotMatch(cli.slice(cli.indexOf("function reportBenchLifecycle")), /machineSlotsDirectory|tmpdir/u, "the shared machine path is never emitted by lifecycle output");
});
