import { createHash, randomBytes } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parseBenchReportJson } from "@fluxiq-web-extension/test-contracts";
import { acquireCampaignLease, acquireMachineCellSlot, assertCampaignCompatibility, BENCH_SEMANTICS_VERSION, CAMPAIGN_SCHEMA_VERSION, CAMPAIGN_SHARD_ALGORITHM, campaignPlanSha256, canonicalJson, createCampaignPlan, createCampaignShardGroup, loadCampaignCheckpointChain, loadCampaignShardGroup, loadCampaignShardMergeSeal, MAX_CAMPAIGN_SHARDS, MIN_CAMPAIGN_SHARDS, writeCampaignCheckpoint, writeCampaignShardMergeSeal, type CampaignCheckpoint, type CampaignLease, type CampaignLeaseOptions, type CampaignManifest, type CampaignShardGroup, type CampaignShardMergeSeal, type MachineCellSlotOptions } from "./campaign/index.js";
import { benchFailureCauses, describeBenchFailureCause } from "./failure-cause.js";
import { expandCorpus } from "./expand-corpus.js";
import { benchDirectory, type BenchRunRecord, type BenchRunsFile } from "./report-store.js";
import { executePrecreatedBenchCampaign, publishPrecreatedBenchParentProjections, type PrecreatedBenchCampaignOptions, type RunBenchOutcome, type ResumableRunBenchOptions } from "./run-bench.js";
import { prepareAuthenticatedShardMerge, type AuthenticatedShardMergeInputs } from "./shard-merge.js";

export type ShardedBenchCrashPoint = "after-parent-created" | "after-child-pool" | "after-merge-authenticated" | "after-parent-aggregating" | "after-parent-projections" | "after-merge-seal" | "after-parent-finished";
export type ShardedBenchLifecycle = Readonly<{ event: "created" | "resumed" | "children-finished" | "aggregating" | "sealed" | "finished"; benchId: string; directory: string }>;

type ShardedBenchRuntime = Readonly<{
  executeChild?: typeof executePrecreatedBenchCampaign;
  publishParent?: typeof publishPrecreatedBenchParentProjections;
  prepareMerge?: typeof prepareAuthenticatedShardMerge;
  acquireSlot?: typeof acquireMachineCellSlot;
}>;

type ShardedBenchBaseOptions = Omit<ResumableRunBenchOptions, "benchId" | "lifecycle" | "crashHook"> & {
  lifecycle?: (record: ShardedBenchLifecycle) => void | Promise<void>;
  crashHook?: (point: ShardedBenchCrashPoint) => void | Promise<void>;
  machineSlotsDirectory?: string;
  machineSlotOptions?: MachineCellSlotOptions;
  /** Test-only dependency seam. Production callers omit it. */
  runtime?: ShardedBenchRuntime;
};

export type CreateShardedBenchOptions = ShardedBenchBaseOptions & { shardCount: number; jobs: number; benchId?: string };
export type ResumeShardedBenchOptions = ShardedBenchBaseOptions & { benchId: string };

export async function createShardedBench(options: CreateShardedBenchOptions): Promise<RunBenchOutcome> {
  validateCommon(options);
  validInteger(options.shardCount, "shardCount", MIN_CAMPAIGN_SHARDS, MAX_CAMPAIGN_SHARDS);
  validInteger(options.jobs, "jobs", 1, options.shardCount);
  const benchId = options.benchId ?? `bench-${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`;
  const directory = benchDirectory(options.runsDirectory, benchId);
  const plan = createCampaignPlan(expandCorpus(options.corpus, options.manifests), options.repeatCount);
  if (!plan.some(({ skipReason }) => skipReason === null)) throw new Error("A sharded campaign requires at least one executable plan cell");
  const manifest: CampaignManifest = {
    schemaVersion: CAMPAIGN_SCHEMA_VERSION,
    benchId,
    createdAt: new Date().toISOString(),
    benchSemanticsVersion: BENCH_SEMANTICS_VERSION,
    request: requestOf(options),
    plan,
    planSha256: campaignPlanSha256(plan),
    compatibility: options.compatibility,
    execution: { mode: "shard-parent", algorithm: CAMPAIGN_SHARD_ALGORITHM, shardCount: options.shardCount, jobs: options.jobs },
  };
  const group = await createCampaignShardGroup(directory, manifest);
  await writeCampaignCheckpoint(directory, checkpointInput(group.parent, null, [], "running"));
  await options.lifecycle?.({ event: "created", benchId, directory });
  await options.crashHook?.("after-parent-created");
  return runWithParentLease(options, group);
}

