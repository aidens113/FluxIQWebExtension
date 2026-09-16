import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { labRunArguments, parseCampaignArgs, ramFaultSignature, renderSummaryMarkdown, runCampaign, selectTasks, summarizeTask } from "../live-campaign.mjs";

const CAMPAIGN = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "live-campaign.mjs");

const CATALOG = Object.freeze([
  { id: "form-goal", scenarioId: "instruction-only-form", kind: "form", instruction: "Submit the form as Ada.", judgeBy: "playback-goal" },
  { id: "table-read", scenarioId: "data-table", kind: "extract", instruction: "Scrape the table.", judgeBy: "expected-dataset", expectedDatasetId: "extract-inventory" },
  { id: "table-read-reordered", scenarioId: "data-table", variantId: "column-reorder", kind: "extract", instruction: "Scrape the table.", judgeBy: "expected-dataset", expectedDatasetId: "extract-inventory" },
  { id: "catalog-pages", scenarioId: "product-catalog", kind: "navigate-and-extract", instruction: "Scrape every page.", judgeBy: "expected-dataset", expectedDatasetId: "extract-all-pages" },
]);

const resultLine = (fields) => `${JSON.stringify({ runId: "run-x", verdict: "passed", path: "test-runs/run-x", ...fields })}\n`;
const attempt = (fields = {}) => ({ code: 0, signal: null, stdout: "", stderr: "", ...fields });

async function withTemp(body) {
  const directory = await mkdtemp(path.join(tmpdir(), "fluxiq-live-campaign-"));
  try { return await body(directory); } finally { await rm(directory, { recursive: true, force: true }); }
}

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
  await writeFile(file, `export const LIVE_INSTRUCTION_TASKS = ${JSON.stringify(CATALOG)};\n`);
  return file;
}

/** A stand-in for run-lab.mjs: records that it ran and what it saw, then prints a passed run. */
async function writeStubLab(directory) {
  const file = path.join(directory, "stub-lab.mjs");
  await writeFile(file, [
    "import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';",
    "import path from 'node:path';",
    `const directory = ${JSON.stringify(directory)};`,
    "appendFileSync(path.join(directory, 'invocations.ndjson'), JSON.stringify({ args: process.argv.slice(2), concurrency: process.env.npm_config_workspace_concurrency }) + '\\n');",
    "const run = path.join(directory, 'run-stub');",
    "mkdirSync(run, { recursive: true });",
    "writeFileSync(path.join(run, 'evaluation.json'), JSON.stringify({ flowCreated: true, oracleVerdict: 'passed', actions: [{ actionType: 'web.dom.click' }], extraction: null, llm: { calls: 1 } }));",
    "process.stdout.write(JSON.stringify({ runId: 'run-stub', verdict: 'passed', path: run }) + '\\n');",
  ].join("\n"));
  return file;
}

test("arguments: defaults, ids, kinds, limits and the Lab passthrough", () => {
  const defaults = parseCampaignArgs([]);
  assert.deepEqual({ ...defaults }, { taskIds: [], kinds: [], all: false, limit: undefined, dryRun: false, build: true, maxAttempts: 3, profile: "lab-create-flow", provider: "deepseek", model: "deepseek-chat", output: undefined, labArgs: [], help: false });
  assert.deepEqual(parseCampaignArgs(["table-read", "form-goal"]).taskIds, ["table-read", "form-goal"]);
  const parsed = parseCampaignArgs(["--kind", "extract,form", "--limit", "2", "--dry-run", "--max-attempts", "2", "--", "--llm-max-cost-usd", "0.25"]);
  assert.deepEqual([parsed.kinds, parsed.limit, parsed.dryRun, parsed.maxAttempts, parsed.labArgs], [["extract", "form"], 2, true, 2, ["--llm-max-cost-usd", "0.25"]]);
  assert.throws(() => parseCampaignArgs(["--kind", "scrape"]), /Unknown --kind scrape/u);
  assert.throws(() => parseCampaignArgs(["table-read", "--kind", "extract"]), /not by more than one/u);
  assert.throws(() => parseCampaignArgs(["--kind", "extract", "--all"]), /drop --all/u);
  assert.throws(() => parseCampaignArgs(["--target", "isolated"]), /Lab options go after --/u);
  assert.throws(() => parseCampaignArgs(["--", "--variant", "x"]), /sets --variant itself/u);
  assert.throws(() => parseCampaignArgs(["--", "--llm-task", "adapt"]), /sets --llm-task itself/u);
  assert.throws(() => parseCampaignArgs(["--max-attempts", "9"]), /from 1 to 5/u);
  assert.throws(() => parseCampaignArgs(["--limit"]), /requires a value/u);
  assert.throws(() => parseCampaignArgs(["Table_Read"]), /not kebab-case/u);
});

