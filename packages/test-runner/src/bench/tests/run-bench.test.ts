import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { parseBenchReportJson, parseRunEvaluationJson, type RunEvaluation, type WebScenario } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../../failure.js";
import { ProjectedFacilityError } from "../../facility-failure/index.js";
import type { RunLaneObservation } from "../../flow-lane/index.js";
import type { RunScenarioOptions, RunScenarioResult } from "../../run-scenario.js";
import type { BenchCorpus } from "../corpus/index.js";
import { acquireCampaignLease, BENCH_SEMANTICS_VERSION, CAMPAIGN_SCHEMA_VERSION, CAMPAIGN_SHARD_ALGORITHM, campaignPlanSha256, canonicalJson, createCampaignPlan, createCampaignPlanShards, loadCampaignCheckpointChain, sha256Canonical, writeCampaignManifest, type CampaignCompatibility, type CampaignManifest } from "../campaign/index.js";
import { expandCorpus, VARIANT_NEEDS_FLOW_LANE } from "../expand-corpus.js";
import type { BenchRunsFile } from "../report-store.js";
import { createResumableBench, executePrecreatedBenchCampaign, publishPrecreatedBenchParentProjections, resumeBench, runBench, type AuthenticatedBenchCampaignEvaluation, type BenchCampaignCrashPoint, type PrecreatedBenchCampaignOptions, type ResumableRunBenchOptions, type RunBenchOptions } from "../run-bench.js";

// Only the fields resolveScenarioWorkflow reads.
const scenario = (id: string, extra: Partial<WebScenario> = {}): WebScenario => ({ id, recordingScript: [], expected: {}, ...extra }) as WebScenario;
const manifests = [
  scenario("basic-form", { workflows: [{ id: "combo", description: "A named workflow", recordingScript: [{ id: "open", operation: "click", target: "#open" }], expected: {} }] }),
  scenario("iframe-checkout", { variants: [{ id: "drift", description: "Drift", arm: { operation: "drift" }, expected: {} }] }),
];
const corpus: BenchCorpus = {
  id: "unit",
  description: "Unit corpus",
  lanes: ["recording"],
  rows: [
    { id: "W01", scenarioId: "basic-form", workflowId: null, unarmed: true, variantIds: [] },
    { id: "W02", scenarioId: "basic-form", workflowId: "combo", unarmed: true, variantIds: [] },
    { id: "W28", scenarioId: "iframe-checkout", workflowId: null, unarmed: true, variantIds: ["drift"] },
    { id: "W99", scenarioId: "iframe-checkout", workflowId: "missing", unarmed: true, variantIds: [] },
  ],
};

/** The same corpus run on both lanes: every unarmed row runs on the Flow lane too, and the `drift` variant of W28 becomes a Flow-lane result instead of a skip. */
const bothLanes: BenchCorpus = { ...corpus, lanes: ["recording", "flow"] };
const oneCellCorpus: BenchCorpus = { ...corpus, rows: [corpus.rows[0]!] };

function runManifest(runId: string, scenarioId: string, verdict: "passed" | "failed") {
  return {
    schemaVersion: "0.1", runId, scenarioId, scenarioRevision: "a".repeat(64), seed: 1, status: verdict,
    startedAt: "2026-09-11T10:00:00.000Z", finishedAt: "2026-09-11T10:00:40.000Z",
    repositories: { facility: { path: "F:\\facility", commit: "b".repeat(40), dirty: false }, core: { path: "F:\\core", commit: "c".repeat(40), dirty: false } },
    compatibility: [], lockfiles: [], extension: { version: "0.1.0", sha256: "d".repeat(64), path: "apps/extension/dist/e2e-chromium" },
    environment: { os: "win32", architecture: "x64", browserName: "chromium", browserVersion: "Chrome/134.0.6998.35", locale: "en-US", timezone: "UTC", viewport: { width: 1280, height: 720 } },
    ports: {}, processExits: {}, artifacts: [], redactionState: "verified", verdict, fluxiqExecution: { targetMode: "isolated" },
    automationFailure: null, steps: [],
    actions: [{ actionType: "web.dom.type", startedAt: "2026-09-11T10:00:10.000Z", durationMs: 1_500, status: "succeeded" }],
  };
}

/** The observation a Flow-lane run publishes when the Flow was built, ran, and reported success. */
const flowObservation = (): RunLaneObservation => ({
  lane: "flow", flowCreated: true, oracleVerdict: "passed", reportedVerdict: "passed",
  automationFailureReported: null, automationFailureExpected: null, harnessActivations: 0,
  actions: [{ actionType: "web.dom.click", durationMs: 210 }, { actionType: "web.dom.type", durationMs: 340 }],
  extraction: null,
});

/** A runner that writes a minimal finalized bundle for each run and records what it was asked to run. */
function fakeRunner(calls: string[], verdictFor: (options: RunScenarioOptions) => "passed" | "failed" = () => "passed") {
  return async (options: RunScenarioOptions): Promise<RunScenarioResult> => {
    const runId = `run-unit-${calls.length}`;
    calls.push(`${options.scenarioId}/${options.workflowId ?? "primary"}/${options.evidence ?? "manifest"}`);
    const verdict = verdictFor(options);
    const runPath = path.join(options.runsDirectory, runId);
    await mkdir(runPath, { recursive: true });
    await writeFile(path.join(runPath, "run.json"), JSON.stringify(runManifest(runId, options.scenarioId, verdict)));
    await writeFile(path.join(runPath, "summary.json"), JSON.stringify({ verdict, metrics: { steps: 3 } }));
    await writeFile(path.join(runPath, "events.ndjson"), `${JSON.stringify({ sequence: 1, trigger: "step.start" })}\n${JSON.stringify({ sequence: 2, trigger: verdict === "passed" ? "final" : "error" })}\n`);
    return { runId, verdict, path: runPath, ...(options.flow ? { observation: flowObservation() } : {}), ...(verdict === "failed" ? { failureCategory: "runtime.behavior" } : {}) };
  };
}

const options = (root: string, overrides: Partial<RunBenchOptions>): RunBenchOptions => ({
  corpus, repeatCount: 2, target: { mode: "isolated" }, manifests,
  repositoryRoot: root, fluxiqRepositoryRoot: root, runsDirectory: path.join(root, "runs"), environment: {},
  runScenario: fakeRunner([]), inspectRun: async () => ({ valid: true }), ...overrides,
});
const readRuns = async (directory: string): Promise<BenchRunsFile> => JSON.parse(await readFile(path.join(directory, "runs.json"), "utf8")) as BenchRunsFile;
const sha256Bytes = (value: string | Buffer): string => createHash("sha256").update(value).digest("hex");

async function campaignBytes(directory: string): Promise<Buffer[]> {
  const bytes: Buffer[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const location = path.join(directory, entry.name);
    if (entry.isDirectory()) bytes.push(...await campaignBytes(location));
    else if (entry.isFile()) bytes.push(await readFile(location));
  }
  return bytes;
}

