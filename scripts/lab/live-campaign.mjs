#!/usr/bin/env node
// A live campaign: plain-English catalog tasks, run one at a time through the
// Lab's create-flow lane, with one summary table at the end.
//
//   pnpm lab:campaign --dry-run                    every task, commands only
//   pnpm lab:campaign --kind extract --limit 3     the first three scraping tasks
//   pnpm lab:campaign product-catalog-all-pages -- --llm-max-cost-usd 0.25
//
// Each task becomes `pnpm lab run <scenario> [--variant <v>] --live-llm ...
// --llm-task create-flow --instruction-task <id>`, spawned as
// `node scripts/lab/run-lab.mjs` with the same arguments, never in parallel and
// with npm_config_workspace_concurrency=1. The catalog is
// `apps/scenario-lab/src/scenarios/live-instructions.ts`, compiled into the Lab
// instance's scenario output first. A live run needs an explicit selection
// (task ids, --kind, or --all); a dry run defaults to every task.
//
// This machine has faulty RAM, so an attempt that died with one of its
// signatures (see `ramFaultSignature`) is retried up to --max-attempts. An
// attempt that reported a run outcome is never retried: that is a real result.
// Tokens and cost in the summary are what the provider reported per call,
// never Core's charged figures, which include reservations.

import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { withBuildLock } from "./build-lock.mjs";
import { repositoryRoot, resolveLabInstancePaths } from "./lab-instance.mjs";

const KINDS = ["form", "navigate", "extract", "navigate-and-extract"];
const KEBAB_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const CAMPAIGN_OWNED_OPTIONS = new Set(["--live-llm", "--llm-task", "--llm-profile", "--llm-provider", "--llm-model", "--instruction-task", "--variant", "--workflow"]);
const ISSUE_CODE = /^[a-z][a-z0-9_]*(?:[.:][a-z0-9_+-]+)+$/iu;
const PNPM_OWN_CODE = /[\\/]pnpm(?:[\\/][\d.]+)?[\\/](?:dist|bin|lib)[\\/][^\s:'"]*\.c?js/iu;
const JS_ERROR = /\b(?:SyntaxError|TypeError|ReferenceError|RangeError)\b/u;
const OUTPUT_TAIL_CHARS = 1_000_000;
const USAGE = "Usage: pnpm lab:campaign [task-id ...] [--kind KIND[,KIND]] [--all] [--limit N] [--dry-run] [--no-build] [--max-attempts N] [--llm-profile ID] [--llm-provider NAME] [--llm-model NAME] [--output DIR] [-- LAB-OPTIONS]";

/** @param {string[]} argv */
export function parseCampaignArgs(argv) {
  const options = { taskIds: [], kinds: [], all: false, limit: undefined, dryRun: false, build: true, maxAttempts: 3, profile: "lab-create-flow", provider: "deepseek", model: "deepseek-chat", output: undefined, labArgs: [], help: false };
  const value = (index, name) => { const next = argv[index + 1]; if (next === undefined || next.startsWith("--")) throw new Error(`${name} requires a value`); return next; };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") { options.labArgs = argv.slice(index + 1); break; }
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--no-build") options.build = false;
    else if (arg === "--all") options.all = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--kind") { options.kinds.push(...value(index, arg).split(",")); index += 1; }
    else if (arg === "--limit") { options.limit = boundedInteger(value(index, arg), arg, 1, 10_000); index += 1; }
    else if (arg === "--max-attempts") { options.maxAttempts = boundedInteger(value(index, arg), arg, 1, 5); index += 1; }
    else if (arg === "--llm-profile") { options.profile = value(index, arg); index += 1; }
    else if (arg === "--llm-provider") { options.provider = value(index, arg); index += 1; }
    else if (arg === "--llm-model") { options.model = value(index, arg); index += 1; }
    else if (arg === "--output") { options.output = value(index, arg); index += 1; }
    else if (arg.startsWith("-")) throw new Error(`Unknown option ${arg}; Lab options go after --`);
    else if (!KEBAB_ID.test(arg)) throw new Error(`Task id ${JSON.stringify(arg)} is not kebab-case`);
    else options.taskIds.push(arg);
  }
  const unknownKinds = options.kinds.filter((kind) => !KINDS.includes(kind));
  if (unknownKinds.length > 0) throw new Error(`Unknown --kind ${unknownKinds.join(", ")}; expected one of ${KINDS.join(", ")}`);
  if (options.taskIds.length > 0 && (options.kinds.length > 0 || options.all)) throw new Error("Select tasks by id, or by --kind, or with --all: not by more than one");
  if (options.kinds.length > 0 && options.all) throw new Error("--kind already selects; drop --all");
  const owned = options.labArgs.filter((arg) => CAMPAIGN_OWNED_OPTIONS.has(arg));
  if (owned.length > 0) throw new Error(`The campaign sets ${owned.join(", ")} itself, per task; remove it after --`);
  return options;
}