export async function resumeShardedBench(options: ResumeShardedBenchOptions): Promise<RunBenchOutcome> {
  validateCommon(options);
  if (Object.prototype.hasOwnProperty.call(options, "shards") || Object.prototype.hasOwnProperty.call(options, "shardCount") || Object.prototype.hasOwnProperty.call(options, "jobs")) {
    throw new Error("A sharded resume refuses scheduler or manifest overrides");
  }
  const directory = benchDirectory(options.runsDirectory, options.benchId);
  const group = await loadCampaignShardGroup(directory);
  assertSavedAuthority(options, group.parent);
  return runWithParentLease(options, group, true);
}

async function runWithParentLease(options: ShardedBenchBaseOptions, initialGroup: CampaignShardGroup, resumed = false): Promise<RunBenchOutcome> {
  const directory = benchDirectory(options.runsDirectory, initialGroup.parent.benchId);
  const lease = await acquireCampaignLease(directory, options.campaignLeaseOptions);
  try {
    const group = await loadCampaignShardGroup(directory);
    assertSavedAuthority(options, group.parent);
    const chain = await loadCampaignCheckpointChain(directory, group.parent);
    if (chain.ignored.length !== 0) throw new Error("Shard parent checkpoint chain contains ignored generations");
    let latest = chain.latest;
    if (!latest) latest = await writeCampaignCheckpoint(directory, checkpointInput(group.parent, null, [], "running"));
    if (resumed) await options.lifecycle?.({ event: "resumed", benchId: group.parent.benchId, directory });

    if (latest.state === "finished") return await finishFromExistingSeal(options, group, latest, lease);
    if (latest.state === "running") {
      await runChildPool(options, group);
      await options.lifecycle?.({ event: "children-finished", benchId: group.parent.benchId, directory });
      await options.crashHook?.("after-child-pool");
    }
    return await mergeAndFinish(options, group, latest, lease);
  } finally {
    await lease.release();
  }
}

async function runChildPool(options: ShardedBenchBaseOptions, group: CampaignShardGroup): Promise<void> {
  if (group.parent.execution.mode !== "shard-parent") throw new Error("Shard scheduler requires shard-parent authority");
  const executeChild = options.runtime?.executeChild ?? executePrecreatedBenchCampaign;
  const failures: unknown[] = [];
  let next = 0;
  const worker = async (): Promise<void> => {
    for (;;) {
      const index = next;
      next += 1;
      const manifest = group.children[index];
      if (!manifest) return;
      const directory = path.join(benchDirectory(options.runsDirectory, group.parent.benchId), "shards", index.toString().padStart(3, "0"));
      try {
        if (!await childRequiresExecution(directory, manifest)) continue;
        await executeChild({ ...childOptions(options), directory, manifest, withCellSlot: operation => withMachineSlot(options, operation) });
      } catch (error) {
        failures.push(error);
      }
    }
  };
  await Promise.all(Array.from({ length: group.parent.execution.jobs }, () => worker()));
  if (failures.length !== 0) throw new AggregateError(failures, `${failures.length} shard child campaign(s) did not reach terminal state`);
}