const campaignCompatibility: CampaignCompatibility = {
  repositories: { facilityCommit: "1".repeat(40), coreCommit: "2".repeat(40) },
  lockfiles: { facilitySha256: "3".repeat(64), coreSha256: "4".repeat(64) },
  builds: { testRunnerSha256: "5".repeat(64), extensionSha256: "6".repeat(64), scenarioLabSha256: "7".repeat(64) },
  environment: { platform: "win32", architecture: "x64", browserName: "chromium", browserVersion: "Chrome/134", locale: "en-US", timezone: "UTC", viewport: { width: 1280, height: 720 } },
};

function campaignEvaluation(runId: string, options: RunScenarioOptions): RunEvaluation {
  const observation = options.flow ? flowObservation() : undefined;
  return {
    schemaVersion: "0.3", runId, verdict: "passed", facilityFailure: null, invariants: [], metrics: { steps: 3 }, scenarioId: options.scenarioId,
    workflowId: options.workflowId ?? null, variantId: options.variantId ?? null, repeatIndex: options.benchReceipt?.cellIdentity.repeatIndex ?? 0, lane: options.flow ? "flow" : "recording",
    flowCreated: observation?.flowCreated ?? null, oracleVerdict: "passed", reportedVerdict: "passed", automationFailureReported: null,
    automationFailureExpected: null, harnessActivations: observation?.harnessActivations ?? 0, durationMs: 40_000,
    actions: observation?.actions ?? [{ actionType: "web.dom.type", durationMs: 1_500 }], evidence: { sanitizedPacketBytes: [], rawSnapshotBytes: [], truncationCount: 0 },
    llm: { mode: "disabled", profileId: null, calls: 0 }, extraction: null, harnessRecovery: null, adaptationCost: null, adaptationValidation: null, adaptationPersistence: null, adaptationReuse: null,
  };
}

function campaignRunner(calls: string[]) {
  return async (options: RunScenarioOptions): Promise<RunScenarioResult> => {
    assert.ok(options.runId && options.benchReceipt);
    calls.push(options.runId);
    const runPath = path.join(options.runsDirectory, options.runId);
    await mkdir(runPath, { recursive: true });
    const evaluation = campaignEvaluation(options.runId, options);
    await writeFile(path.join(runPath, "run.json"), JSON.stringify(runManifest(options.runId, options.scenarioId, "passed")));
    await writeFile(path.join(runPath, "summary.json"), JSON.stringify({ verdict: "passed", metrics: { steps: 3 } }));
    await writeFile(path.join(runPath, "events.ndjson"), `${JSON.stringify({ sequence: 2, trigger: "final" })}\n`);
    await writeFile(path.join(runPath, "evaluation.json"), JSON.stringify(evaluation));
    await writeFile(path.join(runPath, "bench-receipt.json"), JSON.stringify({ schemaVersion: "0.1", ...options.benchReceipt, runId: options.runId }));
    return { runId: options.runId, verdict: "passed", path: runPath, evaluation, ...(options.flow ? { observation: flowObservation() } : {}) };
  };
}

const resumableOptions = (root: string, benchId: string, calls: string[], crashHook?: ResumableRunBenchOptions["crashHook"]): ResumableRunBenchOptions => ({
  ...options(root, { repeatCount: 2, runScenario: campaignRunner(calls) }), compatibility: campaignCompatibility, benchId,
  campaignLeaseOptions: { processId: 4101, processProbe: { bootIdentity: async () => "test-boot", processIdentity: async () => "test-process" } },
  ...(crashHook ? { crashHook } : {}),
});

async function precreatedChild(root: string, calls: string[], childIndex = 0, crashHook?: PrecreatedBenchCampaignOptions["crashHook"]): Promise<PrecreatedBenchCampaignOptions> {
  const parentId = "bench-parent-0123abcd";
  const configured = resumableOptions(root, parentId, calls, crashHook);
  const entries = expandCorpus(configured.corpus, configured.manifests);
  const plan = createCampaignPlan(entries, configured.repeatCount);
  const parent: CampaignManifest = {
    schemaVersion: CAMPAIGN_SCHEMA_VERSION,
    benchId: parentId,
    createdAt: "2026-09-14T00:00:00.000Z",
    benchSemanticsVersion: BENCH_SEMANTICS_VERSION,
    request: { corpusId: configured.corpus.id, repeatCount: configured.repeatCount, target: { mode: configured.target.mode as "isolated" | "persistent-isolated", workspace: configured.target.mode === "persistent-isolated" ? configured.target.workspace : null }, evidence: configured.evidence ?? null },
    plan,
    planSha256: campaignPlanSha256(plan),
    compatibility: configured.compatibility,
    execution: { mode: "shard-parent", algorithm: CAMPAIGN_SHARD_ALGORITHM, shardCount: 2, jobs: 1 },
  };
  const parentDirectory = path.join(configured.runsDirectory, "bench", parentId);
  const shards = createCampaignPlanShards(plan, parent.execution.mode === "shard-parent" ? parent.execution.shardCount : 0);
  const shard = shards[childIndex];
  assert.ok(shard);
  const manifest: CampaignManifest = {
    schemaVersion: CAMPAIGN_SCHEMA_VERSION,
    benchId: `bench-shard${childIndex}-${sha256Canonical([parentId, childIndex]).slice(0, 8)}`,
    createdAt: parent.createdAt,
    benchSemanticsVersion: parent.benchSemanticsVersion,
    request: parent.request,
    plan: shard.plan,
    planSha256: campaignPlanSha256(shard.plan),
    compatibility: parent.compatibility,
    execution: { mode: "shard-child", algorithm: CAMPAIGN_SHARD_ALGORITHM, parentCampaignId: parentId, parentPlanSha256: parent.planSha256, shardIndex: childIndex, shardCount: shards.length },
  };
  await writeCampaignManifest(parentDirectory, parent);
  for (const candidate of shards) {
    const child: CampaignManifest = candidate.index === childIndex ? manifest : {
      ...manifest,
      benchId: `bench-shard${candidate.index}-${sha256Canonical([parentId, candidate.index]).slice(0, 8)}`,
      plan: candidate.plan,
      planSha256: campaignPlanSha256(candidate.plan),
      execution: { mode: "shard-child", algorithm: CAMPAIGN_SHARD_ALGORITHM, parentCampaignId: parentId, parentPlanSha256: parent.planSha256, shardIndex: candidate.index, shardCount: shards.length },
    };
    await writeCampaignManifest(path.join(parentDirectory, "shards", candidate.index.toString().padStart(3, "0")), child);
  }
  const { benchId: _benchId, ...childOptions } = configured;
  return { ...childOptions, directory: path.join(parentDirectory, "shards", childIndex.toString().padStart(3, "0")), manifest };
}

