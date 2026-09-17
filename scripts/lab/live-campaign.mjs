#!/usr/bin/env node
// A live campaign: catalog tasks, run one at a time through the Lab, with one
// summary at the end. Two kinds of task:
//
// - Creation tasks (`LIVE_INSTRUCTION_TASKS`): a plain-English instruction,
//   run as `pnpm lab run <scenario> [--variant <v>] --live-llm ... --llm-task
//   create-flow --instruction-task <id>`, and judged by the run's verdict.
// - Repair tasks (`LIVE_REPAIR_TASKS`, `--kind repair`): the scenario's
//   recorded Flow against a variant that breaks it, run as `pnpm lab run
//   <scenario> [--workflow <w>] [--variant <v>] --flow --live-llm ...
//   --llm-task adapt` with `REPAIR_LIMITS`, and judged by the run's recovery
//   record and final state (`repairJudgement`), never by its first failure.
//
//   pnpm lab:campaign --dry-run                    every task, commands only
//   pnpm lab:campaign --kind extract --limit 3     the first three scraping tasks
//   pnpm lab:campaign --kind repair --dry-run      the repair commands
//   pnpm lab:campaign product-catalog-all-pages -- --llm-max-cost-usd 0.25
//
// Each run is spawned as `node scripts/lab/run-lab.mjs` with the same
// arguments, never in parallel and with npm_config_workspace_concurrency=1. The
// catalog is the scenarios barrel `apps/scenario-lab/src/scenarios/index.ts`,
// compiled into the Lab instance's scenario output first. A live run needs an
// explicit selection (task ids, --kind, or --all); a dry run defaults to every
// task.
//
// This machine has faulty RAM, so an attempt that died with one of its
// signatures (see `ramFaultSignature`) is retried up to --max-attempts. An
// attempt that reported a run outcome is never retried: that is a real result.
// Tokens and cost in the summary are what the provider reported: per call for
// a Flow run, and the build's totals (`build.accounting`) for a created Flow,
// which itemizes no call. Never Core's charged figures, which include
// reservations, and a figure no record holds reads "not recorded", not 0.

import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { withBuildLock } from "./build-lock.mjs";
import { repositoryRoot, resolveLabInstancePaths } from "./lab-instance.mjs";

const KINDS = ["form", "navigate", "extract", "navigate-and-extract", "repair"];
const KEBAB_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const CAMPAIGN_OWNED_OPTIONS = new Set(["--live-llm", "--llm-task", "--llm-profile", "--llm-provider", "--llm-model", "--instruction-task", "--variant", "--workflow", "--flow"]);
const DEFAULT_PROFILES = Object.freeze({ create: "lab-create-flow", repair: "lab-adapt-repair" });
/**
 * The per-call and per-run limits a repair run gets unless the same option is
 * given after `--`: the ones live adapt runs have worked with
 * (`run-mu4ovip2-b15551d3`). The Lab refuses an option given twice, so a
 * limit given after `--` replaces its default rather than joining it.
 */