async function withMachineSlot<T>(options: ShardedBenchBaseOptions, operation: () => Promise<T>): Promise<T> {
  const acquire = options.runtime?.acquireSlot ?? acquireMachineCellSlot;
  const root = options.machineSlotsDirectory ?? path.join(os.tmpdir(), "fluxiq-testing-lab-machine-slots");
  const slot = await acquire(root, options.machineSlotOptions);
  try {
    await slot.assertOwned();
    return await operation();
  } finally {
    await slot.release();
  }
}

async function mergeAndFinish(options: ShardedBenchBaseOptions, group: CampaignShardGroup, initial: CampaignCheckpoint, lease: CampaignLease): Promise<RunBenchOutcome> {
  const directory = benchDirectory(options.runsDirectory, group.parent.benchId);
  const prepare = options.runtime?.prepareMerge ?? prepareAuthenticatedShardMerge;
  const prepared = await prepare(directory);
  assertSameGroup(group, prepared.group);
  await options.crashHook?.("after-merge-authenticated");
  let latest = (await checkedParentChain(directory, group.parent)).latest ?? initial;
  if (latest.state === "running") {
    await lease.assertOwned();
    latest = await appendCheckpoint(directory, group.parent, latest, prepared.completed, "aggregating");
  } else if (latest.state === "aggregating") {
    assertCompleted(latest, prepared);
  } else {
    return finishFromExistingSeal(options, group, latest, lease, prepared);
  }
  await options.lifecycle?.({ event: "aggregating", benchId: group.parent.benchId, directory });
  await options.crashHook?.("after-parent-aggregating");

  const existingSeal = await optionalSeal(directory, group);
  if (existingSeal) {
    await verifySealFiles(directory, prepared, existingSeal);
    return appendFinishedAndReturn(options, group, latest, prepared, lease);
  }

  const publish = options.runtime?.publishParent ?? publishPrecreatedBenchParentProjections;
  const outcome = await publish({ runsDirectory: options.runsDirectory, directory, manifest: group.parent, evaluations: prepared.evaluations });
  const merged = await projectionDigests(directory);
  await options.crashHook?.("after-parent-projections");
  await writeCampaignShardMergeSeal(directory, group, prepared.childProjections, merged);
  await options.lifecycle?.({ event: "sealed", benchId: group.parent.benchId, directory });
  await options.crashHook?.("after-merge-seal");
  await lease.assertOwned();
  latest = await appendCheckpoint(directory, group.parent, latest, prepared.completed, "finished");
  await options.crashHook?.("after-parent-finished");
  await options.lifecycle?.({ event: "finished", benchId: group.parent.benchId, directory });
  return outcome;
}

async function finishFromExistingSeal(options: ShardedBenchBaseOptions, group: CampaignShardGroup, latest: CampaignCheckpoint, lease: CampaignLease, alreadyPrepared?: AuthenticatedShardMergeInputs): Promise<RunBenchOutcome> {
  const directory = benchDirectory(options.runsDirectory, group.parent.benchId);
  const prepared = alreadyPrepared ?? await (options.runtime?.prepareMerge ?? prepareAuthenticatedShardMerge)(directory);
  assertCompleted(latest, prepared);
  const seal = await loadCampaignShardMergeSeal(directory, group);
  await verifySealFiles(directory, prepared, seal);
  if (latest.state !== "finished") return appendFinishedAndReturn(options, group, latest, prepared, lease);
  await options.lifecycle?.({ event: "finished", benchId: group.parent.benchId, directory });
  return readFinishedOutcome(directory, group.parent);
}

async function appendFinishedAndReturn(options: ShardedBenchBaseOptions, group: CampaignShardGroup, latest: CampaignCheckpoint, prepared: AuthenticatedShardMergeInputs, lease: CampaignLease): Promise<RunBenchOutcome> {
  if (latest.state !== "finished") {
    await lease.assertOwned();
    await appendCheckpoint(benchDirectory(options.runsDirectory, group.parent.benchId), group.parent, latest, prepared.completed, "finished");
    await options.crashHook?.("after-parent-finished");
  }
  await options.lifecycle?.({ event: "finished", benchId: group.parent.benchId, directory: benchDirectory(options.runsDirectory, group.parent.benchId) });
  return readFinishedOutcome(benchDirectory(options.runsDirectory, group.parent.benchId), group.parent);
}