test("runs each runnable result once per repeat, one pass over the corpus at a time, and writes evaluations and a valid report", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-bench-run-"));
  try {
    const calls: string[] = [];
    const outcome = await runBench(options(root, { runScenario: fakeRunner(calls) }));
    assert.deepEqual(calls, ["basic-form/primary/manifest", "basic-form/combo/manifest", "iframe-checkout/primary/manifest", "basic-form/primary/manifest", "basic-form/combo/manifest", "iframe-checkout/primary/manifest"]);
    assert.deepEqual([outcome.status, outcome.results, outcome.runs, outcome.passed, outcome.skipped], ["passed", 3, 6, 6, 4]);
    assert.equal(path.dirname(outcome.directory), path.join(root, "runs", "bench"));
    const report = parseBenchReportJson(await readFile(path.join(outcome.directory, "report.json"), "utf8"));
    assert.deepEqual(report.workflows.map((workflow) => [workflow.corpusRowId, workflow.workflowId, workflow.lane, workflow.flakeClass]), [["W01", null, "recording", "stable-pass"], ["W02", "combo", "recording", "stable-pass"], ["W28", null, "recording", "stable-pass"]]);
    assert.deepEqual([report.reportId, report.corpusId, report.repeatCount, report.target, report.llm.mode], [outcome.benchId, "unit", 2, "isolated", "disabled"]);
    // A corpus with no Flow lane writes a valid report stating the recording lane's rates alone.
    assert.deepEqual(Object.keys(report.metrics.ratesByLane ?? {}), ["recording"]);
    assert.deepEqual(report.metrics.ratesByLane?.recording?.initialExecutionSuccess, { count: 3, total: 3, workflows: 3, rate: 1 });
    assert.deepEqual(report.metrics.actionLatencyMs["web.dom.type"], { samples: 6, p50: 1_500, p95: 1_500 });
    const runs = await readRuns(outcome.directory);
    const skipped = runs.runs.filter((run) => run.status === "skipped");
    assert.deepEqual(skipped.map((run) => [run.corpusRowId, run.variantId, run.repeatIndex]), [["W28", "drift", 0], ["W28", "drift", 1], ["W99", null, 0], ["W99", null, 1]]);
    assert.equal(skipped[0]?.skipReason, VARIANT_NEEDS_FLOW_LANE);
    assert.match(skipped[2]?.skipReason ?? "", /^unresolved: .*no workflow missing/);
    const evaluated = runs.runs.filter((run) => run.status === "evaluated");
    assert.equal(evaluated.length, 6);
    for (const record of evaluated) {
      const evaluation = parseRunEvaluationJson(await readFile(path.join(outcome.directory, record.evaluation ?? "missing"), "utf8"));
      assert.deepEqual([evaluation.runId, evaluation.repeatIndex, evaluation.lane, evaluation.harnessActivations, evaluation.durationMs, evaluation.reportedVerdict], [record.runId, record.repeatIndex, "recording", 0, 40_000, "passed"]);
    }
    const markdown = await readFile(outcome.markdown, "utf8");
    assert.match(markdown, /## Skipped/);
    assert.ok(markdown.includes(VARIANT_NEEDS_FLOW_LANE));
    assert.match(markdown, /harnessActivations: 0: the recording lane runs no Flow/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a resumable campaign recovers all five persistence crash boundaries without duplicate scenario execution", async (t) => {
  const points: BenchCampaignCrashPoint[] = ["after-campaign-published", "after-attempt-checkpoint", "after-bundle-finalized", "after-completion-checkpoint", "before-aggregation"];
  for (const [pointIndex, point] of points.entries()) await t.test(point, async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-bench-resume-"));
    const benchId = `bench-unit${pointIndex}-0123abcd`;
    const calls: string[] = [];
    let crashed = false;
    try {
      await assert.rejects(createResumableBench(resumableOptions(root, benchId, calls, async (at) => {
        if (!crashed && at === point) {
          crashed = true;
          if (point === "after-attempt-checkpoint") await mkdir(path.join(root, "runs", `.staging-${benchId}-c0-a1`), { recursive: true });
          throw new Error(`crash at ${point}`);
        }
      })), new RegExp(`crash at ${point}`, "u"));
      const resumed = await resumeBench({ ...resumableOptions(root, benchId, calls), benchId });
      assert.deepEqual([resumed.benchId, resumed.status, resumed.runs, resumed.skipped], [benchId, "passed", 6, 4]);
      assert.equal(new Set(calls).size, 6, "a finalized active attempt is reconciled, never rerun");
      assert.equal(calls.length, 6);
      if (point === "after-attempt-checkpoint") assert.equal((await stat(path.join(resumed.directory, "interrupted", `${benchId}-c0-a1`))).isDirectory(), true);
      const runs = await readRuns(resumed.directory);
      assert.equal(runs.runs.filter((run) => run.status === "evaluated").length, 6);
      assert.equal(new Set(runs.runs.filter((run) => run.status === "evaluated").map((run) => `${run.corpusRowId}/${run.lane}/${run.repeatIndex}`)).size, 6);
      const firstReport = JSON.parse(await readFile(resumed.report ?? "missing", "utf8")) as Record<string, unknown>;
      const again = await resumeBench({ ...resumableOptions(root, benchId, calls), benchId });
      const secondReport = JSON.parse(await readFile(again.report ?? "missing", "utf8")) as Record<string, unknown>;
      delete firstReport.generatedAt; delete secondReport.generatedAt;
      assert.deepEqual(secondReport, firstReport, "idempotent resume regenerates equivalent aggregate content apart from its timestamp");
      assert.equal(calls.length, 6);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});

test("a nested precreated shard child leases its own directory and resumes a finalized interruption exactly once", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-bench-child-"));
  const calls: string[] = [];
  let crashed = false;
  let acquired = 0;
  let released = 0;
  let active = 0;
  const withCellSlot = async <T>(operation: () => Promise<T>): Promise<T> => {
    acquired += 1; active += 1;
    try { return await operation(); }
    finally { active -= 1; released += 1; }
  };
  try {
    const child = { ...await precreatedChild(root, calls, 0, (point) => {
      if (!crashed && point === "after-bundle-finalized") { crashed = true; throw new Error("stop nested child after bundle"); }
    }), withCellSlot };
    await assert.rejects(executePrecreatedBenchCampaign(child), /stop nested child after bundle/u);
    assert.equal(calls.length, 1);
    assert.deepEqual([acquired, released, active], [1, 1, 0], "post-bundle interruption happens after the cell slot is released");
    const { crashHook: _crashHook, ...resume } = child;
    const outcome = await executePrecreatedBenchCampaign(resume);
    const runnable = child.manifest.plan.filter(({ skipReason }) => skipReason === null).length;
    assert.deepEqual([outcome.directory, outcome.runs, outcome.skipped], [path.resolve(child.directory), runnable, child.manifest.plan.length - runnable]);
    assert.equal(calls.length, runnable);
    assert.equal(new Set(calls).size, runnable, "the finalized child attempt is reconciled rather than rerun");
    await executePrecreatedBenchCampaign(resume);
    assert.equal(calls.length, runnable, "a finished child remains exactly-once on another resume");
    assert.deepEqual([acquired, released, active], [calls.length, calls.length, 0], "every passing cell releases its slot and reconciliation acquires none");
    assert.equal(await stat(path.join(child.directory, "lease")).then(() => true, () => false), false, "the child lease is released");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("a precreated child releases its per-cell slot when runScenario fails", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-bench-child-slot-failure-"));
  let calls = 0;
  let acquired = 0;
  let released = 0;
  let active = 0;
  try {
    const base = await precreatedChild(root, [], 0);
    const outcome = await executePrecreatedBenchCampaign({
      ...base,
      runScenario: async () => { calls += 1; throw new Error("closed test failure"); },
      withCellSlot: async <T>(operation: () => Promise<T>): Promise<T> => {
        acquired += 1; active += 1;
        try { return await operation(); }
        finally { active -= 1; released += 1; }
      },
    });
    const runnable = base.manifest.plan.filter(({ skipReason }) => skipReason === null).length;
    assert.deepEqual([outcome.status, calls, acquired, released, active], ["failed", runnable, runnable, runnable, 0]);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("precreated child execution rejects parent, path, parent-plan, and current-plan contradictions", async (t) => {
  for (const kind of ["parent", "outside", "wrong-directory", "wrong-parent-plan", "current-plan"] as const) await t.test(kind, async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-bench-child-guard-"));
    try {
      const child = await precreatedChild(root, [], 0);
      const parentDirectory = path.dirname(path.dirname(child.directory));
      if (kind === "parent") {
        const parent = JSON.parse(await readFile(path.join(parentDirectory, "campaign.json"), "utf8")) as CampaignManifest;
        await assert.rejects(executePrecreatedBenchCampaign({ ...child, directory: parentDirectory, manifest: parent }), /refuses a shard parent/u);
      } else if (kind === "outside") {
        await assert.rejects(executePrecreatedBenchCampaign({ ...child, directory: path.join(root, "outside") }), /inside the bench root/u);
      } else if (kind === "wrong-directory") {
        await assert.rejects(executePrecreatedBenchCampaign({ ...child, directory: path.join(parentDirectory, "shards", "001") }), /does not match its immutable/u);
      } else if (kind === "wrong-parent-plan") {
        assert.equal(child.manifest.execution.mode, "shard-child");
        const manifest: CampaignManifest = { ...child.manifest, execution: { ...child.manifest.execution, parentPlanSha256: "f".repeat(64) } };
        await writeFile(path.join(child.directory, "campaign.json"), canonicalJson(manifest));
        await assert.rejects(executePrecreatedBenchCampaign({ ...child, manifest }), /parent plan authority does not match/u);
      } else {
        const changedCorpus: BenchCorpus = { ...child.corpus, rows: child.corpus.rows.slice(0, 2) };
        await assert.rejects(executePrecreatedBenchCampaign({ ...child, corpus: changedCorpus }), /parent plan does not match the current corpus/u);
      }
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});

test("a live lease on one nested child excludes a second executor", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-bench-child-lease-"));
  try {
    const child = await precreatedChild(root, [], 0);
    const lease = await acquireCampaignLease(child.directory, child.campaignLeaseOptions);
    try { await assert.rejects(executePrecreatedBenchCampaign(child), /already owned by live process/u); }
    finally { await lease.release(); }
    const outcome = await executePrecreatedBenchCampaign(child);
    assert.equal(outcome.status, "passed");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("authenticated child evaluations publish canonical parent projections without owning checkpoints or a seal", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-bench-parent-projection-"));
  const calls: string[] = [];
  try {
    const first = await precreatedChild(root, calls, 0);
    const parentDirectory = path.dirname(path.dirname(first.directory));
    const secondDirectory = path.join(parentDirectory, "shards", "001");
    const secondManifest = JSON.parse(await readFile(path.join(secondDirectory, "campaign.json"), "utf8")) as CampaignManifest;
    await executePrecreatedBenchCampaign(first);
    await executePrecreatedBenchCampaign({ ...first, directory: secondDirectory, manifest: secondManifest });

    const authenticated = new Map<string, AuthenticatedBenchCampaignEvaluation>();
    for (const [directory, manifest] of [[first.directory, first.manifest], [secondDirectory, secondManifest]] as const) {
      const chain = await loadCampaignCheckpointChain(directory, manifest);
      assert.equal(chain.latest?.state, "finished");
      for (const completed of chain.latest?.completed ?? []) {
        const evaluation = parseRunEvaluationJson(await readFile(path.join(directory, ...completed.evaluation.split("/")), "utf8"));
        authenticated.set(completed.cellKey, { completed, evaluation });
      }
    }
    const parent = JSON.parse(await readFile(path.join(parentDirectory, "campaign.json"), "utf8")) as CampaignManifest;
    const evaluations = parent.plan.filter(({ skipReason }) => skipReason === null).map(({ cellKey }) => {
      const value = authenticated.get(cellKey); assert.ok(value); return value;
    });
    const projectionOptions = { runsDirectory: first.runsDirectory, directory: parentDirectory, manifest: parent, evaluations };
    const outcome = await publishPrecreatedBenchParentProjections(projectionOptions);
    assert.deepEqual([outcome.directory, outcome.runs, outcome.skipped], [parentDirectory, evaluations.length, parent.plan.length - evaluations.length]);
    const runs = await readRuns(parentDirectory);
    assert.deepEqual(runs.runs.map((record) => `${record.corpusRowId}/${record.lane}/${record.repeatIndex}`), parent.plan.map((cell) => `${cell.corpusRowId}/${cell.lane}/${cell.repeatIndex}`));
    for (const record of runs.runs.filter((candidate) => candidate.status === "evaluated")) {
      assert.match(record.evaluation ?? "", /^shards\/00[01]\/evaluations\//u);
      assert.equal(parseRunEvaluationJson(await readFile(path.join(parentDirectory, ...(record.evaluation ?? "missing").split("/")), "utf8")).runId, record.runId);
    }
    assert.equal(await stat(path.join(parentDirectory, "checkpoints")).then(() => true, () => false), false);
    assert.equal(await stat(path.join(parentDirectory, "merge-seal.json")).then(() => true, () => false), false);
    await assert.rejects(publishPrecreatedBenchParentProjections({ ...projectionOptions, evaluations: evaluations.slice(1) }), /exact executable plan coverage/u);
    const [head, ...tail] = evaluations; assert.ok(head);
    await assert.rejects(publishPrecreatedBenchParentProjections({ ...projectionOptions, evaluations: [{ ...head, evaluation: { ...head.evaluation, repeatIndex: 99 } }, ...tail] }), /evaluation identity does not match/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("a synthetic facility diagnostic survives completion-checkpoint crash and resume exactly once without persisting its raw cause", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-bench-diagnostic-"));
  const benchId = "bench-diagnostic-0123abcd";
  const sentinel = "SYNTHETIC_SECRET_SENTINEL_DO_NOT_PERSIST";
  const facilityFailure = { boundary: "no-final-bundle", stage: "scenario.load", reason: "module.missing", causeCode: "ERR_MODULE_NOT_FOUND" } as const;
  let calls = 0;
  let crashed = false;
  const runScenario = async (): Promise<RunScenarioResult> => {
    calls += 1;
    throw new ProjectedFacilityError(Object.assign(new Error(sentinel), { code: "ERR_MODULE_NOT_FOUND", path: sentinel, credential: sentinel }), facilityFailure);
  };
  const configured = (): ResumableRunBenchOptions => ({
    ...resumableOptions(root, benchId, []), corpus: oneCellCorpus, repeatCount: 1, runScenario,
    crashHook: (point) => { if (!crashed && point === "after-completion-checkpoint") { crashed = true; throw new Error("stop after diagnostic checkpoint"); } },
  });
  try {
    await assert.rejects(createResumableBench(configured()), /stop after diagnostic checkpoint/u);
    assert.equal(calls, 1);
    const campaignDirectory = path.join(root, "runs", "bench", benchId);
    const [evaluationName] = await readdir(path.join(campaignDirectory, "evaluations"));
    assert.ok(evaluationName);
    const before = parseRunEvaluationJson(await readFile(path.join(campaignDirectory, "evaluations", evaluationName), "utf8"));
    assert.deepEqual(before.facilityFailure, facilityFailure);

    const { crashHook: _firstCrashHook, ...resumeOptions } = configured();
    const resumed = await resumeBench({ ...resumeOptions, benchId });
    assert.equal(calls, 1, "the completed synthetic attempt is not executed twice");
    const [record] = (await readRuns(campaignDirectory)).runs.filter((run) => run.status === "evaluated");
    assert.deepEqual(record?.facilityFailure, facilityFailure);
    assert.deepEqual(resumed.failureCauses, ["1 run — environment.missing: no-final-bundle / scenario.load / module.missing / ERR_MODULE_NOT_FOUND"]);
    assert.ok((await readFile(resumed.markdown, "utf8")).includes("no-final-bundle / scenario.load / module.missing / ERR_MODULE_NOT_FOUND"));
    for (const bytes of await campaignBytes(campaignDirectory)) assert.equal(bytes.includes(Buffer.from(sentinel)), false, "raw thrown data must not enter the campaign directory");

    const firstRuns = await readRuns(campaignDirectory);
    const again = await resumeBench({ ...resumeOptions, benchId });
    const secondRuns = await readRuns(campaignDirectory);
    delete firstRuns.finishedAt; delete secondRuns.finishedAt;
    assert.deepEqual(secondRuns, firstRuns);
    assert.equal(calls, 1);
    assert.deepEqual(again.failureCauses, resumed.failureCauses);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("a finalized diagnostic survives bundle reconciliation, and a bundle-less legacy-null evaluation is rejected", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-bench-diagnostic-"));
  const finalizedId = "bench-finalized-0123abcd";
  const finalizedFailure = { boundary: "finalized-bundle", stage: "scenario.execute", reason: "readiness.timeout", operationStage: "core.health", timeoutMs: 30_000 } as const;
  let calls = 0;
  const finalizedRunner = async (options: RunScenarioOptions): Promise<RunScenarioResult> => {
    calls += 1;
    assert.ok(options.runId && options.benchReceipt);
    const runPath = path.join(options.runsDirectory, options.runId);
    await mkdir(runPath, { recursive: true });
    const evaluation = { ...campaignEvaluation(options.runId, options), verdict: "failed" as const, failureCategory: "process.startup" as const, facilityFailure: finalizedFailure, invariants: [{ id: "runner-verdict", passed: false, expected: "passed", actual: "failed: process.startup", evidenceSequences: [2] }], oracleVerdict: null, reportedVerdict: null, actions: [] };
    await writeFile(path.join(runPath, "run.json"), JSON.stringify({ ...runManifest(options.runId, options.scenarioId, "failed"), actions: [] }));
    await writeFile(path.join(runPath, "summary.json"), JSON.stringify({ verdict: "failed", metrics: { steps: 3 } }));
    await writeFile(path.join(runPath, "events.ndjson"), `${JSON.stringify({ sequence: 2, trigger: "error", summary: "safe", details: { failureCategory: "process.startup" } })}\n`);
    await writeFile(path.join(runPath, "evaluation.json"), JSON.stringify(evaluation));
    await writeFile(path.join(runPath, "bench-receipt.json"), JSON.stringify({ schemaVersion: "0.1", ...options.benchReceipt, runId: options.runId }));
    return { runId: options.runId, verdict: "failed", failureCategory: "process.startup", path: runPath, evaluation };
  };
  try {
    const base = { ...resumableOptions(root, finalizedId, []), corpus: oneCellCorpus, repeatCount: 1, runScenario: finalizedRunner };
    await assert.rejects(createResumableBench({ ...base, crashHook: (point) => { if (point === "after-bundle-finalized") throw new Error("stop after bundle"); } }), /stop after bundle/u);
    const resumed = await resumeBench({ ...base, benchId: finalizedId });
    assert.equal(calls, 1, "the finalized active attempt is reconciled, not rerun");
    const [record] = (await readRuns(resumed.directory)).runs.filter((run) => run.status === "evaluated");
    const evaluation = parseRunEvaluationJson(await readFile(path.join(resumed.directory, record?.evaluation ?? "missing"), "utf8"));
    assert.deepEqual(evaluation.facilityFailure, finalizedFailure);
    assert.deepEqual(record?.facilityFailure, finalizedFailure);

    const legacyId = "bench-legacy-0123abcd";
    let stopped = false;
    const legacyBase = { ...resumableOptions(root, legacyId, []), corpus: oneCellCorpus, repeatCount: 1, runScenario: async () => { throw new ProjectedFacilityError(new Error("safe"), { boundary: "no-final-bundle", stage: "scenario.load", reason: "unclassified" }); } };
    await assert.rejects(createResumableBench({ ...legacyBase, crashHook: (point) => { if (!stopped && point === "after-completion-checkpoint") { stopped = true; throw new Error("stop legacy"); } } }), /stop legacy/u);
    const directory = path.join(root, "runs", "bench", legacyId);
    const checkpointFile = path.join(directory, "checkpoints", "000000000002.json");
    const checkpoint = JSON.parse(await readFile(checkpointFile, "utf8")) as Record<string, unknown> & { completed: Array<{ evaluation: string; evaluationSha256: string }>; checkpointSha256: string };
    const evaluationPath = path.join(directory, ...checkpoint.completed[0]!.evaluation.split("/"));
    const current = JSON.parse(await readFile(evaluationPath, "utf8")) as Record<string, unknown>;
    delete current.facilityFailure;
    current.schemaVersion = "0.1";
    const legacyText = `${JSON.stringify(current)}\n`;
    await writeFile(evaluationPath, legacyText);
    checkpoint.completed[0]!.evaluationSha256 = sha256Bytes(legacyText);
    const { checkpointSha256: _oldDigest, ...unsigned } = checkpoint;
    checkpoint.checkpointSha256 = sha256Canonical(unsigned);
    await writeFile(checkpointFile, canonicalJson(checkpoint));
    await assert.rejects(resumeBench({ ...legacyBase, benchId: legacyId }), /facilityFailure/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("resume fails closed on compatibility drift, evaluation corruption, and incomplete aggregate coverage", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-bench-resume-"));
  const benchId = "bench-guards-0123abcd";
  try {
    await assert.rejects(createResumableBench(resumableOptions(root, benchId, [], (point) => { if (point === "after-completion-checkpoint") throw new Error("stop"); })), /stop/u);
    const changed = { ...campaignCompatibility, environment: { ...campaignCompatibility.environment, browserVersion: "Chrome/135" } };
    await assert.rejects(resumeBench({ ...resumableOptions(root, benchId, []), benchId, compatibility: changed }), /compatibility does not match/u);
    const campaignDirectory = path.join(root, "runs", "bench", benchId);
    const runsBeforeResume = await readFile(path.join(campaignDirectory, "checkpoints", "000000000002.json"), "utf8");
    const completed = JSON.parse(runsBeforeResume) as { completed: Array<{ evaluation: string }> };
    await writeFile(path.join(campaignDirectory, ...(completed.completed[0]?.evaluation ?? "missing").split("/")), "{}\n");
    await assert.rejects(resumeBench({ ...resumableOptions(root, benchId, []), benchId }), /evaluation hash mismatch/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("resume refuses a finalized active bundle whose hashed evaluation is from another repeat", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-bench-repeat-"));
  const benchId = "bench-repeat-0123abcd";
  const calls: string[] = [];
  try {
    await assert.rejects(createResumableBench(resumableOptions(root, benchId, calls, (point) => {
      if (point === "after-bundle-finalized" && calls.length === 4) throw new Error("stop on repeat one");
    })), /stop on repeat one/u);
    const activeRun = calls.at(-1); assert.ok(activeRun);
    const evaluationPath = path.join(root, "runs", activeRun, "evaluation.json");
    const evaluation = JSON.parse(await readFile(evaluationPath, "utf8")) as RunEvaluation;
    await writeFile(evaluationPath, JSON.stringify({ ...evaluation, repeatIndex: 0 }));
    await assert.rejects(resumeBench({ ...resumableOptions(root, benchId, calls), benchId }), /evaluation identity does not match/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("a failing run fails the bench; a runner that throws is an inconclusive run, never a pass; --evidence passes through", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-bench-run-"));
  try {
    const calls: string[] = [];
    const runner = fakeRunner(calls, (run) => run.workflowId === "combo" ? "failed" : "passed");
    const outcome = await runBench(options(root, {
      repeatCount: 1, evidence: "events",
      runScenario: async (run) => {
        if (run.scenarioId === "iframe-checkout") throw new RunnerFailure("environment.missing", "Scenario Lab build is missing");
        return runner(run);
      },
    }));
    assert.deepEqual([outcome.status, outcome.runs, outcome.passed], ["failed", 3, 1]);
    assert.deepEqual(calls, ["basic-form/primary/events", "basic-form/combo/events"]);
    const runs = await readRuns(outcome.directory);
    const evaluated = runs.runs.filter((run) => run.status === "evaluated");
    assert.deepEqual(evaluated.map((run) => [run.corpusRowId, run.verdict, run.failureCategory ?? null]), [["W01", "passed", null], ["W02", "failed", "runtime.behavior"], ["W28", "inconclusive", "environment.missing"]]);
    assert.equal(evaluated[2]?.problems, undefined, "a raw synthetic error is not a campaign problem");
    assert.deepEqual(evaluated[2]?.facilityFailure, { boundary: "no-final-bundle", stage: "bench.persist", reason: "unclassified" });
    const report = parseBenchReportJson(await readFile(path.join(outcome.directory, "report.json"), "utf8"));
    assert.deepEqual(report.workflows.map((workflow) => [workflow.corpusRowId, workflow.flakeClass]), [["W01", "stable-pass"], ["W02", "stable-fail"], ["W28", "stable-fail"]]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

/**
 * An unarmed row runs on both lanes, so one row, scenario, workflow and
 * variant is two results. Before the lane was part of a result's identity,
 * this bench ran every run and then threw building its report.
 */
test("a corpus that runs the Flow lane runs every unarmed row there as well as on the recording lane, and its variants there, armed", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-bench-run-"));
  try {
    const lanes: string[] = [];
    const runner = fakeRunner([]);
    const outcome = await runBench(options(root, {
      corpus: bothLanes, repeatCount: 1,
      runScenario: async (run) => { lanes.push(`${run.scenarioId}/${run.workflowId ?? "primary"}/${run.variantId ?? "unarmed"}/${run.flow ? "flow" : "recording"}`); return runner(run); },
    }));
    // Each unarmed row records, then runs a Flow built from its own recording; the variant runs only as a Flow, armed.
    assert.deepEqual(lanes, [
      "basic-form/primary/unarmed/recording", "basic-form/primary/unarmed/flow",
      "basic-form/combo/unarmed/recording", "basic-form/combo/unarmed/flow",
      "iframe-checkout/primary/unarmed/recording", "iframe-checkout/primary/unarmed/flow",
      "iframe-checkout/primary/drift/flow",
    ]);
    // W99 does not resolve, and is skipped on both of its lanes.
    assert.deepEqual([outcome.status, outcome.results, outcome.runs, outcome.skipped], ["passed", 7, 7, 2]);
    const runs = await readRuns(outcome.directory);
    assert.deepEqual(runs.lanes, ["recording", "flow"]);
    const identities = [["W01", null, "recording"], ["W01", null, "flow"], ["W02", null, "recording"], ["W02", null, "flow"], ["W28", null, "recording"], ["W28", null, "flow"], ["W28", "drift", "flow"]];
    assert.deepEqual(runs.runs.filter((run) => run.status === "evaluated").map((run) => [run.corpusRowId, run.variantId, run.lane]), identities);
    assert.deepEqual(runs.runs.filter((run) => run.status === "skipped").map((run) => [run.corpusRowId, run.lane]), [["W99", "recording"], ["W99", "flow"]]);
    const flow = runs.runs.find((run) => run.variantId === "drift");
    assert.deepEqual([flow?.status, flow?.actionsExecuted], ["evaluated", 2]);
    const evaluation = parseRunEvaluationJson(await readFile(path.join(outcome.directory, flow?.evaluation ?? "missing"), "utf8"));
    assert.deepEqual([evaluation.lane, evaluation.flowCreated, evaluation.reportedVerdict], ["flow", true, "passed"]);
    // report.json validates with the same row, scenario, workflow and variant on two lanes, and counts no rate over both.
    const report = parseBenchReportJson(await readFile(path.join(outcome.directory, "report.json"), "utf8"));
    assert.deepEqual(report.workflows.map((workflow) => [workflow.corpusRowId, workflow.variantId, workflow.lane]), identities);
    assert.equal(report.metrics.rates, undefined);
    const [recording, onFlow] = [report.metrics.ratesByLane?.recording, report.metrics.ratesByLane?.flow];
    // The Flow lane is what gives flow creation and fuzzy recovery a population at all; each unarmed row counts once on each lane.
    assert.deepEqual(onFlow?.flowCreationSuccess, { count: 4, total: 4, workflows: 4, rate: 1 });
    assert.deepEqual(onFlow?.fuzzyRecovery, { count: 1, total: 1, workflows: 1, rate: 1 });
    assert.deepEqual(onFlow?.initialExecutionSuccess, { count: 4, total: 4, workflows: 4, rate: 1 });
    assert.deepEqual(recording?.initialExecutionSuccess, { count: 3, total: 3, workflows: 3, rate: 1 });
    assert.deepEqual(recording?.flowCreationSuccess, { count: 0, total: 0, workflows: 0, rate: null });
    const markdown = await readFile(outcome.markdown, "utf8");
    assert.match(markdown, /\| recording, flow \|/);
    assert.match(markdown, /### Flow lane/);
    assert.match(markdown, /\| Row \| Scenario \| Workflow \| Variant \| Lane \| Runs \| Pass rate \| Flake class \|/);
    assert.match(markdown, /\| W01 \| basic-form \| primary \| unarmed \| flow \| 1 \| 1\.000 \| stable-pass \|/);
    assert.match(markdown, /\| recording \| initialExecutionSuccess \| workflows \| 3 \| 3 \| 0 \| 3 \|/);
    assert.match(markdown, /\| flow \| initialExecutionSuccess \| workflows \| 4 \| 4 \| 0 \| 4 \|/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("the same corpus without the Flow lane skips its variants, and smoke's plan is unchanged", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-bench-run-"));
  try {
    const lanes: string[] = [];
    const runner = fakeRunner([]);
    const outcome = await runBench(options(root, {
      repeatCount: 1,
      runScenario: async (run) => { lanes.push(`${run.scenarioId}/${run.variantId ?? "unarmed"}/${run.flow ? "flow" : "recording"}`); return runner(run); },
    }));
    assert.equal(lanes.every((call) => call.endsWith("/recording")), true);
    assert.deepEqual([outcome.results, outcome.runs, outcome.skipped], [3, 3, 2]);
    const runs = await readRuns(outcome.directory);
    assert.deepEqual(runs.lanes, ["recording"]);
    assert.equal(runs.flowSources, undefined);
    assert.equal(runs.runs.find((run) => run.variantId === "drift")?.skipReason, VARIANT_NEEDS_FLOW_LANE);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a run in which FluxIQ executed nothing is counted, printed, and never a hidden execution success", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-bench-run-"));
  try {
    // A manifest with no actions is exactly the week1 shape: the Core round-trip
    // probe did not apply to the workflow, so FluxIQ executed nothing while the
    // Testing Lab drove the fixture to the expected final state.
    const baseRunner = fakeRunner([]);
    const runner = async (run: RunScenarioOptions): Promise<RunScenarioResult> => {
      const result = await baseRunner(run);
      const nothing = run.scenarioId === "basic-form";
      await writeFile(path.join(result.path, "run.json"), JSON.stringify({ ...runManifest(result.runId, run.scenarioId, "passed"), actions: nothing ? [] : runManifest(result.runId, run.scenarioId, "passed").actions }));
      return result;
    };
    const outcome = await runBench(options(root, { repeatCount: 1, runScenario: runner }));
    assert.deepEqual([outcome.status, outcome.runs, outcome.passed], ["passed", 3, 3]);
    // Every run passed as a test; two of the three executed no FluxIQ action.
    assert.deepEqual([outcome.notExecuted, outcome.actionsExecuted], [2, 1]);
    const report = parseBenchReportJson(await readFile(path.join(outcome.directory, "report.json"), "utf8"));
    assert.deepEqual(report.metrics.ratesByLane?.recording?.initialExecutionSuccess, { count: 1, total: 3, workflows: 3, rate: 1 / 3 });
    // The disclosure is machine-readable, not only printed: report.json is
    // what a later bench is compared against and what anyone reads once the
    // terminal has scrolled away, and it states the same counts the CLI did.
    assert.deepEqual([report.metrics.notExecutedRuns, report.metrics.actionsExecuted], [outcome.notExecuted, outcome.actionsExecuted]);
    assert.deepEqual([report.metrics.notExecutedRuns, report.metrics.actionsExecuted], [2, 1]);
    const runs = await readRuns(outcome.directory);
    assert.deepEqual(runs.runs.filter((run) => run.status === "evaluated").map((run) => run.actionsExecuted), [0, 0, 1]);
    const markdown = await readFile(outcome.markdown, "utf8");
    assert.match(markdown, /## FluxIQ execution/);
    assert.match(markdown, /executed \*\*1 actions\*\* across 3 evaluated runs/);
    assert.match(markdown, /executed nothing at all in 2 of those 3/);
    assert.match(markdown, /By lane: recording lane, 1 actions across 3 runs, nothing executed in 2\./);
    assert.match(markdown, /\| Lane \| Metric \| Unit \| Count \| Total \| Not executed \|/);
    assert.match(markdown, /\| recording \| initialExecutionSuccess \| workflows \| 1 \| 3 \| 2 \|/);
    assert.match(markdown, /Actions FluxIQ executed/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("refuses a target that runs a pre-existing Flow before running anything", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-bench-run-"));
  try {
    const calls: string[] = [];
    await assert.rejects(runBench(options(root, { target: { mode: "existing" } as unknown as RunBenchOptions["target"], runScenario: fakeRunner(calls) })), /recording and Flow lanes on isolated or persistent-isolated targets/);
    assert.deepEqual(calls, []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

/**
 * The incident this test exists for. A FluxIQ Core rebuild in the sibling
 * checkout deleted a module mid-run, all four runs of a bench died in under a
 * second on the same one-line error, and `report.json` and `report.md` said
 * `failureCategory: unknown` with an empty Problems column. The message was in
 * every run's `events.ndjson` the whole time. `runScenario` catches that error
 * itself, writes the event, and returns a verdict and a category with no text,
 * which is why the bench has to read the event back.
 */
test("a bench killed by a missing dependency reports the cause, in runs.json, in the outcome, and at the top of report.md", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-bench-run-"));
  // The message verbatim, from the run that died. `String.raw` because every
  // separator in it is a Windows backslash.
  const missing = String.raw`Cannot find module 'F:\!FluxIQ\packages\fluxiq\node_modules\@fluxiq\contracts\dist\automation-studio.js' imported from F:\!FluxIQ\packages\fluxiq\dist\programs\automation-studio\runtime\llm\harness\context-packet.js`;
  try {
    let index = 0;
    const outcome = await runBench(options(root, {
      // A startup death: the bundle is finalized, no action ran, and the only
      // record of why is the run's own `error` event.
      runScenario: async (run): Promise<RunScenarioResult> => {
        const runId = `run-unit-${index++}`;
        const runPath = path.join(run.runsDirectory, runId);
        await mkdir(runPath, { recursive: true });
        const manifest = { ...runManifest(runId, run.scenarioId, "failed"), finishedAt: "2026-09-11T10:00:00.822Z", actions: [] };
        await writeFile(path.join(runPath, "run.json"), JSON.stringify(manifest));
        await writeFile(path.join(runPath, "summary.json"), JSON.stringify({ verdict: "failed", metrics: {} }));
        await writeFile(path.join(runPath, "events.ndjson"), `${JSON.stringify({ sequence: 1, trigger: "error", summary: missing, details: { failureCategory: "environment.missing" } })}\n`);
        return { runId, verdict: "failed", path: runPath, failureCategory: "environment.missing" };
      },
    }));

    assert.deepEqual([outcome.status, outcome.runs, outcome.passed, outcome.actionsExecuted], ["failed", 6, 0, 0]);
    assert.deepEqual(outcome.failureCauses, [`6 runs — environment.missing: ${missing}`]);

    const evaluated = (await readRuns(outcome.directory)).runs.filter((run) => run.status === "evaluated");
    assert.equal(evaluated.length, 6);
    for (const record of evaluated) {
      assert.deepEqual([record.verdict, record.failureCategory, record.failureCause], ["failed", "environment.missing", missing]);
    }

    const markdown = await readFile(outcome.markdown, "utf8");
    assert.match(markdown, /## Why the failed runs failed/);
    assert.match(markdown, /\*\*Every one of the 6 evaluated runs failed for the same reason\*\*/);
    assert.ok(markdown.includes(missing), "report.md must carry the message a reader would otherwise have to find in events.ndjson");
    assert.match(markdown, /\| Cause and problems \|/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

/** A passing bench says nothing about failure causes, and a synthetic failure persists only its closed diagnostic. */
test("no failed run means no cause section, and a synthetic run never persists its raw error", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-bench-run-"));
  try {
    const clean = await runBench(options(root, { repeatCount: 1 }));
    assert.equal(clean.failureCauses, undefined);
    assert.doesNotMatch(await readFile(clean.markdown, "utf8"), /Why the failed runs failed/);

    // The runner threw, so there is no bundle at all. Only the closed
    // diagnostic may reach campaign projections.
    const threw = await runBench(options(root, {
      repeatCount: 1,
      runScenario: async () => { throw new RunnerFailure("environment.missing", "Scenario Lab build is missing"); },
    }));
    const evaluated = (await readRuns(threw.directory)).runs.filter((run) => run.status === "evaluated");
    assert.deepEqual(evaluated.map((run) => [run.verdict, run.failureCause, run.problems, run.facilityFailure]), Array.from({ length: 3 }, () => ["inconclusive", undefined, undefined, { boundary: "no-final-bundle", stage: "bench.persist", reason: "unclassified" }]));
    const markdown = await readFile(threw.markdown, "utf8");
    assert.equal(markdown.includes("Scenario Lab build is missing"), false);
    assert.deepEqual(threw.failureCauses, ["3 runs — environment.missing: no-final-bundle / bench.persist / unclassified"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

/**
 * Lab Stage 2's W18 Flow-lane run failed its extraction check, which set the
 * runner's category, and then its redaction scan, which wrote the last `error`
 * event. The bench printed `runtime.behavior` beside the redaction message and
 * hid the extraction failure (`i-bench-triage` H7).
 */
test("a run's failure cause is the message written under its failure category, not its last error event's", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-bench-run-"));
  const extraction = "The Flow produced 0 extraction result(s), expected 1";
  const redaction = "Redaction attestation found 13 file(s) holding a declared literal or left unread";
  const superseding = "Clone source post-run verification failed: Source Flow changed while its isolated clone was running";
  const error = (sequence: number, summary: string, failureCategory: string) => JSON.stringify({ sequence, trigger: "error", summary, details: { failureCategory } });
  // Per scenario and workflow, the events a run wrote and the category its runner returned.
  const shapes: Record<string, { events: string[]; category: string }> = {
    // W18's shape: the extraction failure, then the redaction scan's.
    "basic-form/primary": { events: [error(20, extraction, "runtime.behavior"), error(22, redaction, "security.redaction")], category: "runtime.behavior" },
    // A later failure under the same category replaced the runner's message, so the last matching event is the cause.
    "basic-form/combo": { events: [error(3, extraction, "runtime.behavior"), error(5, superseding, "runtime.behavior"), error(6, redaction, "security.redaction")], category: "runtime.behavior" },
    // No event records the category: no other category's message is borrowed, and the gap is a problem.
    "iframe-checkout/primary": { events: [error(4, redaction, "security.redaction")], category: "process.startup" },
  };
  try {
    let index = 0;
    const outcome = await runBench(options(root, {
      repeatCount: 1,
      runScenario: async (run): Promise<RunScenarioResult> => {
        const shape = shapes[`${run.scenarioId}/${run.workflowId ?? "primary"}`];
        assert.ok(shape, `no event shape for ${run.scenarioId}`);
        const runId = `run-unit-${index++}`;
        const runPath = path.join(run.runsDirectory, runId);
        await mkdir(runPath, { recursive: true });
        await writeFile(path.join(runPath, "run.json"), JSON.stringify(runManifest(runId, run.scenarioId, "failed")));
        await writeFile(path.join(runPath, "summary.json"), JSON.stringify({ verdict: "failed", metrics: {} }));
        await writeFile(path.join(runPath, "events.ndjson"), `${shape.events.join("\n")}\n`);
        return { runId, verdict: "failed", path: runPath, failureCategory: shape.category };
      },
    }));
    const evaluated = (await readRuns(outcome.directory)).runs.filter((run) => run.status === "evaluated");
    assert.deepEqual(evaluated.map((run) => [run.corpusRowId, run.failureCategory, run.failureCause ?? null]), [["W01", "runtime.behavior", extraction], ["W02", "runtime.behavior", superseding], ["W28", "process.startup", null]]);
    assert.deepEqual(evaluated.map((run) => run.problems ?? []), [[], [], ["events.ndjson: no error event records the run's failure category process.startup"]]);
    assert.deepEqual(outcome.failureCauses, [`1 run — runtime.behavior: ${extraction}`, `1 run — runtime.behavior: ${superseding}`, "1 run — process.startup: no cause recorded"]);
    assert.ok(!(await readFile(outcome.markdown, "utf8")).includes(redaction), "report.md must not print a message under a category it does not belong to");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
