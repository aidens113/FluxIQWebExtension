// `pnpm lab:campaign` end to end: the entry point spawned against a stub catalog and a stub Lab.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { CATALOG, REPAIR_LIMIT_ARGS, REPAIRS } from "./tasks.mjs";
import { withTemp } from "./temp-directory.mjs";

/** The one stub scenario that declares replay secrets, shaped like sensitive-input: typed on the primary script, run with a workflow that types neither. */
const MANIFESTS = [{
  id: "sensitive-input",
  recordingScript: [{ id: "replace-password", operation: "type", target: "testid:password", value: "fixture-password" }, { id: "replace-payment", operation: "type", target: "testid:payment", value: "fixture-card" }],
  workflows: [{ id: "extract-card-secrets", recordingScript: [{ id: "cards", operation: "checkpoint" }] }],
  secrets: [{ id: "sensitive-input-password", step: "replace-password" }, { id: "sensitive-input-payment", step: "replace-payment" }],
}];

const CAMPAIGN = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "live-campaign.mjs");

function runCli(args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CAMPAIGN, ...args], { env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (code) => resolve({ code, stdout, stderr }));
  });
}

async function writeStubCatalog(directory) {
  const file = path.join(directory, "catalog.mjs");
  await writeFile(file, `export const LIVE_INSTRUCTION_TASKS = ${JSON.stringify(CATALOG)};\nexport const LIVE_REPAIR_TASKS = ${JSON.stringify(REPAIRS)};\nexport const listScenarioManifests = () => ${JSON.stringify(MANIFESTS)};\n`);
  return file;
}

/** A stand-in for run-lab.mjs: records that it ran and what it saw, then prints a passed run. */
async function writeStubLab(directory) {
  const file = path.join(directory, "stub-lab.mjs");
  await writeFile(file, [
    "import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';",
    "import path from 'node:path';",
    `const directory = ${JSON.stringify(directory)};`,
    "appendFileSync(path.join(directory, 'invocations.ndjson'), JSON.stringify({ args: process.argv.slice(2), concurrency: process.env.npm_config_workspace_concurrency, secrets: Object.fromEntries(Object.entries(process.env).filter(([key]) => key.startsWith('FLUXIQ_TEST_SECRET_'))) }) + '\\n');",
    "const run = path.join(directory, 'run-stub');",
    "mkdirSync(run, { recursive: true });",
    "writeFileSync(path.join(run, 'evaluation.json'), JSON.stringify({ flowCreated: true, oracleVerdict: 'passed', actions: [{ actionType: 'web.dom.click' }], extraction: null, llm: { calls: 1 } }));",
    "process.stdout.write(JSON.stringify({ runId: 'run-stub', verdict: 'passed', path: run }) + '\\n');",
  ].join("\n"));
  return file;
}

test("the command line: a repair dry run prints the adapt commands and runs nothing", () => withTemp(async (directory) => {
  const env = { FLUXIQ_LAB_CAMPAIGN_CATALOG: await writeStubCatalog(directory), FLUXIQ_LAB_CAMPAIGN_LAB_SCRIPT: await writeStubLab(directory), FLUXIQ_TEST_RUNS_DIR: directory };
  const dry = await runCli(["--kind", "repair", "--dry-run"], env);
  assert.equal(dry.code, 0, dry.stderr);
  const limits = REPAIR_LIMIT_ARGS.join(" ");
  assert.deepEqual(dry.stdout.trim().split("\n").filter((line) => !line.startsWith("#")), [
    `pnpm lab run identity-drift --variant renamed-redesign --flow --live-llm --llm-profile lab-adapt-repair --llm-provider deepseek --llm-model deepseek-flash --llm-task adapt ${limits}`,
    `pnpm lab run identity-drift --variant save-and-exit --flow --live-llm --llm-profile lab-adapt-repair --llm-provider deepseek --llm-model deepseek-flash --llm-task adapt ${limits}`,
    `pnpm lab run sensitive-input --workflow extract-card-secrets --flow --live-llm --llm-profile lab-adapt-repair --llm-provider deepseek --llm-model deepseek-flash --llm-task adapt ${limits}`,
  ]);
  const every = await runCli(["--dry-run"], env);
  assert.equal(every.stdout.trim().split("\n").filter((line) => !line.startsWith("#")).length, CATALOG.length + REPAIRS.length);
  await assert.rejects(stat(path.join(directory, "invocations.ndjson")), { code: "ENOENT" });
  await assert.rejects(stat(path.join(directory, "campaigns")), { code: "ENOENT" });
}));