async function readFinishedOutcome(directory: string, manifest: CampaignManifest): Promise<RunBenchOutcome> {
  const runs = JSON.parse(await readFile(path.join(directory, "runs.json"), "utf8")) as BenchRunsFile;
  if (runs.benchId !== manifest.benchId || !Array.isArray(runs.runs)) throw new Error("Sealed parent runs projection does not match its campaign");
  const evaluated = runs.runs.filter((record): record is BenchRunRecord & { status: "evaluated" } => record.status === "evaluated");
  const passed = evaluated.filter(({ verdict }) => verdict === "passed").length;
  const reportPath = path.join(directory, "report.json");
  const report = parseBenchReportJson(await readFile(reportPath, "utf8"));
  if (report.reportId !== manifest.benchId) throw new Error("Sealed parent report projection does not match its campaign");
  const causes = benchFailureCauses(runs.runs);
  return {
    status: evaluated.length > 0 && passed === evaluated.length ? "passed" : "failed",
    benchId: manifest.benchId, directory, report: reportPath, markdown: path.join(directory, "report.md"),
    results: report.workflows.length, runs: evaluated.length, passed, skipped: runs.runs.length - evaluated.length,
    notExecuted: report.metrics.notExecutedRuns ?? evaluated.filter(({ actionsExecuted }) => actionsExecuted === 0).length,
    actionsExecuted: report.metrics.actionsExecuted ?? evaluated.reduce((total, record) => total + (record.actionsExecuted ?? 0), 0),
    ...(causes.length ? { failureCauses: causes.map(describeBenchFailureCause) } : {}),
  };
}

function assertSavedAuthority(options: ShardedBenchBaseOptions, manifest: CampaignManifest): void {
  if (manifest.execution.mode !== "shard-parent" || manifest.execution.algorithm !== CAMPAIGN_SHARD_ALGORITHM) throw new Error("Sharded orchestration requires shard-parent authority");
  assertCampaignCompatibility(manifest.compatibility, options.compatibility);
  if (canonicalJson(manifest.request) !== canonicalJson(requestOf(options))) throw new Error("Sharded campaign request does not match its saved authority");
  const plan = createCampaignPlan(expandCorpus(options.corpus, options.manifests), options.repeatCount);
  if (manifest.planSha256 !== campaignPlanSha256(plan) || canonicalJson(manifest.plan) !== canonicalJson(plan)) throw new Error("Sharded campaign plan does not match the current corpus and manifests");
}

function validateCommon(options: ShardedBenchBaseOptions): void {
  if (options.target.mode !== "isolated") throw new Error("Sharded campaigns require the isolated target");
  validInteger(options.repeatCount, "repeatCount", 1, 100);
}

function requestOf(options: ShardedBenchBaseOptions): CampaignManifest["request"] {
  return { corpusId: options.corpus.id, repeatCount: options.repeatCount, target: { mode: "isolated", workspace: null }, evidence: options.evidence ?? null };
}

function childOptions(options: ShardedBenchBaseOptions): Omit<PrecreatedBenchCampaignOptions, "directory" | "manifest" | "withCellSlot"> {
  return {
    corpus: options.corpus, repeatCount: options.repeatCount, target: options.target, manifests: options.manifests,
    repositoryRoot: options.repositoryRoot, fluxiqRepositoryRoot: options.fluxiqRepositoryRoot, runsDirectory: options.runsDirectory,
    environment: options.environment, runScenario: options.runScenario, inspectRun: options.inspectRun, compatibility: options.compatibility,
    ...(options.evidence === undefined ? {} : { evidence: options.evidence }),
    ...(options.campaignLeaseOptions === undefined ? {} : { campaignLeaseOptions: options.campaignLeaseOptions }),
  };
}