test("selection: ids keep their order, kinds keep catalog order, and a live run must choose", () => {
  const base = { taskIds: [], kinds: [], all: false, dryRun: false };
  assert.deepEqual(selectTasks(CATALOG, { ...base, taskIds: ["catalog-pages", "form-goal"] }).map(({ id }) => id), ["catalog-pages", "form-goal"]);
  assert.deepEqual(selectTasks(CATALOG, { ...base, kinds: ["extract"] }).map(({ id }) => id), ["table-read", "table-read-reordered"]);
  assert.deepEqual(selectTasks(CATALOG, { ...base, all: true, limit: 2 }).map(({ id }) => id), ["form-goal", "table-read"]);
  assert.equal(selectTasks(CATALOG, { ...base, dryRun: true }).length, CATALOG.length);
  assert.throws(() => selectTasks(CATALOG, base), /needs a selection/u);
  assert.throws(() => selectTasks(CATALOG, { ...base, taskIds: ["nope"] }), /Unknown task id nope/u);
  assert.throws(() => selectTasks(CATALOG, { ...base, kinds: ["navigate"] }), /matches no task/u);
});

test("each task becomes one create-flow Lab run naming its scenario, variant and catalog id", () => {
  const options = parseCampaignArgs(["--llm-profile", "p", "--", "--target", "persistent-isolated"]);
  assert.deepEqual(labRunArguments(CATALOG[2], options), [
    "run", "data-table", "--variant", "column-reorder",
    "--live-llm", "--llm-profile", "p", "--llm-provider", "deepseek", "--llm-model", "deepseek-chat",
    "--llm-task", "create-flow", "--instruction-task", "table-read-reordered", "--target", "persistent-isolated",
  ]);
  assert.equal(labRunArguments(CATALOG[0], options).includes("--variant"), false);
});

test("RAM-fault signatures are recognised, and a real outcome never is", () => {
  assert.equal(ramFaultSignature(attempt({ code: 3221225477 })), "exit 3221225477 (access violation)");
  assert.equal(ramFaultSignature(attempt({ code: -1073741819 })), "exit 3221225477 (access violation)");
  assert.equal(ramFaultSignature(attempt({ code: 1, stderr: "ELIFECYCLE Command failed with exit code 3221225477." })), "exit 3221225477 (access violation)");
  assert.equal(ramFaultSignature(attempt({ code: 139 })), "segmentation fault");
  assert.equal(ramFaultSignature(attempt({ code: null, signal: "SIGSEGV" })), "segmentation fault");
  assert.equal(ramFaultSignature(attempt({ code: 1, stderr: "bash: line 1: 4242 Segmentation fault node x" })), "segmentation fault");
  assert.equal(ramFaultSignature(attempt({ code: 1, stderr: '{"status":"failed","category":"process.startup","message":"core-web-build exited"}' })), "process.startup facility failure");
  assert.equal(ramFaultSignature(attempt({ code: 1, stdout: resultLine({ verdict: "failed", failureCategory: "process.startup" }) })), "process.startup facility failure");
  const pnpmCrash = "C:\\Users\\me\\AppData\\Local\\pnpm\\9.15.0\\dist\\pnpm.cjs:1204\n  bunction x() {\n  ^^^^^^^^\nSyntaxError: Unexpected identifier 'bunction'";
  assert.equal(ramFaultSignature(attempt({ code: 1, stderr: pnpmCrash })), "error inside pnpm's own code");

  // Real outcomes: a reported run, whatever else the output holds, and ordinary failures.
  assert.equal(ramFaultSignature(attempt({ stdout: resultLine({}) })), null);
  assert.equal(ramFaultSignature(attempt({ code: 1, stdout: resultLine({ verdict: "failed", failureCategory: "runtime.behavior" }), stderr: "Segmentation fault" })), null);
  assert.equal(ramFaultSignature(attempt({ code: 3221225477, stdout: resultLine({ verdict: "failed" }) })), null);
  assert.equal(ramFaultSignature(attempt({ code: 1, stderr: '{"status":"failed","category":"environment.missing","message":"Unknown option --instruction-task"}' })), null);
  assert.equal(ramFaultSignature(attempt({ code: 1, stderr: "ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL tsc exited 2\nTypeError in src/app.ts" })), null);
  assert.equal(ramFaultSignature(attempt({ code: 1, stderr: "wrote 13221225477 bytes; id 32212254770" })), null);
});