/**
 * The tasks a campaign runs, in catalog order for --kind and --all and in the
 * order given for ids. A live run with no selection is refused.
 *
 * @template {{ id: string, kind: string }} T
 * @param {readonly T[]} catalog
 * @param {{ taskIds: string[], kinds: string[], all: boolean, limit?: number, dryRun: boolean }} options
 * @returns {T[]}
 */
export function selectTasks(catalog, options) {
  const byId = new Map(catalog.map((task) => [task.id, task]));
  const unknown = options.taskIds.filter((id) => !byId.has(id));
  if (unknown.length > 0) throw new Error(`Unknown task id ${unknown.join(", ")}`);
  let selected;
  if (options.taskIds.length > 0) selected = [...new Set(options.taskIds)].map((id) => byId.get(id));
  else if (options.kinds.length > 0) selected = catalog.filter((task) => options.kinds.includes(task.kind));
  else if (options.all || options.dryRun) selected = [...catalog];
  else throw new Error("A live campaign needs a selection: task ids, --kind, or --all (a --dry-run shows every task)");
  const limited = options.limit === undefined ? selected : selected.slice(0, options.limit);
  if (limited.length === 0) throw new Error("The selection matches no task");
  return limited;
}

/** The Lab arguments for one task, after `pnpm lab`. */
export function labRunArguments(task, options) {
  return [
    "run", task.scenarioId, ...(task.variantId ? ["--variant", task.variantId] : []),
    "--live-llm", "--llm-profile", options.profile, "--llm-provider", options.provider, "--llm-model", options.model,
    "--llm-task", "create-flow", "--instruction-task", task.id, ...options.labArgs,
  ];
}

/**
 * Why an attempt should be retried as this machine's memory fault, or `null`
 * when it is a real outcome. An attempt that printed a run result is real
 * unless the runner itself classified it `process.startup`.
 *
 * @param {{ code: number | null, signal?: string | null, stdout: string, stderr: string }} attempt
 */
export function ramFaultSignature(attempt) {
  const result = parseLabResult(attempt.stdout);
  if (result && result.failureCategory !== "process.startup") return null;
  const output = `${attempt.stdout}\n${attempt.stderr}`;
  if ((result?.failureCategory ?? parseRunnerRefusal(attempt.stderr)?.category) === "process.startup") return "process.startup facility failure";
  if (attempt.code === 3221225477 || attempt.code === -1073741819 || /(?<![\d-])(?:3221225477|-1073741819)(?!\d)/u.test(output)) return "exit 3221225477 (access violation)";
  if (attempt.code === 139 || attempt.signal === "SIGSEGV" || /segmentation fault/iu.test(output)) return "segmentation fault";
  if (PNPM_OWN_CODE.test(output) && JS_ERROR.test(output)) return "error inside pnpm's own code";
  return null;
}

/**
 * One summary row: what the run did, read from its bundle. Counts, codes and
 * identifiers only -- no page data, prompt or response.
 */
