import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runCli } from "../cli.js";
import { coreWebBuildEnvironment, loadCoreWebBuildSeam } from "../core-web-build/index.js";
import { catalogScenario, datasetTask } from "../flow-lane/creation/tests/scenario-fixture.js";
import { DEFAULT_LLM_MODEL } from "@fluxiq-web-extension/test-contracts";

const sourceRoot = path.resolve(import.meta.dirname, "..", "..", "src");
/** The Core this package links: `<core>/packages/fluxiq/dist/index.js`, four levels up. */
const LINKED_CORE = path.resolve(fileURLToPath(import.meta.resolve("fluxiq")), "..", "..", "..", "..");
const source = (relative: string) => readFile(path.join(sourceRoot, relative), "utf8");

/**
 * Live LLM execution is no longer gated off; it is gated *closed*. These pin
 * the three refusals that stand between a command line and a provider call,
 * each of which happens before a topology or a browser starts: a live task that
 * ran only on the retired recording-built Flow lane, a live run with no
 * credential to use, and a budget that could not authorize a call.
 *
 * The second one deliberately names `DEEPSEEK_API_KEY`. Naming the variable is
 * how an operator learns what to set; the refusal carries no value, because at
 * that point there is none to carry.
 *
 * Since t519 (4ee4e65c) bare `--flow`, the Flow built from the run's own
 * recording, is retired and refused while the command is parsed, so the live
 * lane these refusals guard is the instruction-led one, `--llm-task
 * create-flow --instruction-task <task>`; the credential and budget refusals
 * still come before the task is resolved, so no scenario lab is needed here.
 */
const DIAGNOSE_TASK = ["--llm-profile", "deepseek-lab", "--llm-task", "diagnose"] as const;
const CREATE_FLOW_TASK = ["--llm-profile", "lab-create-flow", "--llm-task", "create-flow", "--instruction-task", "catalog-first-page"] as const;
const DEEPSEEK_MODEL = "deepseek-v4-pro";

test("runCli refuses a live diagnose run, which ran only on the retired recording-built Flow lane, before anything starts", async () => {
  const result = await liveRun(["run", "company-website"], DIAGNOSE_TASK);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /"category":"recording\.contract"/u);
  assert.match(result.stderr, /--llm-task diagnose ran against a Flow built from the run's recording[^"]*--llm-task create-flow --instruction-task <task>/u);
  assert.doesNotMatch(result.stderr, /pass --flow/u);
  assert.equal(result.stderr.includes("DEEPSEEK_API_KEY"), false);
});

test("runCli refuses a live Flow-lane run with no provider credential, naming what is missing", async () => {
  const result = await liveRun(["run", "company-website"]);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /Live LLM execution needs a provider credential: DEEPSEEK_API_KEY is not set in the environment/u);
});

test("runCli refuses a live run whose budget could not authorize a call, before a credential is read", async () => {
  const result = await liveRun(["run", "company-website", "--llm-max-cost-usd", "0"]);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /Live LLM execution refused: --llm-max-cost-usd 0 cannot authorize a live provider call/u);
  assert.equal(result.stderr.includes("DEEPSEEK_API_KEY"), false);
});