test("the command line refuses a catalog that files a task under the wrong list, or uses an id twice", () => withTemp(async (directory) => {
  const catalog = async (name, creations, repairs) => {
    const file = path.join(directory, `${name}.mjs`);
    await writeFile(file, `export const LIVE_INSTRUCTION_TASKS = ${JSON.stringify(creations)};\n${repairs === undefined ? "" : `export const LIVE_REPAIR_TASKS = ${JSON.stringify(repairs)};\n`}`);
    return { FLUXIQ_LAB_CAMPAIGN_CATALOG: file, FLUXIQ_LAB_CAMPAIGN_LAB_SCRIPT: path.join(directory, "absent-lab.mjs"), FLUXIQ_TEST_RUNS_DIR: directory };
  };
  const misfiled = await runCli(["--dry-run"], await catalog("misfiled", [...CATALOG, REPAIRS[0]], []));
  assert.equal(misfiled.code, 1);
  assert.match(misfiled.stderr, /wrong list for their kind: drift-repair/u);
  const repeated = await runCli(["--dry-run"], await catalog("repeated", CATALOG, [{ ...REPAIRS[1], id: "form-goal" }]));
  assert.equal(repeated.code, 1);
  assert.match(repeated.stderr, /used twice across the catalog: form-goal/u);
  const missing = await runCli(["--dry-run"], await catalog("missing", CATALOG));
  assert.equal(missing.code, 1);
  assert.match(missing.stderr, /exports no LIVE_REPAIR_TASKS/u);
}));

test("the command line: a dry run prints commands and runs nothing", () => withTemp(async (directory) => {
  const env = { FLUXIQ_LAB_CAMPAIGN_CATALOG: await writeStubCatalog(directory), FLUXIQ_LAB_CAMPAIGN_LAB_SCRIPT: await writeStubLab(directory), FLUXIQ_TEST_RUNS_DIR: directory };
  const dry = await runCli(["--dry-run", "--kind", "extract"], env);
  assert.equal(dry.code, 0, dry.stderr);
  const commands = dry.stdout.trim().split("\n").filter((line) => !line.startsWith("#"));
  assert.deepEqual(commands, [
    "pnpm lab run data-table --live-llm --llm-profile lab-create-flow --llm-provider deepseek --llm-model deepseek-flash --llm-task create-flow --instruction-task table-read --llm-max-input-tokens 48000 --llm-max-output-tokens 8000 --llm-max-total-tokens 56000 --llm-max-calls 48 --llm-max-run-tokens 600000 --llm-max-cost-usd 0.25",
    "pnpm lab run data-table --variant column-reorder --live-llm --llm-profile lab-create-flow --llm-provider deepseek --llm-model deepseek-flash --llm-task create-flow --instruction-task table-read-reordered --llm-max-input-tokens 48000 --llm-max-output-tokens 8000 --llm-max-total-tokens 56000 --llm-max-calls 48 --llm-max-run-tokens 600000 --llm-max-cost-usd 0.25",
  ]);
  await assert.rejects(stat(path.join(directory, "invocations.ndjson")), { code: "ENOENT" });
  await assert.rejects(stat(path.join(directory, "campaigns")), { code: "ENOENT" });

  const unselected = await runCli([], env);
  assert.equal(unselected.code, 1);
  assert.match(unselected.stderr, /needs a selection/u);
  await assert.rejects(stat(path.join(directory, "invocations.ndjson")), { code: "ENOENT" });
}));

