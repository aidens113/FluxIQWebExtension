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

const REPAIRS = Object.freeze([
  { id: "drift-repair", scenarioId: "identity-drift", variantId: "renamed-redesign", kind: "repair", expect: "repair", patchKind: "temporary_target_override", description: "Save was renamed; re-point the click." },
  { id: "drift-refuse", scenarioId: "identity-drift", variantId: "save-and-exit", kind: "repair", expect: "refusal", description: "Save is gone; press nothing else." },
  { id: "secrets-refuse", scenarioId: "sensitive-input", workflowId: "extract-card-secrets", kind: "repair", expect: "refusal", description: "The codes are passwords; read none." },
]);

/** The limits a repair run carries by default, stated here rather than imported so a changed default fails a test. */
const REPAIR_LIMIT_ARGS = ["--llm-max-input-tokens", "42000", "--llm-max-output-tokens", "8000", "--llm-max-total-tokens", "50000", "--llm-max-run-tokens", "600000", "--llm-max-calls", "26", "--llm-max-cost-usd", "0.25"];

/**
 * Recovery records shaped like the live ones: `run-mu4ovip2-b15551d3`
 * (identity-drift/save-and-exit) had a first diagnosis that did not validate, a
 * validated one, a validated patch reply, and one target override refused at
 * preflight.
 */
const diagnosed = [{ kind: "diagnosis", validationOk: false, validationCodes: [] }, { kind: "diagnosis", validationOk: true, validationCodes: [] }, { kind: "runtime_patch", validationOk: true, validationCodes: [] }];
const patch = (fields = {}) => ({ kind: "temporary_target_override", proposalOnly: null, executed: null, preflightOk: true, issueCodes: [], adaptationCreated: false, changeProposalCreated: false, ...fields });
const recovery = (fields = {}) => ({ attempted: true, interventions: diagnosed, runtimePatchAttempts: [], adaptationIds: [], changeProposalIds: [], ...fields });
const repairBundle = (harnessRecovery, { oracleVerdict = "failed", calls = 2, labRepair = undefined } = {}) => ({
  evaluation: { flowCreated: true, oracleVerdict, harnessRecovery, automationFailureReported: { category: "target_not_found", code: "web.target.not_found" }, actions: [{ actionType: "web.dom.type" }, { actionType: "web.dom.click" }], llm: { mode: "live", calls } },
  run: null,
  // The Lab's declared-repair judgement, as `flowLaneSnapshot` writes it (`repair`, or null when none was judged).
  flowLane: labRepair === undefined ? null : { harnessRecovery, repair: labRepair },
  liveLlm: { observed: { calls, accounting: { totalTokens: 999999 }, observedCalls: [{ totalTokens: 3662, estimatedCostUsd: 0.00203456, validationCodes: [] }, { totalTokens: 3725, estimatedCostUsd: 0.00203676, validationCodes: [] }].slice(0, calls) } },
});

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
  await writeFile(file, `export const LIVE_INSTRUCTION_TASKS = ${JSON.stringify(CATALOG)};\nexport const LIVE_REPAIR_TASKS = ${JSON.stringify(REPAIRS)};\n`);
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
  assert.deepEqual({ ...defaults }, { taskIds: [], kinds: [], all: false, limit: undefined, dryRun: false, build: true, maxAttempts: 3, profile: undefined, provider: "deepseek", model: "deepseek-chat", output: undefined, labArgs: [], help: false });
  assert.deepEqual(parseCampaignArgs(["--kind", "repair"]).kinds, ["repair"]);
  assert.throws(() => parseCampaignArgs(["--", "--flow"]), /sets --flow itself/u);
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
  const both = [...CATALOG, ...REPAIRS];
  assert.deepEqual(selectTasks(both, { ...base, kinds: ["repair"] }).map(({ id }) => id), ["drift-repair", "drift-refuse", "secrets-refuse"]);
  assert.deepEqual(selectTasks(both, { ...base, kinds: ["form", "repair"], limit: 2 }).map(({ id }) => id), ["form-goal", "drift-repair"]);
  assert.equal(selectTasks(both, { ...base, all: true }).length, 7);
});