async function checkedParentChain(directory: string, manifest: CampaignManifest) {
  const chain = await loadCampaignCheckpointChain(directory, manifest);
  if (!chain.latest || chain.ignored.length !== 0) throw new Error("Shard parent checkpoint chain is incomplete or contains ignored generations");
  return chain;
}

async function childRequiresExecution(directory: string, manifest: CampaignManifest): Promise<boolean> {
  const chain = await loadCampaignCheckpointChain(directory, manifest);
  if (chain.ignored.length !== 0 || chain.latest?.state !== "finished") return true;
  try { await lstat(path.join(directory, "lease")); return true; }
  catch (error) { if (errorCode(error) === "ENOENT") return false; throw error; }
}

async function appendCheckpoint(directory: string, manifest: CampaignManifest, previous: CampaignCheckpoint, completed: CampaignCheckpoint["completed"], state: "aggregating" | "finished"): Promise<CampaignCheckpoint> {
  return writeCampaignCheckpoint(directory, checkpointInput(manifest, previous, completed, state));
}

function checkpointInput(manifest: CampaignManifest, previous: CampaignCheckpoint | null, completed: CampaignCheckpoint["completed"], state: CampaignCheckpoint["state"]) {
  return { generation: previous ? previous.generation + 1 : 0, previousSha256: previous?.checkpointSha256 ?? null, campaignId: manifest.benchId, planSha256: manifest.planSha256, completed, activeAttempt: null, state } as const;
}

function assertCompleted(checkpoint: CampaignCheckpoint, prepared: AuthenticatedShardMergeInputs): void {
  if (canonicalJson(checkpoint.completed) !== canonicalJson(prepared.completed) || checkpoint.activeAttempt !== null) throw new Error("Shard parent checkpoint does not match authenticated merge completion records");
}

function assertSameGroup(expected: CampaignShardGroup, actual: CampaignShardGroup): void {
  if (canonicalJson(expected) !== canonicalJson(actual)) throw new Error("Authenticated merge group does not match scheduler authority");
}

async function optionalSeal(directory: string, group: CampaignShardGroup): Promise<CampaignShardMergeSeal | undefined> {
  try { return await loadCampaignShardMergeSeal(directory, group); }
  catch (error) { if (errorCode(error) === "ENOENT") return undefined; throw error; }
}

async function verifySealFiles(directory: string, prepared: AuthenticatedShardMergeInputs, seal: CampaignShardMergeSeal): Promise<void> {
  if (canonicalJson(seal.merged) !== canonicalJson(await projectionDigests(directory))) throw new Error("Merge seal projection digests do not match parent files");
  const sealedChildren = seal.children.map(({ index, campaignId, terminalCheckpointSha256, runsSha256, reportSha256, markdownSha256 }) => ({ index, campaignId, terminalCheckpointSha256, runsSha256, reportSha256, markdownSha256 }));
  if (canonicalJson(sealedChildren) !== canonicalJson(prepared.childProjections)) throw new Error("Merge seal child digests do not match authenticated terminal children");
}

async function projectionDigests(directory: string): Promise<CampaignShardMergeSeal["merged"]> {
  return { runsSha256: await fileSha(path.join(directory, "runs.json")), reportSha256: await fileSha(path.join(directory, "report.json")), markdownSha256: await fileSha(path.join(directory, "report.md")) };
}

async function fileSha(file: string): Promise<string> { return createHash("sha256").update(await readFile(file)).digest("hex"); }
function validInteger(value: number, label: string, minimum: number, maximum: number): void { if (!Number.isSafeInteger(value) || value < minimum || value > maximum) throw new Error(`${label} must be between ${minimum} and ${maximum}`); }
function errorCode(error: unknown): string | undefined { return typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" ? error.code : undefined; }