async function liveRun(argv: readonly string[], task: readonly string[] = CREATE_FLOW_TASK): Promise<{ code: number; stderr: string }> {
  const repositoryRoot = await mkdtemp(path.join(os.tmpdir(), "fluxiq-live-cli-gate-"));
  const stderr: string[] = [];
  const originalWrite = process.stderr.write;
  process.stderr.write = ((chunk: string | Uint8Array) => { stderr.push(String(chunk)); return true; }) as typeof process.stderr.write;
  try {
    const code = await runCli([
      ...argv, "--live-llm", "--llm-provider", "deepseek", "--llm-model", DEEPSEEK_MODEL, ...task,
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
const CREATE_FLOW = ["--live-llm", "--llm-profile", "lab-create-flow", "--llm-provider", "deepseek", "--llm-model", DEEPSEEK_MODEL, "--llm-task", "create-flow"];
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
  // A dry run reports the Core web build it would serve, which Core keys from
  // its own checkout (`<core>/scripts/web-build/`), so these runs name the real
  // Core this package links, with a cache of their own: nothing is built, and
  // nothing is written where a real run would look for a build.
  return { root, env: { FLUXIQ_WEB_EXTENSION_ROOT: root, FLUXIQ_TEST_ENV_FILES: "none", FLUXIQ_LAB_SCENARIO_ENTRYPOINT: path.join(dist, "server.js"), FLUXIQ_CORE_ROOT: LINKED_CORE, FLUXIQ_CORE_WEB_BUILD_CACHE: path.join(root, "web-build-cache") } };
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
  // t519 (4ee4e65c): `--flow` is refused as retired while the command is parsed; the create-flow plan's own "drop --flow", which nothing reached, is gone (t552).
  assert.match(withFlow.stderr, /"category":"recording\.contract".*Recording-only Flow creation is retired\./u);
  // Neither refusal reached a run: nothing was written where runs go.
  await assert.rejects(access(path.join(lab.root, "test-runs")));
});

test("a default-Claude dry run honors the caller's model, purse, mode and fake key with zero provider calls", async (t) => {
  const lab = await stubLab(t);
  const args = [
    "run", REALISTIC, "--live-llm", "--llm-profile", "lab-create-flow", "--llm-task", "create-flow",
    "--instruction-task", "catalog-first-page", "--llm-cost-ceiling-usd", "0.05",
    "--llm-max-cost-usd", "0.05", "--authoring-mode", "project", "--dry-run"
  ];
  const environment = { ...lab.env, CLAUDE_API_KEY: DUMMY_KEY, FLUXIQ_LLM_RUN_COST_CEILING_USD: "0.08" };
  const result = await captureCli(args, environment);
  assert.equal(result.code, 0, result.stderr);
  const printed = JSON.parse(result.stdout) as Record<string, any>;
  assert.equal(printed.status, "ready");
  assert.equal(printed.providerCallCount, 0);
  assert.equal(printed.live.provider, "anthropic");
  assert.equal(printed.live.model, DEFAULT_LLM_MODEL);
  assert.equal(printed.live.coreDefaultModel, DEFAULT_LLM_MODEL);
  assert.equal(printed.live.coreAuthoringMode, "project");
  assert.equal(printed.live.authorized.maxEstimatedCostUsd, 0.05);
  assert.equal(printed.live.authorized.maxTotalEstimatedCostUsd, 0.05);
  assert.match(printed.live.model, /^claude-/u);
  assert.deepEqual(printed.live.credentialSource, { name: "CLAUDE_API_KEY", from: "the process environment" });
  assert.equal(result.stdout.includes(DUMMY_KEY), false, "the dry run printed the credential");
  await assert.rejects(access(path.join(lab.root, "test-runs")), "a dry run wrote no run");
  const raised = await captureCli(args, { ...environment, FLUXIQ_LLM_RUN_COST_CEILING_USD: "0.04" });
  assert.equal(raised.code, 1);
  assert.match(raised.stderr, /cannot raise the configured Lab ceiling of \$0\.04/u);
  const aboveMax = [...args];
  aboveMax[aboveMax.indexOf("--llm-max-cost-usd") + 1] = "0.07";
  const refusedMax = await captureCli(aboveMax, environment);
  assert.equal(refusedMax.code, 1);
  assert.match(refusedMax.stderr, /--llm-max-cost-usd 0\.07 is above the per-build cost ceiling of \$0\.05/u);
  const lowerChatMax = [...args];
  lowerChatMax[lowerChatMax.indexOf("--llm-max-cost-usd") + 1] = "0.04";
  const refusedChatMax = await captureCli(lowerChatMax, environment);
  assert.equal(refusedChatMax.code, 1);
  assert.match(refusedChatMax.stderr, /cannot reach the Flow the chat makes/u);
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
  assert.equal(printed.live.model, DEEPSEEK_MODEL);
  assert.equal(printed.live.coreDefaultModel, DEEPSEEK_MODEL);
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
  const argv = ["run", "everything-store", ...CREATE_FLOW, "--instruction-task", "catalog-first-page", "--dry-run"];
  const cacheRoot = lab.env.FLUXIQ_CORE_WEB_BUILD_CACHE!;
  const seam = await loadCoreWebBuildSeam(LINKED_CORE);
  // The key a real preparation from this environment would build under: Core's, over the Lab's scrubbed environment.
  const expected = await seam.inspectWebBuild({ repoRoot: LINKED_CORE, cacheRoot, env: coreWebBuildEnvironment(env) });
  assert.match(expected.key, /^[0-9a-f]{24}$/u);

  const cold = await captureCli(argv, env);
  assert.equal(cold.code, 0, cold.stderr);
  const coldPrinted = JSON.parse(cold.stdout) as Record<string, any>;
  assert.equal(coldPrinted.providerCallCount, 0);
  assert.deepEqual(coldPrinted.coreWeb, { key: expected.key, cached: false });
  await assert.rejects(access(cacheRoot), "a dry run created no cache directory, lock or build");
  await assert.rejects(access(path.join(lab.root, "test-runs")), "a dry run wrote no run");

  // A complete, published build for that key is reported as cached, and the dry run still builds nothing.
  const core = await import(pathToFileURL(path.join(LINKED_CORE, "scripts", "web-build", "index.mjs")).href) as {
    markBuildComplete(directory: string, key: string, buildId: string): Promise<void>;
    newBuildAttemptName(): string;
    publishBuildAttempt(keyDirectory: string, key: string, attempt: string): Promise<void>;
  };
  const keyDirectory = path.join(cacheRoot, expected.key);
  const attempt = core.newBuildAttemptName();
  const web = path.join(keyDirectory, attempt, "apps", "web");
  for (const [file, text] of [[".next/BUILD_ID", "stub-build\n"], [".server-runtime/client-gateway-server.mjs", "export {};\n"], [".server-runtime/client-gateway-server.mjs.identity.json", "{}\n"]] as const) {
    await mkdir(path.dirname(path.join(web, file)), { recursive: true });
    await writeFile(path.join(web, file), text);
  }
  await core.markBuildComplete(path.join(keyDirectory, attempt), expected.key, "stub-build");
  await core.publishBuildAttempt(keyDirectory, expected.key, attempt);
  const warm = await captureCli(argv, env);
  assert.equal(warm.code, 0, warm.stderr);
  assert.deepEqual((JSON.parse(warm.stdout) as Record<string, any>).coreWeb, { key: expected.key, cached: true });

  // A Core without the keyed web build refuses the dry run exactly as it would refuse the run.
  await mkdir(path.join(lab.root, "old-core", "apps", "web"), { recursive: true });
  await writeFile(path.join(lab.root, "old-core", "apps", "web", "package.json"), "{}\n");
  const missing = await captureCli(argv, { ...env, FLUXIQ_CORE_ROOT: path.join(lab.root, "old-core") });
  assert.equal(missing.code, 1);
  assert.equal(missing.stdout, "");
  assert.match(missing.stderr, /"category":"environment.missing".*scripts\/web-build\/index\.mjs/u);
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
  // Bare `--flow` is no longer among them: since t519 it is refused as retired while the command is parsed, before this guard.
  const commands = (scenario: string): string[][] => [
    ["run", scenario],
    ["run", scenario, "--live-llm", "--llm-profile", "lab-create-flow", "--llm-provider", "deepseek", "--llm-task", "create-flow", "--instruction-task", "catalog-first-page"],
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
  for (const corpus of ["smoke", "week1"]) {
    const bench = await refusedCli(["bench", "--corpus", corpus]);
    assert.equal(bench.code, 1, corpus);
    assert.match(bench.stderr, new RegExp(`lab bench --corpus ${corpus} refused `, "u"));
    assert.match(bench.stderr, RULE);
    assert.deepEqual(bench.written, []);
  }
  // week2 is retired (t559): it is refused for that, before its scenarios are looked at.
  const retired = await refusedCli(["bench", "--corpus", "week2"]);
  assert.equal(retired.code, 1);
  assert.match(retired.stderr, /Bench corpus week2 is retired: /u);
  assert.deepEqual(retired.written, []);
});

test("a realistic scenario passes the guard and reaches the runner's own checks", async () => {
  for (const scenario of ["everything-store", "professional-network"]) {
    const result = await refusedCli(["run", scenario, "--live-llm", "--llm-profile", "lab-create-flow", "--llm-provider", "deepseek", "--llm-task", "create-flow", "--instruction-task", "catalog-first-page"]);
    assert.equal(result.code, 1);
    assert.doesNotMatch(result.stderr, RULE);
    assert.match(result.stderr, /DEEPSEEK_API_KEY is not set/u, "the next refusal is the live run's missing credential");
  }
});