export function summarizeTask(task, attempts, final, bundle) {
  const result = parseLabResult(final.stdout);
  const refusal = parseRunnerRefusal(final.stderr);
  const { evaluation, run, liveLlm, flowLane } = bundle;
  const calls = liveLlm?.observed?.observedCalls ?? [];
  const tokens = calls.map((call) => call.totalTokens ?? (call.inputTokens != null && call.outputTokens != null ? call.inputTokens + call.outputTokens : null)).filter((n) => typeof n === "number");
  const costs = calls.map((call) => call.estimatedCostUsd).filter((n) => typeof n === "number");
  const recovery = evaluation?.harnessRecovery ?? flowLane?.harnessRecovery ?? null;
  const automationFailure = evaluation?.automationFailureReported ?? run?.automationFailure ?? null;
  const oracleVerdict = evaluation?.oracleVerdict ?? result?.observation?.oracleVerdict ?? null;
  const dataset = task.judgeBy === "expected-dataset" ? datasetJudgement(evaluation?.extraction ?? result?.observation?.extraction ?? null) : null;
  const judged = dataset === null ? (oracleVerdict === null ? null : oracleVerdict === "passed") : dataset.passed;
  const lastFault = attempts.at(-1)?.ramFault ?? null;
  return {
    taskId: task.id, scenarioId: task.scenarioId, variantId: task.variantId ?? null, kind: task.kind,
    instruction: task.instruction, judgeBy: task.judgeBy, expectedDatasetId: task.expectedDatasetId ?? null,
    runId: result?.runId ?? null,
    verdict: result?.verdict ?? "no-result",
    exitCode: final.code,
    attempts: attempts.length,
    ramFaults: attempts.map((attempt) => attempt.ramFault).filter(Boolean),
    flowCreated: evaluation?.flowCreated ?? result?.observation?.flowCreated ?? (flowLane?.flowId ? true : null),
    actionTypes: distinct((evaluation?.actions ?? run?.actions ?? flowLane?.actions ?? []).map((action) => action.actionType)),
    judgement: { by: task.judgeBy, passed: judged, oracleVerdict, dataset },
    providerCalls: liveLlm?.observed?.calls ?? evaluation?.llm?.calls ?? null,
    reportedTokens: tokens.length === 0 ? null : tokens.reduce((sum, n) => sum + n, 0),
    reportedCostUsd: costs.length === 0 ? null : Number(costs.reduce((sum, n) => sum + n, 0).toFixed(8)),
    callsWithoutReportedTokens: calls.length - tokens.length,
    failureCategory: result?.failureCategory ?? evaluation?.failureCategory ?? refusal?.category ?? (lastFault ? `ram-fault: ${lastFault}` : null),
    automationFailure: automationFailure ? [automationFailure.category, automationFailure.code].filter(Boolean).join("/") : null,
    issueCodes: distinct([
      ...calls.flatMap((call) => call.validationCodes ?? []),
      ...(recovery?.interventions ?? []).flatMap((item) => item.validationCodes ?? []),
      ...(recovery?.runtimePatchAttempts ?? []).flatMap((item) => item.issueCodes ?? []),
      ...(flowLane?.proposalIssues ?? []),
      flowLane?.failure?.code, automationFailure?.code,
    ].filter((code) => typeof code === "string" && code.length <= 120 && ISSUE_CODE.test(code))).sort(),
    runPath: result?.path ?? null,
    runnerMessage: result ? null : shortMessage(refusal?.message),
  };
}

