// The campaign loop against a stubbed Lab: order, retries, and the summary it writes.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { parseCampaignArgs, renderSummaryMarkdown, runCampaign } from "../index.mjs";
import { attempt, resultLine } from "./attempts.mjs";
import { patch, recovery, repairBundle } from "./recovery-records.mjs";
import { CATALOG, REPAIRS } from "./tasks.mjs";
import { withTemp } from "./temp-directory.mjs";

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
  assert.deepEqual(summary.totals, { tasks: 4, passed: 1, succeeded: 1, failed: 1, noResult: 2, judgementsPassed: 1, providerCalls: 2, reportedTokens: 15, reportedCostUsd: 0.75 });
  assert.ok(summary.finishedAt);
  assert.ok(lines.some((line) => line.includes("retrying")) && lines.some((line) => line.includes("no attempts left")));

  const written = JSON.parse(await readFile(path.join(outputDir, "summary.json"), "utf8"));
  assert.deepEqual(written.tasks.map(({ taskId }) => taskId), CATALOG.map(({ id }) => id));
  const markdown = await readFile(path.join(outputDir, "summary.md"), "utf8");
  assert.equal(markdown, renderSummaryMarkdown(written));
  assert.match(markdown, /\*\*1 of 4 runs passed\*\*/u);
  assert.match(markdown, /\| form-goal \| instruction-only-form \| form \| run-ok \| passed \| yes \| — \| web\.dom\.type \| playback goal \| yes \| — \| 2 \| 15 \| 0\.75 \| — \| — \| 2 \(exit 3221225477 \(access violation\)\) \|/u);
  assert.match(markdown, /\| table-read-reordered \| data-table \/ column-reorder \|/u);
}));

test("a campaign with repair tasks counts a repair as succeeded on its judgement, and renders it in its own table", () => withTemp(async (directory) => {
  const paths = Object.fromEntries(["form-goal", "drift-repair", "drift-refuse"].map((id) => [id, path.join(directory, id)]));
  const bundles = {
    [paths["form-goal"]]: { evaluation: { flowCreated: true, oracleVerdict: "passed", actions: [], extraction: null }, run: null, flowLane: null, liveLlm: null },
    [paths["drift-repair"]]: repairBundle(recovery({ runtimePatchAttempts: [patch({ proposalOnly: true, changeProposalCreated: true })], changeProposalIds: ["proposal-1"] })),
    [paths["drift-refuse"]]: repairBundle(recovery({ runtimePatchAttempts: [patch({ changeProposalCreated: true })], changeProposalIds: ["proposal-2"] }), { oracleVerdict: "passed" }),
  };
  const seen = [];
  const execute = async ({ taskId, args }) => {
    seen.push([taskId, args.includes("--flow"), args[args.indexOf("--llm-task") + 1]]);
    return attempt({ code: taskId === "form-goal" ? 0 : 1, stdout: resultLine({ runId: `run-${taskId}`, verdict: taskId === "form-goal" ? "passed" : "failed", path: paths[taskId] }) });
  };
  const outputDir = path.join(directory, "campaigns", "mixed");
  const tasks = [CATALOG[0], REPAIRS[0], REPAIRS[1]];
  const summary = await runCampaign({ tasks, options: parseCampaignArgs(["--all"]), outputDir, execute, readBundle: async (target) => bundles[target], log: () => {} });

  assert.deepEqual(seen, [["form-goal", false, "create-flow"], ["drift-repair", true, "adapt"], ["drift-refuse", true, "adapt"]]);
  assert.deepEqual(summary.tasks.map((row) => [row.taskId, row.verdict, row.judgement.passed, row.succeeded]), [
    ["form-goal", "passed", true, true],
    ["drift-repair", "failed", true, true],
    ["drift-refuse", "failed", false, false],
  ]);
  assert.deepEqual([summary.totals.passed, summary.totals.succeeded, summary.totals.judgementsPassed, summary.totals.providerCalls, summary.totals.reportedTokens], [1, 2, 2, 4, 14774]);
  assert.deepEqual(summary.options.profiles, { create: "lab-create-flow", repair: "lab-adapt-repair" });

  const markdown = await readFile(path.join(outputDir, "summary.md"), "utf8");
  assert.equal(markdown, renderSummaryMarkdown(JSON.parse(await readFile(path.join(outputDir, "summary.json"), "utf8"))));
  assert.match(markdown, /\*\*2 of 3 tasks succeeded\*\*/u);
  assert.match(markdown, /\| form-goal \| instruction-only-form \| form \| run-form-goal \| passed \|/u);
  assert.match(markdown, /\| drift-repair \| identity-drift \/ renamed-redesign \| repair \| run-drift-repair \| failed \| failed \| yes \| temporary_target_override \(temporary_target_override\) \| no \| — \| yes \| no \| not checked \| not replayed \| 2 \| 7387 \| 0\.00407132 \| yes \| repair proposed; its target is not in the record \| target_not_found\/web\.target\.not_found \| 1 \|/u);
  assert.match(markdown, /\| drift-refuse \| identity-drift \/ save-and-exit \| refusal \| run-drift-refuse \| failed \| passed \| yes \| temporary_target_override \(temporary_target_override\) \| no \| — \| yes \| no \| — \| not replayed \| 2 \| 7387 \| 0\.00407132 \| no \| a patch was accepted, or a proposal or adaptation was created \|/u);
  assert.equal((markdown.match(/^\| Task \|/gmu) ?? []).length, 2, "one table per kind");

  const repairsOnly = renderSummaryMarkdown({ ...summary, tasks: summary.tasks.slice(1) });
  assert.equal((repairsOnly.match(/^\| Task \|/gmu) ?? []).length, 1, "no empty creation table");
}));