test("the command line: a live campaign spawns the Lab once per task and writes the summary under the runs directory", () => withTemp(async (directory) => {
  const env = { FLUXIQ_LAB_CAMPAIGN_CATALOG: await writeStubCatalog(directory), FLUXIQ_LAB_CAMPAIGN_LAB_SCRIPT: await writeStubLab(directory), FLUXIQ_TEST_RUNS_DIR: directory, npm_config_workspace_concurrency: "8" };
  const live = await runCli(["form-goal", "table-read", "--", "--llm-max-cost-usd", "0.1"], env);
  assert.equal(live.code, 0, live.stderr);
  const invocations = (await readFile(path.join(directory, "invocations.ndjson"), "utf8")).trim().split("\n").map((line) => JSON.parse(line));
  // By name, not by position: a creation run now carries its token limits after
  // the instruction task, so counting back from the end names a limit instead.
  assert.deepEqual(invocations.map(({ args }) => args[args.indexOf("--instruction-task") + 1]), ["form-goal", "table-read"]);
  assert.deepEqual(invocations.map(({ args }) => args.slice(-2)), [["--llm-max-cost-usd", "0.1"], ["--llm-max-cost-usd", "0.1"]]);
  assert.deepEqual(invocations.map(({ concurrency }) => concurrency), ["1", "1"]);

  const [campaign] = await readdir(path.join(directory, "campaigns"));
  const summary = JSON.parse(await readFile(path.join(directory, "campaigns", campaign, "summary.json"), "utf8"));
  assert.deepEqual(summary.tasks.map((row) => [row.taskId, row.runId, row.verdict, row.flowCreated, row.providerCalls]), [["form-goal", "run-stub", "passed", true, 1], ["table-read", "run-stub", "passed", true, 1]]);
  assert.equal(summary.tasks[1].judgement.passed, null, "extraction not measured is not a pass");
  await stat(path.join(directory, "campaigns", campaign, "summary.md"));
  await stat(path.join(directory, "campaigns", campaign, "logs", "form-goal.attempt-1.log"));
  assert.match(live.stdout.trim().split("\n").at(-1), /"passed":2/u);
}));

test("the command line refuses an unknown task before running anything", () => withTemp(async (directory) => {
  await mkdir(path.join(directory, "empty"));
  const env = { FLUXIQ_LAB_CAMPAIGN_CATALOG: await writeStubCatalog(directory), FLUXIQ_LAB_CAMPAIGN_LAB_SCRIPT: await writeStubLab(directory), FLUXIQ_TEST_RUNS_DIR: path.join(directory, "empty") };
  const refused = await runCli(["no-such-task"], env);
  assert.equal(refused.code, 1);
  assert.match(refused.stderr, /Unknown task id no-such-task/u);
  assert.deepEqual(await readdir(path.join(directory, "empty")), []);
}));

test("the command line gives each run its scenario's fixture secrets, drops the machine's, and a dry run names them without their values", () => withTemp(async (directory) => {
  const env = { FLUXIQ_LAB_CAMPAIGN_CATALOG: await writeStubCatalog(directory), FLUXIQ_LAB_CAMPAIGN_LAB_SCRIPT: await writeStubLab(directory), FLUXIQ_TEST_RUNS_DIR: directory, FLUXIQ_TEST_SECRET_SENSITIVE_INPUT_PASSWORD: "machine-value", FLUXIQ_TEST_SECRET_ANYTHING: "machine-value" };
  const leaked = /fixture-password|fixture-card|machine-value/u;
  const dry = await runCli(["--dry-run", "secrets-refuse", "form-goal"], env);
  assert.equal(dry.code, 0, dry.stderr);
  const lines = dry.stdout.trim().split("\n");
  const secretsAt = lines.findIndex((line) => line.startsWith("pnpm lab run sensitive-input "));
  assert.equal(lines[secretsAt + 1], "#   with FLUXIQ_TEST_SECRET_SENSITIVE_INPUT_PASSWORD, FLUXIQ_TEST_SECRET_SENSITIVE_INPUT_PAYMENT from the sensitive-input fixture");
  assert.equal(lines[lines.findIndex((line) => line.startsWith("pnpm lab run instruction-only-form ")) + 1], undefined, "a scenario with no secrets gets no note");
  assert.equal(leaked.test(dry.stdout + dry.stderr), false, "a dry run prints names, never values");

  const live = await runCli(["secrets-refuse", "form-goal"], env);
  // 1: the stub's bundle holds no recovery record, so the repair task is not judged a success; both tasks still ran.
  assert.equal(live.code, 1, live.stderr);
  assert.doesNotMatch(live.stderr, /campaign\.usage/u);
  const invocations = (await readFile(path.join(directory, "invocations.ndjson"), "utf8")).trim().split("\n").map((line) => JSON.parse(line));
  assert.deepEqual(invocations.map(({ secrets }) => secrets), [
    { FLUXIQ_TEST_SECRET_SENSITIVE_INPUT_PASSWORD: "fixture-password", FLUXIQ_TEST_SECRET_SENSITIVE_INPUT_PAYMENT: "fixture-card" },
    {},
  ]);
  assert.equal(leaked.test(live.stdout + live.stderr), false, "the campaign prints no secret value");
}));