/** The campaign summary as Markdown: one line of totals, then one row per task. */
export function renderSummaryMarkdown(summary) {
  const t = summary.totals;
  const cell = (value) => (value === null || value === undefined || value === "" ? "—" : String(value).replace(/\|/gu, "\\|").replace(/\s+/gu, " "));
  const yesNo = (value) => (value === null ? "—" : value ? "yes" : "no");
  const lines = [
    `# Live campaign ${summary.campaignId}`, "",
    `Started ${summary.startedAt}, finished ${summary.finishedAt ?? "(in progress)"}. Lab: \`pnpm lab run ... --llm-task create-flow\`, profile \`${summary.options.profile}\`, ${summary.options.provider}/${summary.options.model}, up to ${summary.options.maxAttempts} attempt(s) per task.`, "",
    `**${t.passed} of ${t.tasks} runs passed** (${t.failed} failed, ${t.noResult} produced no result); ${t.judgementsPassed} judgement(s) passed. Provider calls ${t.providerCalls}; reported tokens ${t.reportedTokens}; reported cost $${t.reportedCostUsd.toFixed(6)} (reservations excluded).`, "",
    "| Task | Scenario / variant | Kind | Run | Verdict | Flow created | Action types | Judged by | Judgement | Calls | Tokens (reported) | Cost USD (reported) | Failure | Issue codes | Attempts |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const row of summary.tasks) {
    const judgedBy = row.judgeBy === "expected-dataset" ? `dataset ${row.expectedDatasetId}` : "playback goal";
    const failure = [row.failureCategory, row.automationFailure].filter(Boolean).join("; ");
    const attempts = row.ramFaults.length > 0 ? `${row.attempts} (${row.ramFaults.join(", ")})` : row.attempts;
    lines.push(`| ${[row.taskId, row.variantId ? `${row.scenarioId} / ${row.variantId}` : row.scenarioId, row.kind, row.runId, row.verdict, yesNo(row.flowCreated), row.actionTypes.join(", "), judgedBy, yesNo(row.judgement.passed), row.providerCalls, row.reportedTokens, row.reportedCostUsd, failure, row.issueCodes.join(", "), attempts].map(cell).join(" | ")} |`);
  }
  return `${lines.join("\n")}\n`;
}

/**
 * Runs `tasks` in order, one at a time, and writes the summary after each.
 * `execute` and `readBundle` are injected so the runner can be tested
 * against a stubbed Lab.
 */
export async function runCampaign({ tasks, options, outputDir, execute, readBundle = readRunBundle, log = (line) => process.stderr.write(`${line}\n`), now = () => new Date() }) {
  const summary = { schemaVersion: "0.1", campaignId: path.basename(outputDir), startedAt: now().toISOString(), finishedAt: null, options: { profile: options.profile, provider: options.provider, model: options.model, maxAttempts: options.maxAttempts, labArgs: options.labArgs }, environment: { npm_config_workspace_concurrency: "1", labInstance: process.env.FLUXIQ_LAB_INSTANCE?.trim() || null }, totals: totalsOf([]), tasks: [] };
  await mkdir(path.join(outputDir, "logs"), { recursive: true });
  for (const [position, task] of tasks.entries()) {
    const args = labRunArguments(task, options);
    const attempts = [];
    let final;
    for (let attempt = 1; attempt <= options.maxAttempts; attempt += 1) {
      log(`[campaign] ${position + 1}/${tasks.length} ${task.id}, attempt ${attempt}/${options.maxAttempts}: ${displayCommand(args)}`);
      final = await execute({ args, env: labEnvironment(process.env), logPath: path.join(outputDir, "logs", `${task.id}.attempt-${attempt}.log`) });
      const ramFault = ramFaultSignature(final);
      attempts.push({ attempt, exitCode: final.code, ramFault });
      if (ramFault === null) break;
      log(`[campaign] ${task.id}: attempt ${attempt} died with this machine's RAM-fault signature (${ramFault})${attempt < options.maxAttempts ? "; retrying" : "; no attempts left"}`);
    }
    const result = parseLabResult(final.stdout);
    const runPath = result?.path ? path.resolve(repositoryRoot, result.path) : null;
    const row = summarizeTask(task, attempts, final, runPath ? await readBundle(runPath) : EMPTY_BUNDLE);
    summary.tasks.push(row);
    summary.totals = totalsOf(summary.tasks);
    log(`[campaign] ${task.id}: ${row.verdict}${row.runId ? ` (${row.runId})` : ""}, judgement ${row.judgement.passed === null ? "not measured" : row.judgement.passed ? "passed" : "failed"}`);
    await writeSummary(outputDir, summary);
  }
  summary.finishedAt = now().toISOString();
  await writeSummary(outputDir, summary);
  return summary;
}

const EMPTY_BUNDLE = Object.freeze({ evaluation: null, run: null, liveLlm: null, flowLane: null });

