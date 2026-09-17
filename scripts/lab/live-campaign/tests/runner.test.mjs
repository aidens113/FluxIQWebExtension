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
  assert.match(markdown, /\| form-goal \| instruction-only-form \| form \| run-ok \| passed \| yes \| — \| web\.dom\.type \| playback goal \| yes \| 2 \| 15 \| 0\.75 \| — \| — \| 2 \(exit 3221225477 \(access violation\)\) \|/u);
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