test("each repair task becomes one adapt run of the recorded Flow, with the live limits unless they are given after --", () => {
  assert.deepEqual(labRunArguments(REPAIRS[0], parseCampaignArgs([])), [
    "run", "identity-drift", "--variant", "renamed-redesign", "--flow",
    "--live-llm", "--llm-profile", "lab-adapt-repair", "--llm-provider", "deepseek", "--llm-model", "deepseek-chat",
    "--llm-task", "adapt", ...REPAIR_LIMIT_ARGS,
  ]);
  const workflowOnly = labRunArguments(REPAIRS[2], parseCampaignArgs(["--llm-profile", "p"]));
  assert.deepEqual(workflowOnly.slice(0, 5), ["run", "sensitive-input", "--workflow", "extract-card-secrets", "--flow"]);
  assert.equal(workflowOnly[workflowOnly.indexOf("--llm-profile") + 1], "p");
  assert.equal(workflowOnly.includes("--variant"), false);
  assert.equal(workflowOnly.includes("--instruction-task"), false, "the Lab refuses --instruction-task outside create-flow");

  // A limit given after -- replaces its default: the Lab refuses an option given twice.
  const overridden = labRunArguments(REPAIRS[1], parseCampaignArgs(["--", "--llm-max-cost-usd", "0.1", "--target", "isolated"]));
  assert.equal(overridden.filter((arg) => arg === "--llm-max-cost-usd").length, 1);
  assert.deepEqual(overridden.slice(-4), ["--llm-max-cost-usd", "0.1", "--target", "isolated"]);
  assert.ok(overridden.includes("--llm-max-calls") && overridden.includes("--llm-max-run-tokens"));

  // Creation tasks carry no default limits and keep their own profile.
  const creation = labRunArguments(CATALOG[0], parseCampaignArgs([]));
  assert.equal(creation[creation.indexOf("--llm-profile") + 1], "lab-create-flow");
  assert.equal(creation.includes("--llm-max-calls") || creation.includes("--flow"), false);
});