test("a row reports provider-reported spend only, codes only, and the judgement its task asks for", () => {
  const bundle = {
    evaluation: {
      flowCreated: true, oracleVerdict: "failed", failureCategory: undefined,
      automationFailureReported: { category: "output_not_observed", code: "web.extract.empty" },
      actions: [{ actionType: "web.browser.navigate" }, { actionType: "web.dom.extract_list" }, { actionType: "web.browser.navigate" }],
      llm: { mode: "live", calls: 9 },
      extraction: [{ status: "judged", expectedRecords: 12, observedRecords: 12, matchedRecords: 12, recordsListed: true }],
      harnessRecovery: { interventions: [{ validationCodes: ["diagnosis.schema_invalid"] }], runtimePatchAttempts: [{ issueCodes: ["runtime_patch.target_override_rejected"] }] },
    },
    run: null,
    liveLlm: { observed: { calls: 3, totalEstimatedCostUsd: 9.99, accounting: { totalTokens: 999999, estimatedCostUsd: 9.99 }, observedCalls: [
      { totalTokens: 1000, estimatedCostUsd: 0.001, validationCodes: [] },
      { totalTokens: null, inputTokens: 200, outputTokens: 50, estimatedCostUsd: 0.0002, validationCodes: ["llm.provider_configuration_invalid"] },
      { totalTokens: null, inputTokens: null, outputTokens: null, estimatedCostUsd: null, validationCodes: ["Free text with page data", "llm.provider_configuration_invalid"] },
    ] } },
    flowLane: { proposalIssues: ["mapper.unmapped_input", "a sentence that is not a code"], failure: { code: "web.extract.empty" } },
  };
  const row = summarizeTask(CATALOG[1], [{ attempt: 1, exitCode: 1, ramFault: null }], attempt({ code: 1, stdout: resultLine({ verdict: "failed" }) }), bundle);
  assert.equal(row.verdict, "failed");
  assert.equal(row.flowCreated, true);
  assert.deepEqual(row.actionTypes, ["web.browser.navigate", "web.dom.extract_list"]);
  assert.equal(row.providerCalls, 3);
  assert.equal(row.reportedTokens, 1250, "reported per-call totals, never Core's accounting");
  assert.equal(row.reportedCostUsd, 0.0012, "reported per-call cost, never the charged total");
  assert.equal(row.callsWithoutReportedTokens, 1);
  assert.equal(row.judgement.passed, true, "a dataset task is judged by its dataset, not by the oracle");
  assert.equal(row.judgement.oracleVerdict, "failed");
  assert.equal(row.automationFailure, "output_not_observed/web.extract.empty");
  assert.deepEqual(row.issueCodes, ["diagnosis.schema_invalid", "llm.provider_configuration_invalid", "mapper.unmapped_input", "runtime_patch.target_override_rejected", "web.extract.empty"]);

  const goal = summarizeTask(CATALOG[0], [], attempt({ stdout: resultLine({}) }), bundle);
  assert.equal(goal.judgement.passed, false, "a goal task is judged by the oracle");
  assert.equal(goal.judgement.dataset, null);

  const noSteps = summarizeTask(CATALOG[1], [], attempt({ stdout: resultLine({}) }), { ...bundle, evaluation: { ...bundle.evaluation, extraction: [] } });
  assert.equal(noSteps.judgement.passed, false, "a created Flow with no extract step fails a dataset task");
  const miscounted = summarizeTask(CATALOG[1], [], attempt({ stdout: resultLine({}) }), { ...bundle, evaluation: { ...bundle.evaluation, extraction: [{ status: "judged", expectedRecords: 12, observedRecords: 12, matchedRecords: 11, recordsListed: true }] } });
  assert.equal(miscounted.judgement.passed, false);
  const unmeasured = summarizeTask(CATALOG[1], [], attempt({ code: 1 }), { evaluation: null, run: null, liveLlm: null, flowLane: null });
  assert.deepEqual([unmeasured.verdict, unmeasured.judgement.passed, unmeasured.reportedTokens, unmeasured.reportedCostUsd, unmeasured.runId], ["no-result", null, null, null, null]);
});