// Four tasks of the 2026-09-17 campaign ended "environment.missing" with no
// run: their scenarios declare replay secrets that nothing supplied, and the
// summary could not say so.
test("each Lab run gets its own scenario's fixture secrets, and a refusal's reason reaches the summary", () => withTemp(async (directory) => {
  const machineOnly = "FLUXIQ_TEST_SECRET_MACHINE_ONLY";
  process.env[machineOnly] = "machine-value";
  try {
    const seen = [];
    const refusal = "Scenario attempt failed outside a finalized bundle: Scenario identity-drift declares the replay secret drift-password, so FLUXIQ_TEST_SECRET_DRIFT_PASSWORD must be set";
    const execute = async ({ taskId, env }) => {
      seen.push([taskId, Object.fromEntries(Object.entries(env).filter(([key]) => key.startsWith("FLUXIQ_TEST_SECRET_")))]);
      return taskId === "drift-refuse"
        ? attempt({ code: 1, stderr: `{"lab":"paths"}\n${JSON.stringify({ status: "failed", category: "environment.missing", message: refusal })}\n` })
        : attempt({ stdout: resultLine({ runId: `run-${taskId}`, path: path.join(directory, taskId) }) });
    };
    const secretsFor = (scenarioId) => (scenarioId === "sensitive-input" ? { FLUXIQ_TEST_SECRET_SENSITIVE_INPUT_PASSWORD: "fixture-value" } : {});
    const outputDir = path.join(directory, "campaigns", "secrets");
    const summary = await runCampaign({ tasks: [REPAIRS[2], REPAIRS[1]], options: parseCampaignArgs(["--all"]), outputDir, execute, secretsFor, readBundle: async () => ({ evaluation: null, run: null, liveLlm: null, flowLane: null }), log: () => {} });

    assert.deepEqual(seen, [["secrets-refuse", { FLUXIQ_TEST_SECRET_SENSITIVE_INPUT_PASSWORD: "fixture-value" }], ["drift-refuse", {}]], "a scenario's own secrets, and never the machine's");
    const refused = summary.tasks[1];
    assert.deepEqual([refused.verdict, refused.failureCategory, refused.runnerMessage], ["no-result", "environment.missing", refusal], "the variable name is kept whole");
    const markdown = await readFile(path.join(outputDir, "summary.md"), "utf8");
    assert.ok(markdown.includes(`| environment.missing; ${refusal} |`), "the Failure column says what was missing");
    const written = await readFile(path.join(outputDir, "summary.json"), "utf8");
    assert.equal(written.includes("fixture-value") || written.includes("machine-value"), false, "no secret value reaches the summary");
  } finally {
    delete process.env[machineOnly];
  }
}));