async function readRunBundle(runPath) {
  const read = async (...parts) => { try { return JSON.parse(await readFile(path.join(runPath, ...parts), "utf8")); } catch { return null; } };
  return { evaluation: await read("evaluation.json"), run: await read("run.json"), liveLlm: await read("snapshots", "live-llm.json"), flowLane: await read("snapshots", "flow-lane.json") };
}

async function writeSummary(outputDir, summary) {
  await writeFile(path.join(outputDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  await writeFile(path.join(outputDir, "summary.md"), renderSummaryMarkdown(summary));
}

function totalsOf(rows) {
  const sum = (pick) => rows.reduce((total, row) => total + (pick(row) ?? 0), 0);
  return {
    tasks: rows.length,
    passed: rows.filter((row) => row.verdict === "passed").length,
    failed: rows.filter((row) => row.verdict === "failed" || row.verdict === "inconclusive").length,
    noResult: rows.filter((row) => row.verdict === "no-result").length,
    judgementsPassed: rows.filter((row) => row.judgement.passed === true).length,
    providerCalls: sum((row) => row.providerCalls),
    reportedTokens: sum((row) => row.reportedTokens),
    reportedCostUsd: Number(sum((row) => row.reportedCostUsd).toFixed(8)),
  };
}

/**
 * Passed when some extract step was judged and every judged step matched in
 * count and, where listed, in value. A `null` extraction was not measured;
 * `[]` was measured and found no extract step, which fails a dataset task.
 */
function datasetJudgement(extraction) {
  if (!Array.isArray(extraction)) return { passed: null, steps: null };
  const judged = extraction.filter((step) => step.status === "judged");
  const matched = (step) => step.observedRecords === step.expectedRecords && (!step.recordsListed || step.matchedRecords === step.expectedRecords);
  const passed = judged.length > 0 && extraction.every((step) => step.status !== "not_run") && judged.every(matched);
  return { passed, steps: extraction.map((step) => ({ status: step.status, expectedRecords: step.expectedRecords, observedRecords: step.observedRecords, matchedRecords: step.matchedRecords, recordsListed: step.recordsListed })) };
}

/** The Lab's own result: its last stdout line that is a run result. */
function parseLabResult(stdout) {
  return lastJsonLine(stdout, (value) => typeof value.runId === "string" && typeof value.verdict === "string");
}

/** The runner's refusal or facility failure, as the Lab prints it on stderr. */
function parseRunnerRefusal(stderr) {
  return lastJsonLine(stderr, (value) => value.status === "failed" && typeof value.category === "string");
}

function lastJsonLine(text, accept) {
  const lines = String(text ?? "").split(/\r?\n/u);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index].trim();
    if (!line.startsWith("{")) continue;
    try { const value = JSON.parse(line); if (value && typeof value === "object" && accept(value)) return value; } catch { /* not JSON */ }
  }
  return null;
}

function labEnvironment(env) {
  const next = Object.fromEntries(Object.entries(env).filter(([key]) => key.toLowerCase() !== "npm_config_workspace_concurrency"));
  return { ...next, npm_config_workspace_concurrency: "1" };
}

function displayCommand(args) {
  return `pnpm lab ${args.map((arg) => (/^[\w@%+=:,./-]+$/u.test(arg) ? arg : JSON.stringify(arg))).join(" ")}`;
}

function shortMessage(message) {
  if (typeof message !== "string") return null;
  return message.replace(/[A-Za-z0-9_-]{32,}/gu, "[redacted]").slice(0, 240);
}

function distinct(values) { return [...new Set(values.filter((value) => typeof value === "string"))]; }

function boundedInteger(text, name, min, max) {
  const parsed = Number(text);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) throw new Error(`${name} must be an integer from ${min} to ${max}`);
  return parsed;
}

function tail() {
  let text = "";
  return { push(chunk) { text = (text + chunk).slice(-OUTPUT_TAIL_CHARS); }, text: () => text };
}