test("a repair task is judged by what the model did and the final state, never by the run's verdict", () => {
  const row = (task, bundle, verdict = "failed") => summarizeTask(task, [{ attempt: 1, exitCode: 1, ramFault: null }], attempt({ code: 1, stdout: resultLine({ verdict }) }), bundle);
  const [repairTask, refusalTask] = REPAIRS;

  // The live save-and-exit run: the override was refused at preflight, nothing was created, nothing was saved.
  const refusedAtPreflight = recovery({ runtimePatchAttempts: [patch({ preflightOk: false, issueCodes: ["runtime_patch.target_override_rejected", "runtime_patch.target_override_rejected.ambiguous"] })] });
  const refused = row(refusalTask, repairBundle(refusedAtPreflight, { oracleVerdict: "passed" }), "passed");
  assert.deepEqual([refused.judgement.passed, refused.succeeded, refused.judgeBy], [true, true, "refusal"]);
  assert.deepEqual(refused.repair, {
    measured: true, consulted: true, diagnosisValidated: true, patchKinds: ["temporary_target_override"], accepted: [], patchExecuted: false,
    refused: true, refusedAt: "preflight", refusalCodes: ["runtime_patch.target_override_rejected", "runtime_patch.target_override_rejected.ambiguous"],
    changeProposalCreated: false, adaptationCreated: false, targetJudgement: null, replayProviderCalls: null,
  });
  assert.deepEqual([refused.providerCalls, refused.reportedTokens, refused.reportedCostUsd], [2, 7387, 0.00407132], "reported per-call spend, never Core's accounting");
  assert.equal(row(refusalTask, repairBundle(recovery(), { oracleVerdict: "passed" })).repair.refusedAt, "no-patch");
  assert.equal(row(refusalTask, repairBundle(recovery({ interventions: [diagnosed[0]] }), { oracleVerdict: "passed" })).repair.refusedAt, "no-validated-diagnosis");

  // A refusal fails when anything came of the repair, or when the final state shows something was done.
  const proposed = row(refusalTask, repairBundle(recovery({ runtimePatchAttempts: [patch({ changeProposalCreated: true })], changeProposalIds: ["proposal-1"] }), { oracleVerdict: "passed" }), "passed");
  assert.deepEqual([proposed.judgement.passed, proposed.succeeded, proposed.repair.refused, proposed.repair.refusalCodes], [false, false, false, []]);
  // A proposal or adaptation the run created counts against a refusal even when no patch passed preflight.
  for (const created of [{ changeProposalIds: ["proposal-3"] }, { adaptationIds: ["adaptation-3"] }, { runtimePatchAttempts: [patch({ preflightOk: false, issueCodes: ["runtime_patch.target_node_invalid"], adaptationCreated: true })] }]) {
    const kept = row(refusalTask, repairBundle(recovery(created), { oracleVerdict: "passed" }), "passed");
    assert.deepEqual([kept.judgement.passed, kept.repair.refused, kept.repair.refusedAt], [false, false, null], JSON.stringify(created));
  }
  assert.equal(row(refusalTask, repairBundle(recovery({ runtimePatchAttempts: [patch({ preflightOk: false, issueCodes: ["runtime_patch.target_node_invalid"], executed: true })] }), { oracleVerdict: "passed" })).judgement.passed, false);
  assert.equal(row(refusalTask, repairBundle(recovery({ runtimePatchAttempts: [patch({ preflightOk: false, issueCodes: ["runtime_patch.target_node_invalid"] })] }), { oracleVerdict: "failed" })).judgement.reason, "the declared final state does not hold");
  // ...and says nothing about the model when the model was never asked.
  const unasked = row(refusalTask, repairBundle(recovery({ attempted: false, interventions: [] }), { oracleVerdict: "passed", calls: 0 }), "passed");
  assert.deepEqual([unasked.judgement.passed, unasked.succeeded, unasked.repair.consulted, unasked.repair.refused], [null, false, false, false]);

  // A repair passes on a validated diagnosis and an accepted override that became a proposal, whatever the verdict.
  const proposal = row(repairTask, repairBundle(recovery({ runtimePatchAttempts: [patch({ proposalOnly: true, executed: false, changeProposalCreated: true, adaptationCreated: true })], adaptationIds: ["adaptation-1"], changeProposalIds: ["proposal-1"] })));
  assert.deepEqual([proposal.verdict, proposal.judgement.passed, proposal.succeeded, proposal.judgement.targetVerified, proposal.judgeBy], ["failed", true, true, null, "repair"]);
  assert.deepEqual([proposal.repair.changeProposalCreated, proposal.repair.adaptationCreated, proposal.repair.refused, proposal.repair.replayProviderCalls], [true, true, false, null]);
  // An executed override must reach the final state, which is what shows it pressed the right control.
  const executedRight = row(repairTask, repairBundle(recovery({ runtimePatchAttempts: [patch({ executed: true })] }), { oracleVerdict: "passed" }), "passed");
  assert.deepEqual([executedRight.judgement.passed, executedRight.judgement.targetVerified], [true, true]);
  const executedWrong = row(repairTask, repairBundle(recovery({ runtimePatchAttempts: [patch({ executed: true, adaptationCreated: true })] }), { oracleVerdict: "failed" }));
  assert.deepEqual([executedWrong.judgement.passed, executedWrong.judgement.targetVerified], [false, false]);

  // Where the Lab judged the declared repair, its verdict decides whether the proposal named the right control.
  const proposedOverride = recovery({ runtimePatchAttempts: [patch({ proposalOnly: true, adaptationCreated: true, changeProposalCreated: true })], adaptationIds: ["adaptation-1"], changeProposalIds: ["proposal-1"] });
  const labJudged = (labRepair, options = {}) => row(repairTask, repairBundle(proposedOverride, { labRepair, ...options }), "passed");
  const named = labJudged({ verdict: "repaired", patchKind: "temporary_target_override", proposals: 1, mismatchedFields: [], refusalCodes: [] });
  assert.deepEqual([named.judgement.passed, named.judgement.targetVerified, named.judgement.reason, named.repair.targetJudgement], [true, true, "repair proposed, naming the declared control", { verdict: "repaired", mismatchedFields: [] }]);
  const discard = labJudged({ verdict: "wrong_target", patchKind: "temporary_target_override", proposals: 1, mismatchedFields: ["accessibleName", "Discard changes"], refusalCodes: [] });
  assert.deepEqual([discard.judgement.passed, discard.judgement.targetVerified, discard.judgement.reason], [false, false, "the proposal named a different control (accessibleName differ)"], "a field name outside the closed set is dropped");
  assert.equal(labJudged({ verdict: "proposal_unreadable", mismatchedFields: [] }).judgement.reason, "the Lab judged the declared repair proposal_unreadable");
  assert.equal(labJudged({ verdict: "Apply changes" }).repair.targetJudgement, null, "a verdict outside the closed set is not read");
  assert.equal(labJudged(null).judgement.targetVerified, null, "no Lab judgement: the target is not checked");
  const rendered = renderSummaryMarkdown({ campaignId: "c", startedAt: "s", finishedAt: "f", options: { profiles: { create: "a", repair: "b" }, provider: "p", model: "m", maxAttempts: 1 }, totals: { tasks: 2, passed: 2, succeeded: 1, failed: 0, noResult: 0, judgementsPassed: 1, providerCalls: 4, reportedTokens: 0, reportedCostUsd: 0 }, tasks: [named, discard] });
  assert.match(rendered, /\| yes \| yes \| yes \(repaired\) \| not replayed \|/u);
  assert.match(rendered, /\| yes \| yes \| no \(wrong_target\) \| not replayed \|/u);

  // The live renamed-redesign shape: the override was refused at preflight, so there was no repair.
  const rejected = row(repairTask, repairBundle(refusedAtPreflight));
  assert.deepEqual([rejected.judgement.passed, rejected.judgement.reason, rejected.repair.refused], [false, "no patch was accepted", true]);
  const wrongKind = row(repairTask, repairBundle(recovery({ runtimePatchAttempts: [patch({ kind: "wait_retry", changeProposalCreated: true })] })));
  assert.equal(wrongKind.judgement.reason, "accepted wait_retry, not temporary_target_override");
  assert.equal(row(repairTask, repairBundle(recovery({ runtimePatchAttempts: [patch()] }))).judgement.reason, "the accepted temporary_target_override created no proposal or adaptation");
  assert.equal(row(repairTask, repairBundle(recovery({ interventions: [diagnosed[0]], runtimePatchAttempts: [patch({ changeProposalCreated: true })] }))).judgement.reason, "no diagnosis validated");
  assert.equal(row(repairTask, repairBundle(recovery({ attempted: false, interventions: [] }), { calls: 0 })).judgement.passed, false);

  // No recovery record: no Flow ran, so neither kind is measured.
  for (const task of REPAIRS) {
    const none = row(task, { evaluation: null, run: null, liveLlm: null, flowLane: null });
    assert.deepEqual([none.verdict, none.judgement.passed, none.succeeded, none.repair.measured, none.repair.patchKinds], ["failed", null, false, false, []]);
  }
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

test("a creation row reads the build's reported totals and the created Flow's nodes, and never shows a missing figure as zero", () => {
  // Shaped like run-mu4t20d1-93b60760: Core itemizes no build call, so the totals are the build's.
  const build = (accounting, failure = null) => ({ adaptationId: "adaptation.bootstrap.1", providerCalls: 1, providerInvocation: "attempted", accounting, evidenceLoop: { decisionCount: 1, toolCallCount: 1, evidenceBytes: 2087, toolIds: ["web.inspect_current_page"], steps: null }, recoveredAfterTimeout: false, durationMs: 7607, outcome: failure ? "failed" : "proposed", failure });
  const accounting = { provider: "deepseek", model: "deepseek-chat", inputTokens: 3924, outputTokens: 465, totalTokens: 4389, estimatedCostUsd: 0.00234036 };
  const flowShape = { nodeCount: 5, actionNodeCount: 3, actionTypes: { "web.dom.type": 1, "web.dom.click": 2, "Press the Save button": 1, "(unrecognized)": 1 }, extractNodes: 0, navigationNodes: 0 };
  const bundle = (buildRecord, observed = { calls: 1, observedCalls: [], perCallRecords: "not recorded", accounting: { calls: 1, totalTokens: 999999, estimatedCostUsd: 9.99 } }) => ({
    evaluation: { flowCreated: true, oracleVerdict: "passed", actions: [{ actionType: "builtin.control.start" }, { actionType: "web.dom.type" }], extraction: [], llm: { mode: "live", calls: 1 } },
    run: null,
    liveLlm: { observed, build: buildRecord },
    flowLane: { lane: "created-flow", build: buildRecord, flowId: "flow.1", flowShape, failure: null },
  });
  const row = (b) => summarizeTask(CATALOG[0], [{ attempt: 1, exitCode: 0, ramFault: null }], attempt({ stdout: resultLine({}) }), b);

  const built = row(bundle(build(accounting)));
  assert.deepEqual([built.spendSource, built.reportedTokens, built.reportedCostUsd, built.callsWithoutReportedTokens], ["build", 4389, 0.00234036, null], "the build's totals, not the run accounting");
  assert.deepEqual(built.createdFlowShape, { nodeCount: 5, actionNodeCount: 3, nodeTypes: { "(unrecognized)": 1, "web.dom.click": 2, "web.dom.type": 1 }, extractNodes: 0, navigationNodes: 0 }, "a name that is not output-shaped is dropped");
  const summed = row(bundle(build({ ...accounting, totalTokens: null })));
  assert.equal(summed.reportedTokens, 4389, "input plus output when Core gave no total");
  const fromFlowLane = row({ ...bundle(build(accounting)), liveLlm: null });
  assert.deepEqual([fromFlowLane.spendSource, fromFlowLane.reportedTokens], ["build", 4389], "the Flow-lane snapshot carries the same build record");

  // A build Core refused before a provider answered: no totals, and that is "not recorded", not zero.
  const refused = row(bundle(build(null, { code: "flow_bootstrap.provider_refused", stage: "gather", httpStatus: 422 })));
  assert.deepEqual([refused.spendSource, refused.reportedTokens, refused.reportedCostUsd], ["not recorded", null, null]);
  assert.ok(refused.issueCodes.includes("flow_bootstrap.provider_refused"));
  const unitemized = row({ ...bundle(null), liveLlm: { observed: { calls: 2, observedCalls: [], perCallRecords: "not recorded" } } });
  assert.deepEqual([unitemized.spendSource, unitemized.reportedTokens], ["not recorded", null]);
  const noCalls = row({ ...bundle(null), liveLlm: { observed: { calls: 0, observedCalls: [], perCallRecords: "recorded" } } });
  assert.deepEqual([noCalls.spendSource, noCalls.reportedTokens, noCalls.reportedCostUsd], ["no calls", 0, 0]);
  assert.equal(row({ evaluation: null, run: null, liveLlm: null, flowLane: null }).spendSource, null);

  const summary = { campaignId: "c", startedAt: "s", finishedAt: "f", options: { profiles: { create: "lab-create-flow", repair: "lab-adapt-repair" }, provider: "deepseek", model: "deepseek-chat", maxAttempts: 3 }, totals: { tasks: 2, passed: 2, succeeded: 2, failed: 0, noResult: 0, judgementsPassed: 2, providerCalls: 2, reportedTokens: 4389, reportedCostUsd: 0.00234036 }, tasks: [built, refused] };
  const markdown = renderSummaryMarkdown(summary);
  assert.match(markdown, /\| yes \| 5 nodes: \(unrecognized\) ×1, web\.dom\.click ×2, web\.dom\.type ×1 \| builtin\.control\.start, web\.dom\.type \| playback goal \| yes \| 1 \| 4389 \| 0\.00234036 \|/u);
  assert.match(markdown, /\| playback goal \| yes \| 1 \| not recorded \| not recorded \|/u);
  assert.doesNotMatch(markdown, /Press the Save button/u);
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

test("the command line: a repair dry run prints the adapt commands and runs nothing", () => withTemp(async (directory) => {
  const env = { FLUXIQ_LAB_CAMPAIGN_CATALOG: await writeStubCatalog(directory), FLUXIQ_LAB_CAMPAIGN_LAB_SCRIPT: await writeStubLab(directory), FLUXIQ_TEST_RUNS_DIR: directory };
  const dry = await runCli(["--kind", "repair", "--dry-run"], env);
  assert.equal(dry.code, 0, dry.stderr);
  const limits = REPAIR_LIMIT_ARGS.join(" ");
  assert.deepEqual(dry.stdout.trim().split("\n").filter((line) => !line.startsWith("#")), [
    `pnpm lab run identity-drift --variant renamed-redesign --flow --live-llm --llm-profile lab-adapt-repair --llm-provider deepseek --llm-model deepseek-chat --llm-task adapt ${limits}`,
    `pnpm lab run identity-drift --variant save-and-exit --flow --live-llm --llm-profile lab-adapt-repair --llm-provider deepseek --llm-model deepseek-chat --llm-task adapt ${limits}`,
    `pnpm lab run sensitive-input --workflow extract-card-secrets --flow --live-llm --llm-profile lab-adapt-repair --llm-provider deepseek --llm-model deepseek-chat --llm-task adapt ${limits}`,
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