// On 2026-09-18 a web build that could never succeed was retried three times,
// then a fourth in a rerun, each reported as this machine's RAM fault.
test("a startup failure that comes back identical is deterministic: it stops retrying and is never called a RAM fault", () => withTemp(async (directory) => {
  const { mkdir, writeFile } = await import("node:fs/promises");
  const startupAttempt = async (name) => {
    const runPath = path.join(directory, name);
    await mkdir(runPath, { recursive: true });
    await writeFile(path.join(runPath, "summary.json"), JSON.stringify({ firstFailure: { summary: "Core web panel production build did not succeed" } }));
    return attempt({ code: 1, stdout: resultLine({ runId: name, verdict: "failed", failureCategory: "process.startup", path: runPath, evaluation: { failureCategory: "process.startup", facilityFailure: { boundary: "finalized-bundle", stage: "scenario.execute", reason: "unclassified" } } }) });
  };
  const scripted = [await startupAttempt("run-1"), await startupAttempt("run-2"), await startupAttempt("run-3")];
  let runs = 0;
  const lines = [];
  const summary = await runCampaign({
    tasks: CATALOG.slice(0, 1), options: { ...parseCampaignArgs(["--all", "--max-attempts", "3"]) },
    outputDir: path.join(directory, "campaigns", "c"), execute: async () => { runs += 1; return scripted.shift(); },
    readBundle: async () => ({ evaluation: null, run: null, liveLlm: null, flowLane: null }), log: (line) => lines.push(line),
  });
  const [row] = summary.tasks;
  assert.equal(runs, 2, "one retry to tell a hardware fault from a real one, and no more");
  assert.deepEqual(row.ramFaults, [], "neither attempt was the hardware");
  assert.equal(row.repeatedFailure, "process.startup: Core web panel production build did not succeed");
  assert.equal(row.failureCategory, "process.startup");
  assert.ok(lines.some((line) => /failed exactly as attempt 1 did \(process\.startup: Core web panel production build did not succeed\)\. .*deterministic, not this machine's memory fault/u.test(line)));
  assert.ok(!lines.some((line) => line.includes("RAM-fault signature")));
  const markdown = await readFile(path.join(directory, "campaigns", "c", "summary.md"), "utf8");
  assert.match(markdown, /2 \(same failure every time, deterministic: process\.startup: Core web panel production build did not succeed\)/u);
}));

test("a startup failure that does not come back is retried as a possible memory fault, and the run that follows stands", () => withTemp(async (directory) => {
  const runPath = path.join(directory, "run-ok");
  const scripted = [
    attempt({ code: 1, stdout: resultLine({ runId: "run-s", verdict: "failed", failureCategory: "process.startup", path: path.join(directory, "absent") }) }),
    attempt({ stdout: resultLine({ runId: "run-ok", path: runPath }) }),
  ];
  const summary = await runCampaign({
    tasks: CATALOG.slice(0, 1), options: { ...parseCampaignArgs(["--all", "--max-attempts", "3"]) },
    outputDir: path.join(directory, "campaigns", "c"), execute: async () => scripted.shift(),
    readBundle: async () => ({ evaluation: { flowCreated: true, oracleVerdict: "passed", actions: [], extraction: null }, run: null, flowLane: null, liveLlm: null }), log: () => {},
  });
  const [row] = summary.tasks;
  assert.deepEqual([row.verdict, row.attempts, row.ramFaults, row.repeatedFailure], ["passed", 2, ["process.startup facility failure"], null]);
}));