function spawnLab(labScript) {
  return ({ args, env, logPath }) => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [labScript, ...args], { cwd: repositoryRoot, env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    const stdout = tail();
    const stderr = tail();
    child.stdout.on("data", (chunk) => { process.stdout.write(chunk); stdout.push(chunk.toString("utf8")); });
    child.stderr.on("data", (chunk) => { process.stderr.write(chunk); stderr.push(chunk.toString("utf8")); });
    child.once("error", reject);
    child.once("close", (code, signal) => {
      const attempt = { code, signal, stdout: stdout.text(), stderr: stderr.text() };
      writeFile(logPath, `# ${displayCommand(args)}\n# exit ${code ?? signal}\n\n## stdout\n${attempt.stdout}\n## stderr\n${attempt.stderr}`).then(() => resolve(attempt), reject);
    });
  });
}

function runNode(script, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], { cwd: repositoryRoot, env, stdio: "inherit", windowsHide: true });
    child.once("error", reject);
    child.once("close", (code, signal) => resolve({ code, signal, stdout: "", stderr: "" }));
  });
}

/** Compiles the scenario lab into this instance's output, under the Lab's build lock, and imports the catalog. */
async function loadCatalog(options) {
  const override = process.env.FLUXIQ_LAB_CAMPAIGN_CATALOG?.trim();
  const paths = resolveLabInstancePaths(process.env);
  const modulePath = override || path.join(paths.scenarioOutDir, "scenarios", "live-instructions.js");
  if (!override && options.build) {
    const env = { ...labEnvironment(process.env), FLUXIQ_LAB_SCENARIO_OUT_DIR: paths.scenarioOutDir };
    const builder = path.join(repositoryRoot, "apps", "scenario-lab", "scripts", "build-scenario-lab.mjs");
    await withBuildLock(paths.buildLockPath, async () => {
      for (let attempt = 1; ; attempt += 1) {
        const outcome = await runNode(builder, env);
        if (outcome.code === 0) return;
        const fault = ramFaultSignature(outcome);
        if (fault === null || attempt >= options.maxAttempts) throw new Error(`The scenario lab build exited with ${outcome.code ?? outcome.signal}`);
        process.stderr.write(`[campaign] the scenario lab build died with this machine's RAM-fault signature (${fault}); retrying\n`);
      }
    }, { onWait: (owner) => process.stderr.write(`[campaign] waiting for the build lock held by process ${owner?.pid ?? "unknown"}\n`) });
  }
  const catalog = (await import(pathToFileURL(modulePath).href)).LIVE_INSTRUCTION_TASKS;
  if (!Array.isArray(catalog)) throw new Error(`${modulePath} exports no LIVE_INSTRUCTION_TASKS`);
  return catalog;
}

async function main(argv) {
  const options = parseCampaignArgs(argv);
  if (options.help) { process.stdout.write(`${USAGE}\n`); return 0; }
  const tasks = selectTasks(await loadCatalog(options), options);
  if (options.dryRun) {
    process.stdout.write(`# ${tasks.length} task(s), one at a time, npm_config_workspace_concurrency=1; each spawned as node scripts/lab/run-lab.mjs with these arguments\n`);
    for (const task of tasks) process.stdout.write(`${displayCommand(labRunArguments(task, options))}\n`);
    return 0;
  }
  const stamp = new Date().toISOString().replace(/[:.]/gu, "-");
  const runsDirectory = process.env.FLUXIQ_TEST_RUNS_DIR?.trim() || path.join(repositoryRoot, "test-runs");
  const outputDir = path.resolve(options.output ?? path.join(runsDirectory, "campaigns", stamp));
  const labScript = process.env.FLUXIQ_LAB_CAMPAIGN_LAB_SCRIPT?.trim() || path.join(repositoryRoot, "scripts", "lab", "run-lab.mjs");
  const summary = await runCampaign({ tasks, options, outputDir, execute: spawnLab(labScript) });
  process.stdout.write(`${JSON.stringify({ campaign: summary.campaignId, summary: path.join(outputDir, "summary.md"), totals: summary.totals })}\n`);
  return summary.totals.passed === summary.totals.tasks ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (error) => {
    process.stderr.write(`${JSON.stringify({ status: "failed", category: "campaign.usage", message: error instanceof Error ? error.message : String(error) })}\n${USAGE}\n`);
    process.exitCode = 1;
  });
}
