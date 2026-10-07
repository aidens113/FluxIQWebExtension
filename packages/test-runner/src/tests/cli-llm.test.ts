import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { runCli } from "../cli.js";
import { collectCoreWebBuildInputs, coreWebBuildKey, markBuildComplete, newBuildAttemptName, publishBuildAttempt } from "../core-web-build/index.js";
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
  const result = await liveRun(["run", "company-website"]);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /A live LLM run needs the Flow lane: pass --flow/u);
  assert.equal(result.stderr.includes("DEEPSEEK_API_KEY"), false);
});

test("runCli refuses a live Flow-lane run with no provider credential, naming what is missing", async () => {
  const result = await liveRun(["run", "company-website", "--flow"]);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /Live LLM execution needs a provider credential: DEEPSEEK_API_KEY is not set in the environment/u);
});

test("runCli refuses a live run whose budget could not authorize a call, before a credential is read", async () => {
  const result = await liveRun(["run", "company-website", "--flow", "--llm-max-cost-usd", "0"]);
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
 * build, finds the credential, resolves the instruction task against the run's
 * scenario lab build, prints what it would do, and exits. A stub build stands
 * in for the scenario lab, so these read no real catalog and no real key.
 */
const CREATE_FLOW = ["--live-llm", "--llm-profile", "lab-create-flow", "--llm-provider", "deepseek", "--llm-model", DEFAULT_LLM_MODEL, "--llm-task", "create-flow"];
const DUMMY_KEY = "dummy-provider-key-for-a-dry-run";
/** The stub catalog scenario under a realistic scenario's id: a Lab run refuses any scenario outside the ten (`realistic-scenarios/index.ts`). */
const REALISTIC = "everything-store";
const realisticCatalogScenario = { ...catalogScenario, id: REALISTIC, startPath: `/scenarios/${REALISTIC}/` };

async function stubLab(t: test.TestContext): Promise<{ root: string; env: NodeJS.ProcessEnv }> {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-create-flow-cli-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const dist = path.join(root, "scenario-lab-dist");
  await mkdir(path.join(dist, "scenarios"), { recursive: true });
  await writeFile(path.join(dist, "registry.js"), `export function listScenarioManifests() { return [${JSON.stringify(realisticCatalogScenario)}]; }\n`);
  await writeFile(path.join(dist, "scenarios", "live-instructions.js"), `export const LIVE_INSTRUCTION_TASKS = ${JSON.stringify([datasetTask({ scenarioId: REALISTIC }), datasetTask({ id: "catalog-reworded", scenarioId: REALISTIC, variantId: "text-variant" })])};\n`);
  // A stub Core holding only what a Core web build's key is computed from, so a dry run can report that build's key.
  const core = path.join(root, "core");
  const coreFiles: Record<string, string> = {
    "tsconfig.base.json": "{}\n",
    "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
    "apps/web/package.json": "{}\n",
    "apps/web/node_modules/next/package.json": JSON.stringify({ version: "15.5.24" }),
    ...Object.fromEntries(["client-gateway-websocket", "contracts", "fluxiq"].flatMap(name => [[`packages/${name}/package.json`, "{}\n"], [`packages/${name}/dist/index.js`, `${name}\n`]])),
  };
  for (const [relative, content] of Object.entries(coreFiles)) {
    const file = path.join(core, ...relative.split("/"));
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, content);
  }
  return { root, env: { FLUXIQ_WEB_EXTENSION_ROOT: root, FLUXIQ_TEST_ENV_FILES: "none", FLUXIQ_LAB_SCENARIO_ENTRYPOINT: path.join(dist, "server.js"), FLUXIQ_CORE_ROOT: core } };
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
  const noKey = await captureCli(["run", "everything-store", ...CREATE_FLOW, "--instruction-task", "catalog-first-page"], lab.env);
  assert.equal(noKey.code, 1);
  assert.match(noKey.stderr, /Live LLM execution needs a provider credential: DEEPSEEK_API_KEY is not set in the environment/u);
  assert.equal(noKey.stdout, "");
  const withFlow = await captureCli(["run", "everything-store", "--flow", ...CREATE_FLOW], { ...lab.env, DEEPSEEK_API_KEY: DUMMY_KEY });
  assert.equal(withFlow.code, 1);
  assert.match(withFlow.stderr, /drop --flow/u);
  // Neither refusal reached a run: nothing was written where runs go.
  await assert.rejects(access(path.join(lab.root, "test-runs")));
});