const REPAIR_LIMITS = Object.freeze([
  ["--llm-max-input-tokens", "42000"], ["--llm-max-output-tokens", "8000"], ["--llm-max-total-tokens", "50000"],
  ["--llm-max-run-tokens", "600000"], ["--llm-max-calls", "26"], ["--llm-max-cost-usd", "0.25"],
]);
const ISSUE_CODE = /^[a-z][a-z0-9_]*(?:[.:][a-z0-9_+-]+)+$/iu;
const PNPM_OWN_CODE = /[\\/]pnpm(?:[\\/][\d.]+)?[\\/](?:dist|bin|lib)[\\/][^\s:'"]*\.c?js/iu;
const JS_ERROR = /\b(?:SyntaxError|TypeError|ReferenceError|RangeError)\b/u;
const OUTPUT_TAIL_CHARS = 1_000_000;
const USAGE = "Usage: pnpm lab:campaign [task-id ...] [--kind form|navigate|extract|navigate-and-extract|repair[,...]] [--all] [--limit N] [--dry-run] [--no-build] [--max-attempts N] [--llm-profile ID (default lab-create-flow, or lab-adapt-repair for repair tasks)] [--llm-provider NAME] [--llm-model NAME] [--output DIR] [-- LAB-OPTIONS]";

/** @param {string[]} argv */
export function parseCampaignArgs(argv) {
  const options = { taskIds: [], kinds: [], all: false, limit: undefined, dryRun: false, build: true, maxAttempts: 3, profile: undefined, provider: "deepseek", model: "deepseek-chat", output: undefined, labArgs: [], help: false };
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

/**
 * The Lab arguments for one task, after `pnpm lab`. A creation task builds a
 * Flow from its instruction; a repair task runs the Flow recorded on the
 * unarmed page against its variant, with the model allowed to diagnose and
 * propose (`adapt`), under `REPAIR_LIMITS` less any given after `--`.
 */
export function labRunArguments(task, options) {
  const repair = task.kind === "repair";
  const identity = ["--live-llm", "--llm-profile", options.profile ?? (repair ? DEFAULT_PROFILES.repair : DEFAULT_PROFILES.create), "--llm-provider", options.provider, "--llm-model", options.model];
  if (!repair) return ["run", task.scenarioId, ...(task.variantId ? ["--variant", task.variantId] : []), ...identity, "--llm-task", "create-flow", "--instruction-task", task.id, ...options.labArgs];
  const limits = REPAIR_LIMITS.filter(([name]) => !options.labArgs.includes(name)).flat();
  return [
    "run", task.scenarioId, ...(task.workflowId ? ["--workflow", task.workflowId] : []), ...(task.variantId ? ["--variant", task.variantId] : []),
    "--flow", ...identity, "--llm-task", "adapt", ...limits, ...options.labArgs,
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
  const spend = reportedSpend(liveLlm, flowLane);
  const recovery = evaluation?.harnessRecovery ?? flowLane?.harnessRecovery ?? null;
  const automationFailure = evaluation?.automationFailureReported ?? run?.automationFailure ?? null;
  const oracleVerdict = evaluation?.oracleVerdict ?? result?.observation?.oracleVerdict ?? null;
  const providerCalls = liveLlm?.observed?.calls ?? evaluation?.llm?.calls ?? null;
  const repairing = task.kind === "repair";
  const repair = repairing ? repairOutcome(recovery, providerCalls, flowLane) : null;
  let judgement;
  if (repairing) judgement = repairJudgement(task, repair, oracleVerdict);
  else {
    const dataset = task.judgeBy === "expected-dataset" ? datasetJudgement(evaluation?.extraction ?? result?.observation?.extraction ?? null) : null;
    judgement = { by: task.judgeBy, passed: dataset === null ? (oracleVerdict === null ? null : oracleVerdict === "passed") : dataset.passed, oracleVerdict, dataset };
  }
  const verdict = result?.verdict ?? "no-result";
  const lastFault = attempts.at(-1)?.ramFault ?? null;
  return {
    taskId: task.id, scenarioId: task.scenarioId, workflowId: task.workflowId ?? null, variantId: task.variantId ?? null, kind: task.kind,
    instruction: task.instruction ?? null, judgeBy: repairing ? task.expect : task.judgeBy, expectedDatasetId: task.expectedDatasetId ?? null,
    runId: result?.runId ?? null,
    verdict,
    // A creation task succeeds on its run's verdict. A repair run's verdict
    // judges the variant's expectations, which a proposal alone never meets,
    // so a repair task succeeds on its judgement instead.
    succeeded: repairing ? judgement.passed === true : verdict === "passed",
    exitCode: final.code,
    attempts: attempts.length,
    ramFaults: attempts.map((attempt) => attempt.ramFault).filter(Boolean),
    flowCreated: evaluation?.flowCreated ?? result?.observation?.flowCreated ?? (flowLane?.flowId ? true : null),
    actionTypes: distinct((evaluation?.actions ?? run?.actions ?? flowLane?.actions ?? []).map((action) => action.actionType)),
    createdFlowShape: createdFlowShape(flowLane),
    judgement,
    repair,
    providerCalls,
    reportedTokens: spend.tokens,
    reportedCostUsd: spend.costUsd,
    spendSource: spend.source,
    callsWithoutReportedTokens: spend.callsWithoutReportedTokens,
    failureCategory: result?.failureCategory ?? evaluation?.failureCategory ?? refusal?.category ?? (lastFault ? `ram-fault: ${lastFault}` : null),
    automationFailure: automationFailure ? [automationFailure.category, automationFailure.code].filter(Boolean).join("/") : null,
    issueCodes: distinct([
      ...calls.flatMap((call) => call.validationCodes ?? []),
      ...(recovery?.interventions ?? []).flatMap((item) => item.validationCodes ?? []),
      ...(recovery?.runtimePatchAttempts ?? []).flatMap((item) => item.issueCodes ?? []),
      ...(flowLane?.proposalIssues ?? []),
      flowLane?.failure?.code, liveLlm?.build?.failure?.code, automationFailure?.code,
    ].filter((code) => typeof code === "string" && code.length <= 120 && ISSUE_CODE.test(code))).sort(),
    runPath: result?.path ?? null,
    runnerMessage: result ? null : shortMessage(refusal?.message),
  };
}

/** The campaign summary as Markdown: totals, then a table of creation tasks and a table of repair tasks. */
export function renderSummaryMarkdown(summary) {
  const t = summary.totals;
  const { profiles, provider, model, maxAttempts } = summary.options;
  const cell = (value) => (value === null || value === undefined || value === "" ? "—" : String(value).replace(/\|/gu, "\\|").replace(/\s+/gu, " "));
  const yesNo = (value) => (value === null || value === undefined ? "—" : value ? "yes" : "no");
  const tableRow = (values) => `| ${values.map(cell).join(" | ")} |`;
  const failureOf = (row) => [row.failureCategory, row.automationFailure].filter(Boolean).join("; ");
  const attemptsOf = (row) => (row.ramFaults.length > 0 ? `${row.attempts} (${row.ramFaults.join(", ")})` : row.attempts);
  const spent = (value, row) => value ?? (row.spendSource === "not recorded" ? "not recorded" : null);
  const nodesOf = ({ createdFlowShape: shape }) => (shape ? `${shape.nodeCount ?? "?"} nodes${Object.keys(shape.nodeTypes).length > 0 ? `: ${Object.entries(shape.nodeTypes).map(([name, n]) => `${name} ×${n}`).join(", ")}` : ""}` : null);
  const creations = summary.tasks.filter((row) => row.kind !== "repair");
  const repairs = summary.tasks.filter((row) => row.kind === "repair");
  const lines = [
    `# Live campaign ${summary.campaignId}`, "",
    `Started ${summary.startedAt}, finished ${summary.finishedAt ?? "(in progress)"}. Lab: creation tasks \`pnpm lab run ... --llm-task create-flow\` (profile \`${profiles.create}\`), repair tasks \`pnpm lab run ... --flow --llm-task adapt\` (profile \`${profiles.repair}\`); ${provider}/${model}, up to ${maxAttempts} attempt(s) per task.`, "",
    `**${t.passed} of ${t.tasks} runs passed** (${t.failed} failed, ${t.noResult} produced no result); ${t.judgementsPassed} judgement(s) passed; **${t.succeeded} of ${t.tasks} tasks succeeded** (a creation task on its run's verdict, a repair task on its judgement). Provider calls ${t.providerCalls}; reported tokens ${t.reportedTokens}; reported cost $${t.reportedCostUsd.toFixed(6)} (reservations excluded).`,
  ];
  if (creations.length > 0 || repairs.length === 0) {
    lines.push("", "| Task | Scenario / variant | Kind | Run | Verdict | Flow created | Created Flow nodes | Executed actions | Judged by | Judgement | Calls | Tokens (reported) | Cost USD (reported) | Failure | Issue codes | Attempts |", "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
    for (const row of creations) {
      const judgedBy = row.judgeBy === "expected-dataset" ? `dataset ${row.expectedDatasetId}` : "playback goal";
      lines.push(tableRow([row.taskId, row.variantId ? `${row.scenarioId} / ${row.variantId}` : row.scenarioId, row.kind, row.runId, row.verdict, yesNo(row.flowCreated), nodesOf(row), row.actionTypes.join(", "), judgedBy, yesNo(row.judgement.passed), row.providerCalls, spent(row.reportedTokens, row), spent(row.reportedCostUsd, row), failureOf(row), row.issueCodes.join(", "), attemptsOf(row)]));
    }
  }
  if (repairs.length > 0) {
    lines.push("", "Repair tasks. A run's verdict judges the variant's own expectations, which a repair that is only proposed never meets; the judgement is what counts.", "",
      "| Task | Scenario / workflow / variant | Expect | Run | Verdict | Final state | Diagnosis validated | Patch kinds (accepted) | Refused | Refusal codes | Proposal | Adaptation | Right control | Replay calls | Calls | Tokens (reported) | Cost USD (reported) | Judgement | Why | Failure | Attempts |",
      "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
    for (const row of repairs) {
      const r = row.repair;
      const accepted = distinct(r.accepted.map((patch) => patch.kind));
      const kinds = r.patchKinds.length === 0 ? "none" : `${r.patchKinds.join(", ")} (${accepted.length === 0 ? "none" : accepted.join(", ")})`;
      const refused = r.refused === true ? `yes, at ${r.refusedAt}` : yesNo(r.refused);
      const verified = row.judgement.targetVerified;
      const target = row.judgeBy !== "repair" ? null : `${verified === null ? "not checked" : yesNo(verified)}${r.targetJudgement ? ` (${r.targetJudgement.verdict})` : ""}`;
      lines.push(tableRow([row.taskId, [row.scenarioId, row.workflowId, row.variantId].filter(Boolean).join(" / "), row.judgeBy, row.runId, row.verdict, row.judgement.oracleVerdict, yesNo(r.diagnosisValidated), r.measured ? kinds : null, refused, r.refusalCodes.join(", "), yesNo(r.changeProposalCreated), yesNo(r.adaptationCreated), target, r.replayProviderCalls ?? "not replayed", row.providerCalls, spent(row.reportedTokens, row), spent(row.reportedCostUsd, row), yesNo(row.judgement.passed), row.judgement.reason, failureOf(row), attemptsOf(row)]));
    }
  }
  return `${lines.join("\n")}\n`;
}

/**
 * Runs `tasks` in order, one at a time, and writes the summary after each.
 * `execute` and `readBundle` are injected so the runner can be tested
 * against a stubbed Lab.
 */
export async function runCampaign({ tasks, options, outputDir, execute, readBundle = readRunBundle, log = (line) => process.stderr.write(`${line}\n`), now = () => new Date() }) {
  const profiles = { create: options.profile ?? DEFAULT_PROFILES.create, repair: options.profile ?? DEFAULT_PROFILES.repair };
  const summary = { schemaVersion: "0.1", campaignId: path.basename(outputDir), startedAt: now().toISOString(), finishedAt: null, options: { profiles, provider: options.provider, model: options.model, maxAttempts: options.maxAttempts, labArgs: options.labArgs }, environment: { npm_config_workspace_concurrency: "1", labInstance: process.env.FLUXIQ_LAB_INSTANCE?.trim() || null }, totals: totalsOf([]), tasks: [] };
  await mkdir(path.join(outputDir, "logs"), { recursive: true });
  for (const [position, task] of tasks.entries()) {
    const args = labRunArguments(task, options);
    const attempts = [];
    let final;
    for (let attempt = 1; attempt <= options.maxAttempts; attempt += 1) {
      log(`[campaign] ${position + 1}/${tasks.length} ${task.id}, attempt ${attempt}/${options.maxAttempts}: ${displayCommand(args)}`);
      final = await execute({ taskId: task.id, args, env: labEnvironment(process.env), logPath: path.join(outputDir, "logs", `${task.id}.attempt-${attempt}.log`) });
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
    succeeded: rows.filter((row) => row.succeeded).length,
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

/**
 * What the provider reported spending, and where the figure came from
 * (`source`). A created-Flow build keeps Core's provider-reported totals in
 * `snapshots/live-llm.json` `build.accounting` and itemizes no call
 * (`observedCalls: []`); a Flow run keeps one record per call. Never Core's
 * `observed.accounting`, which includes reservations for a run.
 *
 * `source` is `build`, `per-call`, `no calls` (a record of zero calls, so zero
 * is the true spend), `not recorded` (a record exists and holds no figure: the
 * tokens and cost are `null`, never 0), or `null` when the run left no
 * live-llm record at all.
 */
function reportedSpend(liveLlm, flowLane) {
  const build = liveLlm?.build ?? (flowLane?.lane === "created-flow" ? flowLane.build : null);
  const number = (value) => (typeof value === "number" && Number.isFinite(value) ? value : null);
  if (build) {
    const totals = build.accounting ?? null;
    const input = number(totals?.inputTokens);
    const output = number(totals?.outputTokens);
    const tokens = number(totals?.totalTokens) ?? (input !== null && output !== null ? input + output : null);
    return { source: totals && (tokens !== null || number(totals.estimatedCostUsd) !== null) ? "build" : "not recorded", tokens, costUsd: number(totals?.estimatedCostUsd), callsWithoutReportedTokens: null };
  }
  if (!liveLlm) return { source: null, tokens: null, costUsd: null, callsWithoutReportedTokens: 0 };
  const calls = liveLlm.observed?.observedCalls ?? [];
  if (calls.length === 0) {
    const none = liveLlm.observed?.calls === 0;
    return { source: none ? "no calls" : "not recorded", tokens: none ? 0 : null, costUsd: none ? 0 : null, callsWithoutReportedTokens: 0 };
  }
  const tokens = calls.map((call) => number(call.totalTokens) ?? (number(call.inputTokens) !== null && number(call.outputTokens) !== null ? call.inputTokens + call.outputTokens : null)).filter((n) => n !== null);
  const costs = calls.map((call) => number(call.estimatedCostUsd)).filter((n) => n !== null);
  return {
    source: "per-call",
    tokens: tokens.length === 0 ? null : tokens.reduce((sum, n) => sum + n, 0),
    costUsd: costs.length === 0 ? null : Number(costs.reduce((sum, n) => sum + n, 0).toFixed(8)),
    callsWithoutReportedTokens: calls.length - tokens.length,
  };
}

const OUTPUT_NAME = /^(?:[a-z][a-z0-9_]*(?:\.[a-z0-9_]+)+|\(unrecognized\))$/u;

/**
 * The created Flow's make-up from `snapshots/flow-lane.json` `flowShape`:
 * node counts and its action nodes counted by output. Only output-shaped names
 * and whole counts are kept; `null` for a run that created no Flow.
 */
function createdFlowShape(flowLane) {
  const shape = flowLane?.lane === "created-flow" ? flowLane.flowShape : null;
  if (!shape || typeof shape !== "object") return null;
  const count = (value) => (Number.isSafeInteger(value) && value >= 0 ? value : null);
  const nodeTypes = Object.fromEntries(Object.entries(shape.actionTypes ?? {}).filter(([name, n]) => OUTPUT_NAME.test(name) && count(n) !== null).sort(([a], [b]) => a.localeCompare(b)));
  return { nodeCount: count(shape.nodeCount), actionNodeCount: count(shape.actionNodeCount), nodeTypes, extractNodes: count(shape.extractNodes), navigationNodes: count(shape.navigationNodes) };
}

/**
 * What the model did about a broken run, from `harnessRecovery` (kinds, flags,
 * codes and ids only). A patch is accepted when it passed preflight with no
 * issue code. A run is `refused` when the model was consulted and nothing came
 * of it: no patch accepted or executed, no proposal, no adaptation.
 * `refusedAt` says where: `preflight` (a patch was returned and rejected, with
 * `refusalCodes`), `no-patch` (a validated diagnosis and no patch), or
 * `no-validated-diagnosis`. `replayProviderCalls` stays `null`: the Lab's adapt
 * lane only proposes, so nothing is applied or replayed to count.
 *
 * `targetJudgement` is the Lab's own judgement of a declared repair
 * (`snapshots/flow-lane.json` `repair`, from the scenario's `repair.js`): the
 * one record that says what a proposal pointed at, as a closed verdict and
 * the names of the target fields that differed. `null` where the Lab judged
 * none.
 */
function repairOutcome(recovery, providerCalls, flowLane) {
  const targetJudgement = labRepairJudgement(flowLane);
  if (!recovery) return { measured: false, consulted: null, diagnosisValidated: null, patchKinds: [], accepted: [], patchExecuted: null, refused: null, refusedAt: null, refusalCodes: [], changeProposalCreated: null, adaptationCreated: null, targetJudgement, replayProviderCalls: null };
  const interventions = recovery.interventions ?? [];
  const attempts = recovery.runtimePatchAttempts ?? [];
  const isAccepted = (attempt) => attempt.preflightOk === true && (attempt.issueCodes ?? []).length === 0;
  const consulted = (providerCalls ?? 0) > 0 || interventions.length > 0;
  const diagnosisValidated = interventions.some((item) => item.kind === "diagnosis" && item.validationOk === true);
  const patchExecuted = attempts.some((attempt) => attempt.executed === true);
  const changeProposalCreated = (recovery.changeProposalIds ?? []).length > 0 || attempts.some((attempt) => attempt.changeProposalCreated === true);
  const adaptationCreated = (recovery.adaptationIds ?? []).length > 0 || attempts.some((attempt) => attempt.adaptationCreated === true);
  const rejected = attempts.filter((attempt) => !isAccepted(attempt));
  const refused = consulted && rejected.length === attempts.length && !patchExecuted && !changeProposalCreated && !adaptationCreated;
  const refusedAt = !refused ? null : rejected.length > 0 ? "preflight" : diagnosisValidated ? "no-patch" : "no-validated-diagnosis";
  const refusalCodes = !refused ? [] : distinct([
    ...rejected.flatMap((attempt) => attempt.issueCodes ?? []),
    ...interventions.filter((item) => item.validationOk === false).flatMap((item) => item.validationCodes ?? []),
  ].filter((code) => typeof code === "string" && code.length <= 120 && ISSUE_CODE.test(code))).sort();
  return {
    measured: true, consulted, diagnosisValidated,
    patchKinds: distinct(attempts.map((attempt) => attempt.kind)),
    accepted: attempts.filter(isAccepted).map((attempt) => ({ kind: attempt.kind ?? null, executed: attempt.executed === true, produced: attempt.changeProposalCreated === true || attempt.adaptationCreated === true })),
    patchExecuted, refused, refusedAt, refusalCodes, changeProposalCreated, adaptationCreated, targetJudgement, replayProviderCalls: null,
  };
}

const LAB_REPAIR_VERDICTS = new Set(["repaired", "wrong_target", "refused", "not_proposed", "not_attempted", "proposal_unreadable"]);
const TARGET_FIELDS = new Set(["tagName", "accessibleName", "controlType"]);

/** The Lab's declared-repair verdict and differing field names, or `null`; anything outside those closed sets is dropped. */
function labRepairJudgement(flowLane) {
  const judged = flowLane?.repair;
  if (!judged || typeof judged !== "object" || !LAB_REPAIR_VERDICTS.has(judged.verdict)) return null;
  const fields = Array.isArray(judged.mismatchedFields) ? judged.mismatchedFields : [];
  return { verdict: judged.verdict, mismatchedFields: fields.filter((field) => TARGET_FIELDS.has(field)) };
}

/**
 * A repair task's judgement. `passed` is `null` when the outcome says nothing
 * about the model: no recovery record, a refusal the model was never asked to
 * make, or a final state nobody checked.
 *
 * - `repair`: a validated diagnosis, and an accepted patch of the task's kind
 *   that created a proposal or adaptation or was executed. Where the Lab
 *   judged the declared repair, its verdict must be `repaired`, which is what
 *   shows the proposal names the right control (`targetVerified`). An executed
 *   patch must also leave the declared final state true. With neither, the
 *   proposal's target is not in the record and `targetVerified` stays `null`.
 * - `refusal`: the model consulted, the run `refused`, and the declared final
 *   state (nothing pressed, nothing changed) still true.
 */
function repairJudgement(task, outcome, oracleVerdict) {
  const executed = outcome.accepted.some((patch) => patch.kind === task.patchKind && patch.executed);
  const lab = outcome.targetJudgement;
  const targetVerified = task.expect !== "repair" ? null : lab ? lab.verdict === "repaired" && (!executed || oracleVerdict === "passed") : executed ? oracleVerdict === "passed" : null;
  const judged = (passed, reason) => ({ by: task.expect, passed, reason, oracleVerdict, targetVerified });
  if (!outcome.measured) return judged(null, "no recovery record: no Flow ran");
  if (task.expect === "refusal") {
    if (!outcome.consulted) return judged(null, "the model was never consulted, so nothing was refused");
    if (!outcome.refused) return judged(false, outcome.patchExecuted ? "a patch was executed" : "a patch was accepted, or a proposal or adaptation was created");
    if (oracleVerdict === null) return judged(null, "the final state was not checked");
    if (oracleVerdict !== "passed") return judged(false, "the declared final state does not hold");
    return judged(true, `refused at ${outcome.refusedAt}`);
  }
  if (!outcome.consulted) return judged(false, "the model was never consulted");
  if (!outcome.diagnosisValidated) return judged(false, "no diagnosis validated");
  const fitting = outcome.accepted.filter((patch) => patch.kind === task.patchKind);
  if (fitting.length === 0) {
    const kinds = distinct(outcome.accepted.map((patch) => patch.kind));
    return judged(false, kinds.length > 0 ? `accepted ${kinds.join(", ")}, not ${task.patchKind}` : "no patch was accepted");
  }
  if (!fitting.some((patch) => patch.produced || patch.executed)) return judged(false, `the accepted ${task.patchKind} created no proposal or adaptation`);
  if (lab?.verdict === "wrong_target") return judged(false, `the proposal named a different control (${lab.mismatchedFields.join(", ") || "unnamed fields"} differ)`);
  if (lab && lab.verdict !== "repaired") return judged(false, `the Lab judged the declared repair ${lab.verdict}`);
  if (executed && oracleVerdict !== "passed") return judged(false, "the executed repair did not reach the declared final state");
  if (executed) return judged(true, "repaired, executed and checked");
  return judged(true, lab ? "repair proposed, naming the declared control" : "repair proposed; its target is not in the record");
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

/**
 * Compiles the scenario lab into this instance's output, under the Lab's build
 * lock, and imports both task lists from the scenarios barrel: creation tasks
 * first, then repair tasks, with ids unique across the two.
 */
async function loadCatalog(options) {
  const override = process.env.FLUXIQ_LAB_CAMPAIGN_CATALOG?.trim();
  const paths = resolveLabInstancePaths(process.env);
  const modulePath = override || path.join(paths.scenarioOutDir, "scenarios", "index.js");
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
  const { LIVE_INSTRUCTION_TASKS: creations, LIVE_REPAIR_TASKS: repairs } = await import(pathToFileURL(modulePath).href);
  if (!Array.isArray(creations)) throw new Error(`${modulePath} exports no LIVE_INSTRUCTION_TASKS`);
  if (!Array.isArray(repairs)) throw new Error(`${modulePath} exports no LIVE_REPAIR_TASKS`);
  const misfiled = [...creations.filter((task) => task.kind === "repair"), ...repairs.filter((task) => task.kind !== "repair")].map((task) => task.id);
  if (misfiled.length > 0) throw new Error(`Tasks in the wrong list for their kind: ${misfiled.join(", ")}`);
  const catalog = [...creations, ...repairs];
  const ids = catalog.map((task) => task.id);
  const repeated = distinct(ids.filter((id, index) => ids.indexOf(id) !== index));
  if (repeated.length > 0) throw new Error(`Task ids used twice across the catalog: ${repeated.join(", ")}`);
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
  return summary.totals.succeeded === summary.totals.tasks ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (error) => {
    process.stderr.write(`${JSON.stringify({ status: "failed", category: "campaign.usage", message: error instanceof Error ? error.message : String(error) })}\n${USAGE}\n`);
    process.exitCode = 1;
  });
}
