import { createHash, randomBytes } from "node:crypto";
import { mkdir, readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { parseRunEvaluationJson, type RunEvaluation, type WebScenario } from "@fluxiq-web-extension/test-contracts";
import type { EvidenceMode } from "../commands.js";
import type { RunScenarioOptions, RunScenarioResult } from "../run-scenario.js";
import type { FluxIQTargetConfiguration } from "../target-config.js";
import { projectFacilityFailure, ProjectedFacilityError } from "../facility-failure/index.js";
import { parseBenchReceiptJson } from "./bench-receipt.js";
import { actionsExecuted, aggregateBenchReport, benchResultsByLane, groupBenchResults } from "./aggregate-report.js";
import { BENCH_SEMANTICS_VERSION, CAMPAIGN_SCHEMA_VERSION, acquireCampaignLease, assertCampaignCompatibility, campaignPlanSha256, canonicalJson, createCampaignPlan, createCampaignPlanShards, loadCampaignCheckpointChain, loadCampaignManifest, preserveInterruptedStaging, writeCampaignCheckpoint, writeCampaignManifest, type ActiveCampaignAttempt, type CampaignCheckpoint, type CampaignCompatibility, type CampaignLease, type CampaignLeaseOptions, type CampaignManifest, type CampaignPlanCell, type CampaignRequest, type CompletedCampaignCell } from "./campaign/index.js";
import type { BenchCorpus } from "./corpus/index.js";
import { describeError } from "./describe-error.js";
import { FLOW_LANE_SOURCES, RECORDING_LANE_SOURCES, evaluateFailedAttempt, evaluateFlowRun, evaluateRecordingRun, type RunEvaluationIdentity } from "./evaluate-run.js";
import { benchExecutionCoverage } from "./execution-coverage.js";
import { benchFailureCauses, describeBenchFailureCause } from "./failure-cause.js";
import { expandCorpus, type BenchPlanEntry } from "./expand-corpus.js";
import { readRunBundle } from "./read-run-bundle.js";
import { renderBenchMarkdown, type BenchMarkdownCoverage } from "./render-markdown.js";
import { benchDirectory, writeBenchMarkdown, writeBenchReport, writeBenchRuns, writeRunEvaluation, type BenchRunRecord, type BenchRunsFile } from "./report-store.js";

/** The runner's `--repeat` bound. */
const MAX_REPEAT = 100;

export type RunBenchOptions = {
  corpus: BenchCorpus;
  repeatCount: number;
  /** The resolved target. Both lanes run on `isolated` and `persistent-isolated`. */
  target: FluxIQTargetConfiguration;
  /** The Scenario Lab registry the corpus resolves against. */
  manifests: readonly WebScenario[];
  repositoryRoot: string;
  fluxiqRepositoryRoot: string;
  runsDirectory: string;
  environment: NodeJS.ProcessEnv;
  /** Overrides every manifest's `evidencePolicy`, as `lab run --evidence` does. */
  evidence?: EvidenceMode;
  runScenario: (options: RunScenarioOptions) => Promise<RunScenarioResult>;
  /** Verifies a finished bundle's integrity; a failure is recorded as a problem of that run. */
  inspectRun: (runsDirectory: string, runId: string) => Promise<unknown>;
};

export type RunBenchOutcome = {
  /** `passed` only when at least one run was evaluated and every evaluated run passed. */
  status: "passed" | "failed";
  benchId: string;
  directory: string;
  /** `report.json`, or `null` when no result ran. */
  report: string | null;
  markdown: string;
  results: number;
  runs: number;
  passed: number;
  skipped: number;
  /**
   * Evaluated runs in which FluxIQ executed no action. Each is a miss in every
   * execution rate; a bench whose `notExecuted` approaches `runs` has measured
   * the Testing Lab and the fixture, not FluxIQ.
   */
  notExecuted: number;
  /** Actions FluxIQ executed across every evaluated run. */
  actionsExecuted: number;
  /**
   * The distinct one-line causes of this bench's failed runs, most frequent
   * first, each prefixed with the run count that shares it. Absent when no run
   * failed.
   *
   * It is on the outcome because the outcome is the line a person sees in the
   * terminal. A bench whose every run died on one missing module used to print
   * `0 passed` and nothing else, and the cause had to be dug out of a run's
   * event log.
   */
  failureCauses?: string[];
};

type Attempt = { entry: BenchPlanEntry; repeatIndex: number; attemptId: string; directory: string };

export type BenchCampaignCrashPoint = "after-campaign-published" | "after-attempt-checkpoint" | "after-bundle-finalized" | "after-completion-checkpoint" | "before-aggregation";
export type BenchCampaignLifecycle = Readonly<{ event: "created" | "resumed" | "reconciled" | "finished"; benchId: string; directory: string }>;

export type ResumableRunBenchOptions = RunBenchOptions & {
  compatibility: CampaignCompatibility;
  lifecycle?: (record: BenchCampaignLifecycle) => void | Promise<void>;
  crashHook?: (point: BenchCampaignCrashPoint) => void | Promise<void>;
  /** Test-only deterministic process-identity seam. Production callers omit it. */
  campaignLeaseOptions?: CampaignLeaseOptions;
  /** Test-only deterministic identity seam. Production callers omit it. */
  benchId?: string;
};

export type ResumeBenchOptions = Omit<ResumableRunBenchOptions, "benchId"> & { benchId: string };

export type PrecreatedBenchCampaignOptions = Omit<ResumableRunBenchOptions, "benchId"> & {
  /** Exact nested child directory created by the shard-group authority. */
  directory: string;
  /** Expected immutable child manifest; the on-disk copy remains authoritative. */
  manifest: CampaignManifest;
  /** Orchestrator-owned per-attempt machine slot. It must release when the operation settles. */
  withCellSlot?: <T>(operation: () => Promise<T>) => Promise<T>;
};

export type AuthenticatedBenchCampaignEvaluation = Readonly<{
  completed: CompletedCampaignCell;
  evaluation: RunEvaluation;
}>;

export type PrecreatedBenchParentProjectionOptions = Readonly<{
  runsDirectory: string;
  directory: string;
  manifest: CampaignManifest;
  evaluations: readonly AuthenticatedBenchCampaignEvaluation[];
}>;

/**
 * `lab bench`: runs every runnable corpus result `repeatCount` times, one pass
 * over the corpus per repeat, and writes a `RunEvaluation` per run,
 * `runs.json`, `report.json` (a `BenchReport`), and `report.md` under
 * `<runs directory>/bench/<bench id>/`. Results the corpus runs on no lane,
 * and unresolved rows, are recorded as skipped with their reason, never as
 * passes.
 *
 * A result runs on every lane the corpus declares that can run it. An unarmed
 * workflow can run on both: it records, and it also builds a Flow from its
 * recording and runs it, the only lane on which FluxIQ executes the workflow.
 * A variant runs a Flow armed, which is the only way a variant is exercised at
 * all. Which lanes a corpus runs is the corpus's own declaration
 * (`BenchCorpus.lanes`), so `smoke` stays the recording-lane bench every
 * historical report was measured on. Each lane's runs of a result are a result
 * of their own in the report, and every rate is counted per lane.
 */
export async function runBench(options: RunBenchOptions): Promise<RunBenchOutcome> {
  const { target, repeatCount } = options;
  if (target.mode !== "isolated" && target.mode !== "persistent-isolated") throw new Error(`bench runs the recording and Flow lanes on isolated or persistent-isolated targets; a ${target.mode} target runs a pre-existing Flow instead of one built from the run's own recording`);
  if (!Number.isSafeInteger(repeatCount) || repeatCount < 1 || repeatCount > MAX_REPEAT) throw new Error(`--repeat must be between 1 and ${MAX_REPEAT}`);
  const benchId = `bench-${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`;
  const directory = benchDirectory(options.runsDirectory, benchId);
  await mkdir(directory, { recursive: true });
  const plan = expandCorpus(options.corpus, options.manifests);
  const repeats = Array.from({ length: repeatCount }, (_, index) => index);
  const flowPlanned = plan.some((entry) => entry.skipReason === undefined && entry.lane === "flow");
  const file: BenchRunsFile = {
    schemaVersion: "0.1", benchId, corpusId: options.corpus.id, repeatCount, target: target.mode, lanes: options.corpus.lanes,
    startedAt: new Date().toISOString(), sources: RECORDING_LANE_SOURCES, ...(flowPlanned ? { flowSources: FLOW_LANE_SOURCES } : {}),
    runs: plan.flatMap((entry) => {
      const reason = entry.skipReason;
      return reason === undefined ? [] : repeats.map((repeatIndex): BenchRunRecord => ({ ...identityOf(entry), repeatIndex, status: "skipped", skipReason: reason }));
    }),
  };
  await writeBenchRuns(directory, file);
  const runnable = plan.filter((entry) => entry.skipReason === undefined);
  const evaluated: Array<{ corpusRowId: string; evaluation: RunEvaluation }> = [];
  for (const repeatIndex of repeats) {
    for (const [index, entry] of runnable.entries()) {
      const { evaluation, record } = await runOnce(options, { entry, repeatIndex, attemptId: `${benchId}-r${repeatIndex}-${index}`, directory });
      evaluated.push({ corpusRowId: entry.corpusRowId, evaluation });
      file.runs.push(record);
      await writeBenchRuns(directory, file);
    }
  }
  const order = new Map(plan.map((entry, index) => [resultKey(entry), index]));
  file.runs.sort((left, right) => (order.get(resultKey(left)) ?? 0) - (order.get(resultKey(right)) ?? 0) || left.repeatIndex - right.repeatIndex);
  file.finishedAt = new Date().toISOString();
  const results = groupBenchResults(evaluated);
  const report = results.length === 0 ? undefined : aggregateBenchReport({ reportId: benchId, generatedAt: file.finishedAt, corpusId: options.corpus.id, repeatCount, target: target.mode, results });
  const reportPath = report ? await writeBenchReport(directory, report) : null;
  await writeBenchRuns(directory, file);
  // Per lane as well as in total: each rate's Not executed count is over that rate's own lane.
  const coverage: BenchMarkdownCoverage = { total: benchExecutionCoverage(results), byLane: Object.fromEntries(benchResultsByLane(results).map(([lane, onLane]) => [lane, benchExecutionCoverage(onLane)])) };
  const markdown = await writeBenchMarkdown(directory, renderBenchMarkdown(file, report, coverage));
  const passed = evaluated.filter(({ evaluation }) => evaluation.verdict === "passed").length;
  const causes = benchFailureCauses(file.runs);
  return {
    status: evaluated.length > 0 && passed === evaluated.length ? "passed" : "failed",
    benchId, directory, report: reportPath, markdown,
    results: results.length, runs: evaluated.length, passed, skipped: file.runs.length - evaluated.length,
    notExecuted: coverage.total.notExecutedRuns, actionsExecuted: coverage.total.actions,
    ...(causes.length === 0 ? {} : { failureCauses: causes.map(describeBenchFailureCause) }),
  };
}

/** Creates the immutable campaign authority before scheduling its first cell. */
export async function createResumableBench(options: ResumableRunBenchOptions): Promise<RunBenchOutcome> {
  validateBenchRequest(options);
  const benchId = options.benchId ?? newBenchId();
  const directory = benchDirectory(options.runsDirectory, benchId);
  const entries = expandCorpus(options.corpus, options.manifests);
  const plan = createCampaignPlan(entries, options.repeatCount);
  const createdAt = new Date().toISOString();
  const request = requestOf(options);
  const manifest: CampaignManifest = {
    schemaVersion: CAMPAIGN_SCHEMA_VERSION,
    benchId,
    createdAt,
    benchSemanticsVersion: BENCH_SEMANTICS_VERSION,
    request,
    execution: { mode: "serial" },
    plan,
    planSha256: campaignPlanSha256(plan),
    compatibility: options.compatibility,
  };
  await writeCampaignManifest(directory, manifest);
  await writeCampaignCheckpoint(directory, checkpointInput(manifest, null, [], null, "running"));
  await options.lifecycle?.({ event: "created", benchId, directory });
  await options.crashHook?.("after-campaign-published");
  return withCampaignLease(directory, options.campaignLeaseOptions, (lease) => executeCampaign(options, manifest, entries, directory, lease));
}

/** Resumes exactly one explicitly named campaign after strict compatibility and artifact reconciliation. */
export async function resumeBench(options: ResumeBenchOptions): Promise<RunBenchOutcome> {
  validateBenchRequest(options);
  const directory = benchDirectory(options.runsDirectory, options.benchId);
  const manifest = await loadCampaignManifest(directory);
  if (manifest.execution.mode !== "serial") throw new Error("A serial campaign resume refuses shard parent and child manifests");
  assertCampaignCompatibility(manifest.compatibility, options.compatibility);
  const entries = expandCorpus(options.corpus, options.manifests);
  const currentPlan = createCampaignPlan(entries, options.repeatCount);
  if (canonicalJson(manifest.request) !== canonicalJson(requestOf(options))) throw new Error("Campaign request does not match the saved request");
  if (campaignPlanSha256(currentPlan) !== manifest.planSha256 || canonicalJson(currentPlan) !== canonicalJson(manifest.plan)) throw new Error("Campaign plan does not match the current corpus and manifests");
  return withCampaignLease(directory, options.campaignLeaseOptions, async (lease) => {
    await options.lifecycle?.({ event: "resumed", benchId: manifest.benchId, directory });
    return executeCampaign(options, manifest, entries, directory, lease);
  });
}

/** Executes or resumes one immutable shard child inside its independently leased nested directory. */
export async function executePrecreatedBenchCampaign(options: PrecreatedBenchCampaignOptions): Promise<RunBenchOutcome> {
  validateBenchRequest(options);
  const { directory, manifest, entries } = await validatePrecreatedChild(options);
  return withCampaignLease(directory, options.campaignLeaseOptions, async (lease) => {
    await lease.assertOwned();
    const chain = await loadCampaignCheckpointChain(directory, manifest);
    if (!chain.latest) {
      if (chain.ignored.length !== 0) throw new Error("Precreated campaign has checkpoint debris but no generation-zero authority");
      await writeCampaignCheckpoint(directory, checkpointInput(manifest, null, [], null, "running"));
      await options.lifecycle?.({ event: "created", benchId: manifest.benchId, directory });
      await options.crashHook?.("after-campaign-published");
    } else {
      await options.lifecycle?.({ event: "resumed", benchId: manifest.benchId, directory });
    }
    return executeCampaign(options, manifest, entries, directory, lease, options.withCellSlot);
  });
}

/** Publishes only canonical parent projections from caller-authenticated, parent-ordered child evaluations. */
export async function publishPrecreatedBenchParentProjections(options: PrecreatedBenchParentProjectionOptions): Promise<RunBenchOutcome> {
  const directory = path.resolve(options.directory);
  if (directory !== benchDirectory(options.runsDirectory, options.manifest.benchId)) throw new Error("Shard parent projection directory does not match its canonical bench directory");
  const manifest = await loadCampaignManifest(directory);
  if (canonicalJson(manifest) !== canonicalJson(options.manifest)) throw new Error("Shard parent projection manifest does not match its immutable on-disk authority");
  if (manifest.execution.mode !== "shard-parent") throw new Error("Shard parent projections require a shard-parent manifest");
  const executable = manifest.plan.filter(({ skipReason }) => skipReason === null);
  if (options.evaluations.length !== executable.length) throw new Error("Shard parent projections require exact executable plan coverage");
  const shardOwners = new Map(createCampaignPlanShards(manifest.plan, manifest.execution.shardCount).flatMap((shard) => shard.plan.map((cell) => [cell.cellKey, shard.index] as const)));
  const accepted = new Map<string, AcceptedCell>();
  for (const [index, authenticated] of options.evaluations.entries()) {
    const cell = executable[index];
    if (!cell || authenticated.completed.cellKey !== cell.cellKey || accepted.has(cell.cellKey)) throw new Error("Shard parent evaluations are not exact and parent-ordered");
    assertEvaluationIdentity(cell, authenticated.evaluation, authenticated.completed.runId);
    if (authenticated.completed.evaluation !== `evaluations/${authenticated.evaluation.runId}.json`) throw new Error("Shard parent evaluation location is not canonical");
    const shardIndex = shardOwners.get(cell.cellKey);
    if (shardIndex === undefined) throw new Error("Shard parent evaluation has no deterministic child owner");
    const record = { ...recordFromEvaluation(cell, authenticated.evaluation), evaluation: `shards/${shardIndex.toString().padStart(3, "0")}/${authenticated.completed.evaluation}` };
    accepted.set(cell.cellKey, { cell, evaluation: authenticated.evaluation, completed: authenticated.completed, record, bundle: undefined });
  }
  return publishCampaignProjections(manifest, directory, accepted);
}

async function validatePrecreatedChild(options: PrecreatedBenchCampaignOptions): Promise<{ directory: string; manifest: CampaignManifest; entries: readonly BenchPlanEntry[] }> {
  const campaignRoot = path.resolve(options.runsDirectory, "bench");
  const directory = path.resolve(options.directory);
  const relative = path.relative(campaignRoot, directory);
  const segments = relative.split(path.sep);
  if (relative === "" || path.isAbsolute(relative) || segments.some((segment) => segment === "..")) throw new Error("Precreated campaign directory must remain inside the bench root");
  const saved = await loadCampaignManifest(directory);
  if (canonicalJson(saved) !== canonicalJson(options.manifest)) throw new Error("Precreated campaign manifest does not match its immutable on-disk authority");
  if (saved.execution.mode !== "shard-child") throw new Error("Precreated campaign execution requires a shard-child manifest and refuses a shard parent");
  if (segments.length !== 3 || segments[1] !== "shards" || !/^\d{3}$/u.test(segments[2] ?? "")) throw new Error("Precreated campaign directory must be an exact nested shard directory inside the bench root");
  if (segments[0] !== saved.execution.parentCampaignId || segments[2] !== saved.execution.shardIndex.toString().padStart(3, "0")) throw new Error("Precreated campaign directory does not match its parent and shard identity");

  const parent = await loadCampaignManifest(path.join(campaignRoot, saved.execution.parentCampaignId));
  if (parent.execution.mode !== "shard-parent") throw new Error("Precreated campaign parent directory does not contain shard-parent authority");
  if (parent.planSha256 !== saved.execution.parentPlanSha256 || parent.execution.algorithm !== saved.execution.algorithm || parent.execution.shardCount !== saved.execution.shardCount) throw new Error("Precreated campaign parent plan authority does not match its child");
  if (saved.createdAt !== parent.createdAt || saved.benchSemanticsVersion !== parent.benchSemanticsVersion || canonicalJson(saved.request) !== canonicalJson(parent.request) || canonicalJson(saved.compatibility) !== canonicalJson(parent.compatibility)) throw new Error("Precreated campaign child does not inherit exact parent authority");
  assertCampaignCompatibility(saved.compatibility, options.compatibility);
  if (canonicalJson(saved.request) !== canonicalJson(requestOf(options))) throw new Error("Precreated campaign request does not match the current request");

  const entries = expandCorpus(options.corpus, options.manifests);
  const currentParentPlan = createCampaignPlan(entries, options.repeatCount);
  if (parent.planSha256 !== campaignPlanSha256(currentParentPlan) || canonicalJson(parent.plan) !== canonicalJson(currentParentPlan)) throw new Error("Precreated campaign parent plan does not match the current corpus and manifests");
  const expected = createCampaignPlanShards(currentParentPlan, saved.execution.shardCount)[saved.execution.shardIndex];
  if (!expected || saved.planSha256 !== campaignPlanSha256(expected.plan) || canonicalJson(saved.plan) !== canonicalJson(expected.plan)) throw new Error("Precreated campaign child plan does not match its saved parent partition");
  return { directory, manifest: saved, entries };
}

/** Reads the authoritative request without selecting a latest campaign or accepting legacy runs.json state. */
export async function loadResumableBenchRequest(runsDirectory: string, benchId: string): Promise<CampaignRequest> {
  const manifest = await loadCampaignManifest(benchDirectory(runsDirectory, benchId));
  if (manifest.execution.mode !== "serial") throw new Error("A serial campaign request refuses shard parent and child manifests");
  return manifest.request;
}

async function executeCampaign(options: ResumableRunBenchOptions, manifest: CampaignManifest, entries: readonly BenchPlanEntry[], directory: string, lease: CampaignLease, withCellSlot?: <T>(operation: () => Promise<T>) => Promise<T>): Promise<RunBenchOutcome> {
  if (manifest.execution.mode === "shard-parent") throw new Error("A shard parent is coordination authority and cannot execute cells");
  await lease.assertOwned();
  let chain = await loadCampaignCheckpointChain(directory, manifest);
  if (!chain.latest) throw new Error("Campaign has no authoritative generation-zero checkpoint");
  let checkpoint = chain.latest;
  await assertNoAmbiguousCampaignBundles(options.runsDirectory, manifest, checkpoint);
  let completed = await validateCompleted(options, manifest, checkpoint.completed, directory);

  if (checkpoint.activeAttempt) {
    const active = checkpoint.activeAttempt;
    const cell = requirePlanCell(manifest, active.cellKey);
    const finalPath = pathForRun(options.runsDirectory, active.runId);
    const stagingPath = pathForRun(options.runsDirectory, `.staging-${active.runId}`);
    const [hasFinal, hasStaging] = await Promise.all([isDirectory(finalPath), isDirectory(stagingPath)]);
    if (hasFinal && hasStaging) throw new Error("Campaign active attempt has both finalized and staging bundles");
    if (hasFinal) {
      const accepted = await acceptFinalizedAttempt(options, manifest, cell, active, directory);
      await lease.assertOwned();
      checkpoint = await nextCheckpoint(directory, manifest, checkpoint, [...checkpoint.completed, accepted.completed], null, allComplete(manifest, [...checkpoint.completed, accepted.completed]) ? "aggregating" : "running");
      completed.set(cell.cellKey, accepted);
      await options.lifecycle?.({ event: "reconciled", benchId: manifest.benchId, directory });
    } else {
      if (hasStaging) await preserveInterruptedStaging(directory, stagingPath, active.runId, options.runsDirectory);
      await lease.assertOwned();
      checkpoint = await nextCheckpoint(directory, manifest, checkpoint, checkpoint.completed, null, "running");
    }
  }

  while (true) {
    const cell = manifest.plan.find((candidate) => candidate.skipReason === null && !completed.has(candidate.cellKey));
    if (!cell) break;
    const entry = entryForCell(entries, cell);
    const attemptNumber = nextAttemptNumber(chain.checkpoints, checkpoint, cell.cellKey);
    const active: ActiveCampaignAttempt = { cellKey: cell.cellKey, ordinal: cell.ordinal, attempt: attemptNumber, runId: deterministicRunId(manifest.benchId, cell.ordinal, attemptNumber), startedAt: new Date().toISOString() };
    await lease.assertOwned();
    checkpoint = await nextCheckpoint(directory, manifest, checkpoint, checkpoint.completed, active, "running");
    chain = await loadCampaignCheckpointChain(directory, manifest);
    await options.crashHook?.("after-attempt-checkpoint");

    let accepted: AcceptedCell;
    try {
      const operation = () => options.runScenario(scenarioOptions(options, manifest, cell, entry, active));
      const result = await (withCellSlot ? withCellSlot(operation) : operation());
      if (result.runId !== active.runId || path.resolve(result.path) !== path.resolve(pathForRun(options.runsDirectory, active.runId))) throw new Error("Scenario returned a run outside its active campaign attempt");
      await options.crashHook?.("after-bundle-finalized");
      accepted = await acceptFinalizedAttempt(options, manifest, cell, active, directory);
    } catch (error) {
      if (await isDirectory(pathForRun(options.runsDirectory, active.runId))) throw error;
      const facilityFailure = caughtFacilityFailure(error);
      const evaluation = evaluateFailedAttempt({ ...evaluationIdentity(cell), lane: cell.lane, attemptId: active.runId, error, facilityFailure, wallClockMs: Date.now() - Date.parse(active.startedAt) });
      const recorded = await persistEvaluation(directory, cell, evaluation, { problems: [] });
      accepted = { ...recorded, bundle: undefined };
    }
    const records = [...checkpoint.completed, accepted.completed];
    await lease.assertOwned();
    checkpoint = await nextCheckpoint(directory, manifest, checkpoint, records, null, allComplete(manifest, records) ? "aggregating" : "running");
    completed.set(cell.cellKey, accepted);
    await options.crashHook?.("after-completion-checkpoint");
  }

  if (checkpoint.state === "running") {
    await lease.assertOwned();
    checkpoint = await nextCheckpoint(directory, manifest, checkpoint, checkpoint.completed, null, "aggregating");
  }
  await options.crashHook?.("before-aggregation");
  await lease.assertOwned();
  const outcome = await publishCampaignProjections(manifest, directory, completed);
  if (checkpoint.state !== "finished") {
    await lease.assertOwned();
    checkpoint = await nextCheckpoint(directory, manifest, checkpoint, checkpoint.completed, null, "finished");
  }
  await options.lifecycle?.({ event: "finished", benchId: manifest.benchId, directory });
  return outcome;
}

async function withCampaignLease<T>(directory: string, leaseOptions: CampaignLeaseOptions | undefined, operation: (lease: CampaignLease) => Promise<T>): Promise<T> {
  const lease = await acquireCampaignLease(directory, leaseOptions);
  try { return await operation(lease); }
  finally { await lease.release(); }
}

type AcceptedCell = { cell: CampaignPlanCell; evaluation: RunEvaluation; record: BenchRunRecord; completed: CompletedCampaignCell; bundle: Awaited<ReturnType<typeof readRunBundle>> | undefined };

async function validateCompleted(options: ResumableRunBenchOptions, manifest: CampaignManifest, records: readonly CompletedCampaignCell[], directory: string): Promise<Map<string, AcceptedCell>> {
  const accepted = new Map<string, AcceptedCell>();
  for (const record of records) {
    const cell = requirePlanCell(manifest, record.cellKey);
    const evaluationPath = path.join(directory, ...record.evaluation.split("/"));
    const bytes = await readFile(evaluationPath);
    if (sha256(bytes) !== record.evaluationSha256) throw new Error("Completed campaign evaluation hash mismatch");
    const evaluation = parseRunEvaluationJson(bytes.toString("utf8"));
    assertEvaluationIdentity(cell, evaluation, record.runId);
    let bundle: AcceptedCell["bundle"];
    if (await isDirectory(pathForRun(options.runsDirectory, record.runId))) bundle = await validatedBundle(options, manifest, cell, record.runId, undefined);
    else assertCaughtRunnerEvaluation(evaluation);
    accepted.set(cell.cellKey, { cell, evaluation, record: recordFromEvaluation(cell, evaluation, bundle), completed: record, bundle });
  }
  return accepted;
}

async function assertNoAmbiguousCampaignBundles(runsDirectory: string, manifest: CampaignManifest, checkpoint: CampaignCheckpoint): Promise<void> {
  const allowed = new Set([...checkpoint.completed.map(({ runId }) => runId), ...(checkpoint.activeAttempt ? [checkpoint.activeAttempt.runId] : [])]);
  const receipts = new Map<string, string>();
  for (const name of await readdir(path.resolve(runsDirectory))) {
    if (name.startsWith(".") || name === "bench" || !await isDirectory(pathForRun(runsDirectory, name))) continue;
    let receiptText: string;
    try { receiptText = await readFile(path.join(pathForRun(runsDirectory, name), "bench-receipt.json"), "utf8"); }
    catch (error) { if (isCode(error, "ENOENT")) continue; throw error; }
    const receipt = parseBenchReceiptJson(receiptText);
    if (receipt.campaignId !== manifest.benchId) continue;
    if (receipt.runId !== name || !manifest.plan.some((cell) => cell.cellKey === receipt.cellKey)) throw new Error("Campaign has a finalized bundle with a contradictory receipt");
    if (receipts.has(receipt.cellKey) || !allowed.has(name)) throw new Error("Campaign has a duplicate or orphan finalized bundle receipt");
    receipts.set(receipt.cellKey, name);
  }
}

async function acceptFinalizedAttempt(options: ResumableRunBenchOptions, manifest: CampaignManifest, cell: CampaignPlanCell, active: ActiveCampaignAttempt, directory: string): Promise<AcceptedCell> {
  const bundle = await validatedBundle(options, manifest, cell, active.runId, active);
  const evaluation = reconstructBenchEvaluation(cell, active, bundle, pathForRun(options.runsDirectory, active.runId));
  const observed = { problems: bundle.problems, ...(bundle.recordedFailure ? { cause: bundle.recordedFailure.message } : {}) };
  const persisted = await persistEvaluation(directory, cell, evaluation, observed);
  return { ...persisted, bundle };
}

async function validatedBundle(options: ResumableRunBenchOptions, manifest: CampaignManifest, cell: CampaignPlanCell, runId: string, active: ActiveCampaignAttempt | undefined): Promise<Awaited<ReturnType<typeof readRunBundle>>> {
  await options.inspectRun(options.runsDirectory, runId);
  const preliminary = await readRunBundle(pathForRun(options.runsDirectory, runId));
  const category = preliminary.evaluation?.failureCategory;
  const bundle = category ? await readRunBundle(pathForRun(options.runsDirectory, runId), category) : preliminary;
  if (!bundle.manifest || !bundle.evaluation || !bundle.benchReceipt) throw new Error("Finalized campaign bundle is missing a valid manifest, evaluation, or receipt");
  const attempt = active?.attempt ?? attemptFromRunId(manifest.benchId, cell.ordinal, runId);
  const expectedReceipt = { campaignId: manifest.benchId, planSha256: manifest.planSha256, cellKey: cell.cellKey, cellIdentity: cellIdentity(cell), attempt, runId };
  if (canonicalJson(bundle.benchReceipt) !== canonicalJson({ schemaVersion: "0.1", ...expectedReceipt })) throw new Error("Finalized campaign bundle receipt does not match its campaign cell and attempt");
  if (bundle.evaluation.runId !== runId || bundle.evaluation.scenarioId !== cell.scenarioId || bundle.evaluation.workflowId !== cell.workflowId || bundle.evaluation.variantId !== cell.variantId || bundle.evaluation.repeatIndex !== cell.repeatIndex || bundle.evaluation.lane !== cell.lane || canonicalJson(bundle.evaluation.automationFailureExpected) !== canonicalJson(cell.expectedFailure)) throw new Error("Finalized campaign bundle evaluation identity does not match its cell");
  return bundle;
}

function reconstructBenchEvaluation(cell: CampaignPlanCell, active: ActiveCampaignAttempt, bundle: Awaited<ReturnType<typeof readRunBundle>>, bundlePath: string): RunEvaluation {
  const source = bundle.evaluation;
  if (!source || !bundle.manifest) throw new Error("Cannot reconstruct an evaluation from an incomplete finalized bundle");
  const identity = evaluationIdentity(cell);
  const result = { runId: active.runId, verdict: source.verdict === "passed" ? "passed" as const : "failed" as const, ...(source.failureCategory ? { failureCategory: source.failureCategory } : {}) };
  const observed = { ...identity, facilityFailure: source.facilityFailure, result, manifest: bundle.manifest, metrics: bundle.metrics, finalSequence: bundle.finalSequence, errorSequence: bundle.errorSequence, wallClockMs: source.durationMs };
  if (cell.lane === "recording") return evaluateRecordingRun(observed);
  return evaluateFlowRun({ ...observed, result: { ...result, path: bundlePath, observation: { lane: "flow", flowCreated: source.flowCreated === true, oracleVerdict: source.oracleVerdict, reportedVerdict: source.reportedVerdict, automationFailureReported: source.automationFailureReported, automationFailureExpected: source.automationFailureExpected, harnessActivations: source.harnessActivations, actions: source.actions, extraction: source.extraction } } });
}

async function persistEvaluation(directory: string, cell: CampaignPlanCell, evaluation: RunEvaluation, observed: { problems: string[]; cause?: string }): Promise<Omit<AcceptedCell, "bundle">> {
  let evaluationPath: string;
  try { evaluationPath = await writeRunEvaluation(directory, evaluation); }
  catch (error) {
    if (!isCode(error, "EEXIST")) throw error;
    evaluationPath = `evaluations/${evaluation.runId}.json`;
    const existing = parseRunEvaluationJson(await readFile(path.join(directory, ...evaluationPath.split("/")), "utf8"));
    if (canonicalJson(existing) !== canonicalJson(evaluation)) throw new Error("Existing immutable campaign evaluation contradicts the reconciled bundle");
  }
  const bytes = await readFile(path.join(directory, ...evaluationPath.split("/")));
  const record = recordFromEvaluation(cell, evaluation, undefined, observed);
  return { cell, evaluation, record, completed: { cellKey: cell.cellKey, runId: evaluation.runId, evaluation: evaluationPath, evaluationSha256: sha256(bytes) } };
}

async function publishCampaignProjections(manifest: CampaignManifest, directory: string, accepted: Map<string, AcceptedCell>): Promise<RunBenchOutcome> {
  if (!allComplete(manifest, [...accepted.values()].map(({ completed }) => completed))) throw new Error("Campaign cannot aggregate with incomplete plan coverage");
  const evaluated = manifest.plan.flatMap((cell) => { const value = accepted.get(cell.cellKey); return value ? [{ corpusRowId: cell.corpusRowId, evaluation: value.evaluation }] : []; });
  const finishedAt = new Date().toISOString();
  const file: BenchRunsFile = {
    schemaVersion: "0.1", benchId: manifest.benchId, corpusId: manifest.request.corpusId, repeatCount: manifest.request.repeatCount, target: manifest.request.target.mode, lanes: uniqueLanes(manifest.plan),
    startedAt: manifest.createdAt, finishedAt, sources: RECORDING_LANE_SOURCES, ...(manifest.plan.some((cell) => cell.skipReason === null && cell.lane === "flow") ? { flowSources: FLOW_LANE_SOURCES } : {}),
    runs: manifest.plan.map((cell): BenchRunRecord => cell.skipReason === null ? requireAccepted(accepted, cell).record : { ...identityOf(cell), repeatIndex: cell.repeatIndex, status: "skipped", skipReason: cell.skipReason }),
  };
  const results = groupBenchResults(evaluated);
  const report = results.length === 0 ? undefined : aggregateBenchReport({ reportId: manifest.benchId, generatedAt: finishedAt, corpusId: manifest.request.corpusId, repeatCount: manifest.request.repeatCount, target: manifest.request.target.mode, results });
  await writeBenchRuns(directory, file);
  const reportPath = report ? await writeBenchReport(directory, report) : null;
  const coverage: BenchMarkdownCoverage = { total: benchExecutionCoverage(results), byLane: Object.fromEntries(benchResultsByLane(results).map(([lane, onLane]) => [lane, benchExecutionCoverage(onLane)])) };
  const markdown = await writeBenchMarkdown(directory, renderBenchMarkdown(file, report, coverage));
  const passed = evaluated.filter(({ evaluation }) => evaluation.verdict === "passed").length;
  const causes = benchFailureCauses(file.runs);
  return { status: evaluated.length > 0 && passed === evaluated.length ? "passed" : "failed", benchId: manifest.benchId, directory, report: reportPath, markdown, results: results.length, runs: evaluated.length, passed, skipped: file.runs.length - evaluated.length, notExecuted: coverage.total.notExecutedRuns, actionsExecuted: coverage.total.actions, ...(causes.length ? { failureCauses: causes.map(describeBenchFailureCause) } : {}) };
}

async function runOnce(options: RunBenchOptions, attempt: Attempt): Promise<{ evaluation: RunEvaluation; record: BenchRunRecord }> {
  const { entry, repeatIndex } = attempt;
  const identity: RunEvaluationIdentity = { scenarioId: entry.scenarioId, workflowId: entry.workflowId, variantId: entry.variantId, repeatIndex, expectedFailure: entry.expectedFailure };
  const started = Date.now();
  let result: RunScenarioResult;
  try {
    result = await options.runScenario({
      repositoryRoot: options.repositoryRoot,
      fluxiqRepositoryRoot: options.fluxiqRepositoryRoot,
      runsDirectory: options.runsDirectory,
      scenarioId: entry.scenarioId,
      ...(entry.workflowId === null ? {} : { workflowId: entry.workflowId }),
      // The Flow lane builds a Flow from the run's own recording and runs it,
      // with the variant armed when the result names one; the recording lane
      // cannot arm one, so a variant reaches the runner only here.
      ...(entry.lane === "flow" ? { flow: true, ...(entry.variantId === null ? {} : { variantId: entry.variantId }) } : {}),
      ...(options.evidence ? { evidence: options.evidence } : {}),
      environment: options.environment,
      target: options.target,
    });
  } catch (error) {
    const facilityFailure = caughtFacilityFailure(error);
    const evaluation = evaluateFailedAttempt({ ...identity, lane: entry.lane, attemptId: attempt.attemptId, error, facilityFailure, wallClockMs: Date.now() - started });
    return recordRun(attempt, evaluation, { problems: [] });
  }
  const wallClockMs = Date.now() - started;
  const problems: string[] = [];
  await options.inspectRun(options.runsDirectory, result.runId).catch((error: unknown) => { problems.push(`inspect: ${describeError(error)}`); });
  // A run can write several `error` events, and its cause is the one written under the category the runner returned.
  const bundle = await readRunBundle(result.path, result.failureCategory);
  problems.push(...bundle.problems);
  const observed = { ...identity, facilityFailure: bundle.evaluation?.facilityFailure ?? null, result, manifest: bundle.manifest, metrics: bundle.metrics, finalSequence: bundle.finalSequence, errorSequence: bundle.errorSequence, wallClockMs };
  const evaluation = entry.lane === "flow" ? evaluateFlowRun(observed) : evaluateRecordingRun(observed);
  // The run's own `error` event is the only place the message behind a failed
  // run exists; the runner's result carries a category and no text.
  return recordRun(attempt, evaluation, { problems, ...(bundle.recordedFailure ? { cause: bundle.recordedFailure.message } : {}) });
}

async function recordRun(attempt: Attempt, evaluation: RunEvaluation, observed: { problems: string[]; cause?: string }): Promise<{ evaluation: RunEvaluation; record: BenchRunRecord }> {
  const evaluationPath = await writeRunEvaluation(attempt.directory, evaluation);
  return {
    evaluation,
    record: {
      ...identityOf(attempt.entry), repeatIndex: attempt.repeatIndex, status: "evaluated",
      runId: evaluation.runId, evaluation: evaluationPath, verdict: evaluation.verdict,
      ...(evaluation.failureCategory === undefined ? {} : { failureCategory: evaluation.failureCategory }),
      facilityFailure: evaluation.facilityFailure,
      actionsExecuted: actionsExecuted(evaluation),
      ...(evaluation.verdict !== "passed" && observed.cause ? { failureCause: observed.cause } : {}),
      ...(observed.problems.length ? { problems: observed.problems } : {}),
    },
  };
}

function validateBenchRequest(options: Pick<RunBenchOptions, "target" | "repeatCount">): void {
  if (options.target.mode !== "isolated" && options.target.mode !== "persistent-isolated") throw new Error(`bench runs the recording and Flow lanes on isolated or persistent-isolated targets; a ${options.target.mode} target runs a pre-existing Flow instead of one built from the run's own recording`);
  if (!Number.isSafeInteger(options.repeatCount) || options.repeatCount < 1 || options.repeatCount > MAX_REPEAT) throw new Error(`--repeat must be between 1 and ${MAX_REPEAT}`);
}

const newBenchId = (): string => `bench-${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`;
const sha256 = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");
const pathForRun = (runsDirectory: string, runId: string): string => path.join(path.resolve(runsDirectory), runId);

function requestOf(options: Pick<RunBenchOptions, "corpus" | "repeatCount" | "target" | "evidence">): CampaignRequest {
  if (options.target.mode !== "isolated" && options.target.mode !== "persistent-isolated") throw new Error("Campaign target is not resumable");
  return { corpusId: options.corpus.id, repeatCount: options.repeatCount, target: { mode: options.target.mode, workspace: options.target.mode === "persistent-isolated" ? options.target.workspace : null }, evidence: options.evidence ?? null };
}

function checkpointInput(manifest: CampaignManifest, previous: CampaignCheckpoint | null, completed: readonly CompletedCampaignCell[], activeAttempt: ActiveCampaignAttempt | null, state: CampaignCheckpoint["state"]) {
  return { generation: (previous?.generation ?? -1) + 1, previousSha256: previous?.checkpointSha256 ?? null, campaignId: manifest.benchId, planSha256: manifest.planSha256, completed, activeAttempt, state };
}

function nextCheckpoint(directory: string, manifest: CampaignManifest, previous: CampaignCheckpoint, completed: readonly CompletedCampaignCell[], activeAttempt: ActiveCampaignAttempt | null, state: CampaignCheckpoint["state"]): Promise<CampaignCheckpoint> {
  return writeCampaignCheckpoint(directory, checkpointInput(manifest, previous, completed, activeAttempt, state));
}

function deterministicRunId(benchId: string, ordinal: number, attempt: number): string { return `${benchId}-c${ordinal}-a${attempt}`; }
function attemptFromRunId(benchId: string, ordinal: number, runId: string): number {
  const match = new RegExp(`^${benchId}-c${ordinal}-a([1-9][0-9]*)$`, "u").exec(runId);
  if (!match) throw new Error("Completed bundle run id is not deterministic for its campaign cell");
  const attempt = Number(match[1]);
  if (!Number.isSafeInteger(attempt)) throw new Error("Completed bundle attempt is invalid");
  return attempt;
}
function requirePlanCell(manifest: CampaignManifest, key: string): CampaignPlanCell {
  const cell = manifest.plan.find((candidate) => candidate.cellKey === key);
  if (!cell || cell.skipReason !== null) throw new Error("Campaign checkpoint references a non-executable cell");
  return cell;
}
function entryForCell(entries: readonly BenchPlanEntry[], cell: CampaignPlanCell): BenchPlanEntry {
  const entry = entries.find((candidate) => resultKey(candidate) === resultKey(cell));
  if (!entry || entry.skipReason !== undefined) throw new Error("Campaign cell no longer resolves to one executable corpus entry");
  return entry;
}
function evaluationIdentity(cell: CampaignPlanCell): RunEvaluationIdentity { return { scenarioId: cell.scenarioId, workflowId: cell.workflowId, variantId: cell.variantId, repeatIndex: cell.repeatIndex, expectedFailure: cell.expectedFailure }; }
function cellIdentity(cell: CampaignPlanCell) { return { corpusRowId: cell.corpusRowId, scenarioId: cell.scenarioId, workflowId: cell.workflowId, variantId: cell.variantId, lane: cell.lane, repeatIndex: cell.repeatIndex }; }

function scenarioOptions(options: ResumableRunBenchOptions, manifest: CampaignManifest, cell: CampaignPlanCell, entry: BenchPlanEntry, active: ActiveCampaignAttempt): RunScenarioOptions {
  return {
    repositoryRoot: options.repositoryRoot, fluxiqRepositoryRoot: options.fluxiqRepositoryRoot, runsDirectory: options.runsDirectory,
    scenarioId: entry.scenarioId, ...(entry.workflowId === null ? {} : { workflowId: entry.workflowId }),
    ...(entry.lane === "flow" ? { flow: true, ...(entry.variantId === null ? {} : { variantId: entry.variantId }) } : {}),
    ...(options.evidence ? { evidence: options.evidence } : {}), environment: options.environment, target: options.target, runId: active.runId,
    benchReceipt: { campaignId: manifest.benchId, planSha256: manifest.planSha256, cellKey: cell.cellKey, cellIdentity: cellIdentity(cell), attempt: active.attempt },
  };
}

function nextAttemptNumber(chain: readonly CampaignCheckpoint[], latest: CampaignCheckpoint, cellKey: string): number {
  const attempts = [...chain, latest].flatMap((checkpoint) => checkpoint.activeAttempt?.cellKey === cellKey ? [checkpoint.activeAttempt.attempt] : []);
  return Math.max(0, ...attempts) + 1;
}
function allComplete(manifest: CampaignManifest, records: readonly CompletedCampaignCell[]): boolean {
  const keys = new Set(records.map(({ cellKey }) => cellKey));
  return manifest.plan.every((cell) => cell.skipReason !== null || keys.has(cell.cellKey));
}
async function isDirectory(location: string): Promise<boolean> { try { return (await stat(location)).isDirectory(); } catch (error) { if (typeof error === "object" && error && "code" in error && (error as { code?: unknown }).code === "ENOENT") return false; throw error; } }
const isCode = (error: unknown, code: string): boolean => typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === code;

function assertEvaluationIdentity(cell: CampaignPlanCell, evaluation: RunEvaluation, runId: string): void {
  if (evaluation.runId !== runId || evaluation.scenarioId !== cell.scenarioId || evaluation.workflowId !== cell.workflowId || evaluation.variantId !== cell.variantId || evaluation.repeatIndex !== cell.repeatIndex || evaluation.lane !== cell.lane || canonicalJson(evaluation.automationFailureExpected) !== canonicalJson(cell.expectedFailure)) throw new Error("Completed evaluation identity does not match its campaign cell");
}
function assertCaughtRunnerEvaluation(evaluation: RunEvaluation): void {
  if (evaluation.verdict !== "inconclusive" || evaluation.facilityFailure?.boundary !== "no-final-bundle" || !evaluation.invariants.some((invariant) => invariant.actual.startsWith("runner threw before finalizing a bundle:"))) throw new Error("Completed campaign cell has no finalized bundle");
}
function recordFromEvaluation(cell: CampaignPlanCell, evaluation: RunEvaluation, bundle?: Awaited<ReturnType<typeof readRunBundle>>, observed?: { problems: string[]; cause?: string }): BenchRunRecord {
  const problems = observed?.problems ?? bundle?.problems ?? [];
  const cause = observed?.cause ?? bundle?.recordedFailure?.message;
  return { ...identityOf(cell), repeatIndex: cell.repeatIndex, status: "evaluated", runId: evaluation.runId, evaluation: `evaluations/${evaluation.runId}.json`, verdict: evaluation.verdict, ...(evaluation.failureCategory ? { failureCategory: evaluation.failureCategory } : {}), facilityFailure: evaluation.facilityFailure, actionsExecuted: actionsExecuted(evaluation), ...(evaluation.verdict !== "passed" && cause ? { failureCause: cause } : {}), ...(problems.length ? { problems } : {}) };
}

function caughtFacilityFailure(error: unknown): NonNullable<RunEvaluation["facilityFailure"]> {
  return error instanceof ProjectedFacilityError ? error.facilityFailure : projectFacilityFailure(error, "no-final-bundle", "bench.persist");
}
function requireAccepted(accepted: Map<string, AcceptedCell>, cell: CampaignPlanCell): AcceptedCell {
  const value = accepted.get(cell.cellKey); if (!value) throw new Error("Campaign aggregate is missing an executable cell"); return value;
}
function uniqueLanes(plan: readonly CampaignPlanCell[]): Array<"recording" | "flow"> { return [...new Set(plan.map(({ lane }) => lane))]; }

type ResultIdentity = Pick<BenchRunRecord, "corpusRowId" | "scenarioId" | "workflowId" | "variantId" | "lane">;
const identityOf = (entry: ResultIdentity): ResultIdentity => ({ corpusRowId: entry.corpusRowId, scenarioId: entry.scenarioId, workflowId: entry.workflowId, variantId: entry.variantId, lane: entry.lane });
// The lane is part of the key: an unarmed row's two lanes are two planned results, sorted apart.
const resultKey = (value: ResultIdentity): string => JSON.stringify([value.corpusRowId, value.scenarioId, value.workflowId, value.variantId, value.lane]);
