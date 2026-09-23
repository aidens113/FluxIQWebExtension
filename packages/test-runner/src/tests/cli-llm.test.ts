import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { runCli } from "../cli.js";
import { catalogScenario, datasetTask } from "../flow-lane/creation/tests/scenario-fixture.js";
import { DEFAULT_LLM_MODEL } from "@fluxiq-web-extension/test-contracts";

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
      "--llm-provider", "deepseek", "--llm-model", DEFAULT_LLM_MODEL, "--llm-task", "diagnose",
    ], { FLUXIQ_WEB_EXTENSION_ROOT: repositoryRoot, FLUXIQ_TEST_ENV_FILES: "none" });
    return { code, stderr: stderr.join("") };
  } finally {
    process.stderr.write = originalWrite;
    await rm(repositoryRoot, { recursive: true, force: true });
  }
}

/**
 * The created-Flow lane is gated closed the same way, and it has a dry run
 * that proves a command would start without starting anything: it plans the
 * grant, finds the credential, resolves the instruction task against the run's
 * scenario lab build, prints what it would do, and exits. A stub build stands
 * in for the scenario lab, so these read no real catalog and no real key.
 */
const CREATE_FLOW = ["--live-llm", "--llm-profile", "lab-create-flow", "--llm-provider", "deepseek", "--llm-model", DEFAULT_LLM_MODEL, "--llm-task", "create-flow"];
const DUMMY_KEY = "dummy-provider-key-for-a-dry-run";

async function stubLab(t: test.TestContext): Promise<{ root: string; env: NodeJS.ProcessEnv }> {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-create-flow-cli-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const dist = path.join(root, "scenario-lab-dist");
  await mkdir(path.join(dist, "scenarios"), { recursive: true });
  await writeFile(path.join(dist, "registry.js"), `export function listScenarioManifests() { return [${JSON.stringify(catalogScenario)}]; }\n`);
  await writeFile(path.join(dist, "scenarios", "live-instructions.js"), `export const LIVE_INSTRUCTION_TASKS = ${JSON.stringify([datasetTask(), datasetTask({ id: "catalog-reworded", variantId: "text-variant" })])};\n`);
  return { root, env: { FLUXIQ_WEB_EXTENSION_ROOT: root, FLUXIQ_TEST_ENV_FILES: "none", FLUXIQ_LAB_SCENARIO_ENTRYPOINT: path.join(dist, "server.js") } };
}

async function captureCli(argv: readonly string[], env: NodeJS.ProcessEnv): Promise<{ code: number; stdout: string; stderr: string }> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const originalOut = process.stdout.write;
  const originalErr = process.stderr.write;
  process.stdout.write = ((chunk: string | Uint8Array) => { stdout.push(String(chunk)); return true; }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: string | Uint8Array) => { stderr.push(String(chunk)); return true; }) as typeof process.stderr.write;
  try {
    const code = await runCli([...argv], env);
    return { code, stdout: stdout.join(""), stderr: stderr.join("") };
  } finally {
    process.stdout.write = originalOut;
    process.stderr.write = originalErr;
  }
}

test("a create-flow run fails closed before anything starts: no credential, or a recorded Flow lane", async (t) => {
  const lab = await stubLab(t);
  const noKey = await captureCli(["run", "product-catalog", ...CREATE_FLOW, "--instruction-task", "catalog-first-page"], lab.env);
  assert.equal(noKey.code, 1);
  assert.match(noKey.stderr, /Live LLM execution needs a provider credential: DEEPSEEK_API_KEY is not set in the environment/u);
  assert.equal(noKey.stdout, "");
  const withFlow = await captureCli(["run", "product-catalog", "--flow", ...CREATE_FLOW], { ...lab.env, DEEPSEEK_API_KEY: DUMMY_KEY });
  assert.equal(withFlow.code, 1);
  assert.match(withFlow.stderr, /drop --flow/u);
  // Neither refusal reached a run: nothing was written where runs go.
  await assert.rejects(access(path.join(lab.root, "test-runs")));
});

test("a create-flow dry run resolves the task, plans the build grant and starts nothing", async (t) => {
  const lab = await stubLab(t);
  const env = { ...lab.env, DEEPSEEK_API_KEY: DUMMY_KEY };
  // The whole per-request triple is typed, never two thirds of it: an input
  // limit left at the default while the total is lowered is refused, because
  // input plus output may not exceed the total.
  const result = await captureCli(["run", "product-catalog", "--variant", "text-variant", ...CREATE_FLOW, "--instruction-task", "catalog-reworded", "--llm-max-input-tokens", "40000", "--llm-max-output-tokens", "6000", "--llm-max-total-tokens", "46000", "--dry-run"], env);
  assert.equal(result.code, 0, result.stderr);
  const printed = JSON.parse(result.stdout) as Record<string, any>;
  assert.equal(printed.status, "ready");
  assert.equal(printed.providerCallCount, 0);
  assert.equal(printed.lane, "created-flow");
  assert.equal(printed.target, "isolated");
  assert.equal(printed.request.taskId, "catalog-reworded");
  assert.equal(printed.request.variantId, "text-variant");
  assert.deepEqual(printed.request.judgement, { judgeBy: "expected-dataset", stepId: "extract-page-one", stepIndex: 1 });
  assert.equal(printed.live.purpose, "build_and_adapt");
  assert.equal(printed.live.authorized.maxCalls, 26);
  assert.deepEqual(printed.live.authorized.tokenLimits, { maxInputTokens: 40_000, maxOutputTokens: 6_000, maxTotalTokens: 46_000 });
  assert.deepEqual(printed.live.credentialSource, { name: "DEEPSEEK_API_KEY", from: "the process environment" });
  assert.equal(result.stdout.includes(DUMMY_KEY), false, "the dry run printed the credential");
  assert.equal(result.stdout.includes("Scrape"), false, "the dry run printed the instruction");
  await assert.rejects(access(path.join(lab.root, "test-runs")), "a dry run wrote no run");
  // The task's scenario and variant are held to the command's.
  const wrongVariant = await captureCli(["run", "product-catalog", "--variant", "broken", ...CREATE_FLOW, "--instruction-task", "catalog-reworded", "--dry-run"], env);
  assert.equal(wrongVariant.code, 1);
  assert.match(wrongVariant.stderr, /names variant text-variant, not --variant broken/u);
  const unknownTask = await captureCli(["run", "product-catalog", ...CREATE_FLOW, "--instruction-task", "no-such-task", "--dry-run"], env);
  assert.match(unknownTask.stderr, /"category":"fixture.invalid".*Unknown live instruction task: no-such-task/u);
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
  const benchBranch = cli.slice(cli.indexOf('if (command.command === "bench")'), cli.indexOf('if (command.command === "run")'));
  assert.equal(benchBranch.match(/loadScenarioManifests\(/gu)?.length, 1);
  assert.equal(benchBranch.match(/buildCampaignCompatibility\(/gu)?.length, 1);
  assert.equal(benchBranch.match(/const machineSlotsDirectory = path\.join\(os\.tmpdir\(\), "fluxiq-testing-lab-machine-slots"\);/gu)?.length, 1);
  assert.equal(benchBranch.match(/machineSlotsDirectory/gu)?.length, 3, "one definition is passed to sharded create and resume");
  assert.match(cli, /if \(record\.event === "created" \|\| record\.event === "resumed"\) process\.stderr\.write/u);
  assert.doesNotMatch(cli.slice(cli.indexOf("function reportBenchLifecycle")), /machineSlotsDirectory|tmpdir/u, "the shared machine path is never emitted by lifecycle output");
});