test("a campaign runs tasks one at a time, retries only RAM faults, and writes its summary", () => withTemp(async (directory) => {
  const runPath = path.join(directory, "run-ok");
  const scripted = {
    "form-goal": [attempt({ code: 3221225477 }), attempt({ stdout: resultLine({ runId: "run-ok", path: runPath }) })],
    "table-read": [attempt({ code: 1, stdout: resultLine({ runId: "run-bad", verdict: "failed", failureCategory: "runtime.behavior", path: path.join(directory, "absent") }), stderr: "Segmentation fault" })],
    "table-read-reordered": [attempt({ code: 139 }), attempt({ code: 139 })],
    "catalog-pages": [attempt({ code: 1, stderr: '{"status":"failed","category":"environment.missing","message":"Unknown option --instruction-task"}' })],
  };
  const seen = [];
  let active = 0;
  const execute = async ({ args, env, logPath }) => {
    active += 1;
    assert.equal(active, 1, "never two Lab runs at once");
    const id = args[args.indexOf("--instruction-task") + 1];
    seen.push({ id, concurrency: env.npm_config_workspace_concurrency, logPath });
    await new Promise((resolve) => setTimeout(resolve, 5));
    active -= 1;
    return scripted[id].shift();
  };
  const readBundle = async (target) => (target === runPath
    ? { evaluation: { flowCreated: true, oracleVerdict: "passed", actions: [{ actionType: "web.dom.type" }], extraction: null }, run: null, flowLane: null, liveLlm: { observed: { calls: 2, observedCalls: [{ totalTokens: 10, estimatedCostUsd: 0.5, validationCodes: [] }, { totalTokens: 5, estimatedCostUsd: 0.25, validationCodes: [] }] } } }
    : { evaluation: null, run: null, liveLlm: null, flowLane: null });
  const outputDir = path.join(directory, "campaigns", "2026-09-16T00-00-00-000Z");
  const lines = [];
  const summary = await runCampaign({ tasks: CATALOG, options: { ...parseCampaignArgs(["--all", "--max-attempts", "2"]) }, outputDir, execute, readBundle, log: (line) => lines.push(line) });

  assert.deepEqual(seen.map(({ id }) => id), ["form-goal", "form-goal", "table-read", "table-read-reordered", "table-read-reordered", "catalog-pages"]);
  assert.ok(seen.every(({ concurrency }) => concurrency === "1"));
  assert.deepEqual(summary.tasks.map((row) => [row.taskId, row.verdict, row.attempts, row.ramFaults]), [
    ["form-goal", "passed", 2, ["exit 3221225477 (access violation)"]],
    ["table-read", "failed", 1, []],
    ["table-read-reordered", "no-result", 2, ["segmentation fault", "segmentation fault"]],
    ["catalog-pages", "no-result", 1, []],
  ]);
  assert.equal(summary.tasks[0].judgement.passed, true);
  assert.equal(summary.tasks[1].failureCategory, "runtime.behavior");
  assert.equal(summary.tasks[2].failureCategory, "ram-fault: segmentation fault");
  assert.equal(summary.tasks[3].failureCategory, "environment.missing");
  assert.equal(summary.tasks[3].runnerMessage, "Unknown option --instruction-task");
  assert.deepEqual(summary.totals, { tasks: 4, passed: 1, failed: 1, noResult: 2, judgementsPassed: 1, providerCalls: 2, reportedTokens: 15, reportedCostUsd: 0.75 });
  assert.ok(summary.finishedAt);
  assert.ok(lines.some((line) => line.includes("retrying")) && lines.some((line) => line.includes("no attempts left")));

  const written = JSON.parse(await readFile(path.join(outputDir, "summary.json"), "utf8"));
  assert.deepEqual(written.tasks.map(({ taskId }) => taskId), CATALOG.map(({ id }) => id));
  const markdown = await readFile(path.join(outputDir, "summary.md"), "utf8");
  assert.equal(markdown, renderSummaryMarkdown(written));
  assert.match(markdown, /\*\*1 of 4 runs passed\*\*/u);
  assert.match(markdown, /\| form-goal \| instruction-only-form \| form \| run-ok \| passed \| yes \| web\.dom\.type \| playback goal \| yes \| 2 \| 15 \| 0\.75 \| — \| — \| 2 \(exit 3221225477 \(access violation\)\) \|/u);
  assert.match(markdown, /\| table-read-reordered \| data-table \/ column-reorder \|/u);
}));

test("the command line: a dry run prints commands and runs nothing", () => withTemp(async (directory) => {
  const env = { FLUXIQ_LAB_CAMPAIGN_CATALOG: await writeStubCatalog(directory), FLUXIQ_LAB_CAMPAIGN_LAB_SCRIPT: await writeStubLab(directory), FLUXIQ_TEST_RUNS_DIR: directory };
  const dry = await runCli(["--dry-run", "--kind", "extract"], env);
  assert.equal(dry.code, 0, dry.stderr);
  const commands = dry.stdout.trim().split("\n").filter((line) => !line.startsWith("#"));
  assert.deepEqual(commands, [
    "pnpm lab run data-table --live-llm --llm-profile lab-create-flow --llm-provider deepseek --llm-model deepseek-chat --llm-task create-flow --instruction-task table-read",
    "pnpm lab run data-table --variant column-reorder --live-llm --llm-profile lab-create-flow --llm-provider deepseek --llm-model deepseek-chat --llm-task create-flow --instruction-task table-read-reordered",
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
  assert.deepEqual(invocations.map(({ args }) => args.at(-3)), ["form-goal", "table-read"]);
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