test("a create-flow dry run resolves the task, plans the build and starts nothing", async (t) => {
  const lab = await stubLab(t);
  const env = { ...lab.env, DEEPSEEK_API_KEY: DUMMY_KEY };
  // The whole per-request triple is typed, never two thirds of it: an input
  // limit left at the default while the total is lowered is refused, because
  // input plus output may not exceed the total.
  const result = await captureCli(["run", "everything-store", "--variant", "text-variant", ...CREATE_FLOW, "--instruction-task", "catalog-reworded", "--llm-max-input-tokens", "40000", "--llm-max-output-tokens", "6000", "--llm-max-total-tokens", "46000", "--dry-run"], env);
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
  const wrongVariant = await captureCli(["run", "everything-store", "--variant", "broken", ...CREATE_FLOW, "--instruction-task", "catalog-reworded", "--dry-run"], env);
  assert.equal(wrongVariant.code, 1);
  assert.match(wrongVariant.stderr, /names variant text-variant, not --variant broken/u);
  const unknownTask = await captureCli(["run", "everything-store", ...CREATE_FLOW, "--instruction-task", "no-such-task", "--dry-run"], env);
  assert.match(unknownTask.stderr, /"category":"fixture.invalid".*Unknown live instruction task: no-such-task/u);
});

test("a dry run reports the Core web build it would serve, and whether it is cached, without building or creating anything", async (t) => {
  const lab = await stubLab(t);
  const env = { ...lab.env, DEEPSEEK_API_KEY: DUMMY_KEY };
  const core = lab.env.FLUXIQ_CORE_ROOT!;
  const argv = ["run", "everything-store", ...CREATE_FLOW, "--instruction-task", "catalog-first-page", "--dry-run"];
  const cacheRoot = path.join(core, ".tmp", "core-web-build");
  const expectedKey = coreWebBuildKey((await collectCoreWebBuildInputs(core)).inputs);

  const cold = await captureCli(argv, env);
  assert.equal(cold.code, 0, cold.stderr);
  const coldPrinted = JSON.parse(cold.stdout) as Record<string, any>;
  assert.equal(coldPrinted.providerCallCount, 0);
  assert.deepEqual(coldPrinted.coreWeb, { key: expectedKey, cached: false });
  await assert.rejects(access(cacheRoot), "a dry run created no cache directory, lock or build");
  await assert.rejects(access(path.join(lab.root, "test-runs")), "a dry run wrote no run");

  // A complete, published build for that key is reported as cached, and the dry run still builds nothing.
  const keyDirectory = path.join(cacheRoot, expectedKey);
  const attempt = newBuildAttemptName();
  await mkdir(path.join(keyDirectory, attempt, "apps", "web", ".next"), { recursive: true });
  await writeFile(path.join(keyDirectory, attempt, "apps", "web", ".next", "BUILD_ID"), "stub-build\n");
  await markBuildComplete(path.join(keyDirectory, attempt), expectedKey, "stub-build");
  await publishBuildAttempt(keyDirectory, expectedKey, attempt);
  const warm = await captureCli(argv, env);
  assert.equal(warm.code, 0, warm.stderr);
  assert.deepEqual((JSON.parse(warm.stdout) as Record<string, any>).coreWeb, { key: expectedKey, cached: true });

  // A Core missing a build input refuses the dry run exactly as it would refuse the run.
  await rm(path.join(core, "pnpm-lock.yaml"));
  const missing = await captureCli(argv, env);
  assert.equal(missing.code, 1);
  assert.equal(missing.stdout, "");
  assert.match(missing.stderr, /"category":"environment.missing".*pnpm-lock\.yaml/u);
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

/**
 * Every Lab run, live or provider-free, opens only the ten realistic scenarios
 * (user rule, 2026-09-29). The runner's CLI refuses any other right after it
 * parses the command: before a live run is planned, a target resolved, a
 * topology, Core or browser started, or anything written under the run's root.
 */
const RULE = /every Lab or browser test run, live or provider-free, uses only the ten realistic scenarios \(user rule, 2026-09-29\): everything-store, crossborder-marketplace, bigbox-retail, job-board, local-classifieds, auction-marketplace, photo-social, social-network-feed, company-website, professional-network\./u;

async function refusedCli(argv: readonly string[]): Promise<{ code: number; stdout: string; stderr: string; written: string[] }> {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-cli-realistic-"));
  const stdout: string[] = [];
  const stderr: string[] = [];
  const originalOut = process.stdout.write;
  const originalErr = process.stderr.write;
  process.stdout.write = ((chunk: string | Uint8Array) => { stdout.push(String(chunk)); return true; }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: string | Uint8Array) => { stderr.push(String(chunk)); return true; }) as typeof process.stderr.write;
  try {
    const code = await runCli([...argv], { FLUXIQ_WEB_EXTENSION_ROOT: root, FLUXIQ_TEST_ENV_FILES: "none", FLUXIQ_CORE_ROOT: path.join(root, "no-core") });
    return { code, stdout: stdout.join(""), stderr: stderr.join(""), written: await readdir(root) };
  } finally {
    process.stdout.write = originalOut;
    process.stderr.write = originalErr;
    await rm(root, { recursive: true, force: true });
  }
}

test("run, interactive and replay refuse basic-form and product-catalog before anything starts", async () => {
  const commands = (scenario: string): string[][] => [
    ["run", scenario, "--flow"],
    ["run", scenario, "--flow", "--live-llm", "--llm-profile", "deepseek-lab", "--llm-provider", "deepseek", "--llm-task", "diagnose"],
    ["run", scenario, "--live-llm", "--llm-profile", "lab-create-flow", "--llm-provider", "deepseek", "--llm-task", "create-flow", "--instruction-task", "catalog-first-page", "--dry-run"],
    ["interactive", scenario],
    ["replay", scenario, "--workspace", "lane-a", "--flow", "flow.saved"],
  ];
  for (const scenario of ["basic-form", "product-catalog"]) {
    for (const argv of commands(scenario)) {
      const result = await refusedCli(argv);
      assert.equal(result.code, 1, argv.join(" "));
      assert.match(result.stderr, new RegExp(`lab ${argv[0]} refused ${scenario}: `, "u"));
      assert.match(result.stderr, RULE);
      assert.equal(result.stderr.includes("DEEPSEEK_API_KEY"), false, "refused before a live run was planned or a credential looked for");
      assert.equal(result.stdout, "", "a dry run on a refused scenario prints no plan");
      assert.deepEqual(result.written, [], "nothing was written under the run's root");
    }
  }
});

test("matrix refuses a scenario list holding one outside the ten, and bench refuses a corpus of them", async () => {
  const matrix = await refusedCli(["matrix", "--scenarios-json", JSON.stringify(["job-board", "basic-form"])]);
  assert.equal(matrix.code, 1);
  assert.match(matrix.stderr, /lab matrix refused basic-form: /u);
  assert.match(matrix.stderr, RULE);
  assert.deepEqual(matrix.written, []);
  // Every bench corpus today is built on the basic fixture scenarios, so a bench is refused outright.
  for (const corpus of ["smoke", "week1", "week2"]) {
    const bench = await refusedCli(["bench", "--corpus", corpus]);
    assert.equal(bench.code, 1, corpus);
    assert.match(bench.stderr, new RegExp(`lab bench --corpus ${corpus} refused `, "u"));
    assert.match(bench.stderr, RULE);
    assert.deepEqual(bench.written, []);
  }
});

test("a realistic scenario passes the guard and reaches the runner's own checks", async () => {
  for (const scenario of ["everything-store", "professional-network"]) {
    const result = await refusedCli(["run", scenario, "--flow", "--live-llm", "--llm-profile", "deepseek-lab", "--llm-provider", "deepseek", "--llm-task", "diagnose"]);
    assert.equal(result.code, 1);
    assert.doesNotMatch(result.stderr, RULE);
    assert.match(result.stderr, /DEEPSEEK_API_KEY is not set/u, "the next refusal is the live run's missing credential");
  }
});
