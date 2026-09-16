import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { RunEvaluation, WebScenario } from "@fluxiq-web-extension/test-contracts";
import { BENCH_SEMANTICS_VERSION, CAMPAIGN_SCHEMA_VERSION, CAMPAIGN_SHARD_ALGORITHM, campaignPlanSha256, createCampaignPlan, loadCampaignCheckpointChain, loadCampaignManifest, writeCampaignCheckpoint, writeCampaignManifest, type CampaignCompatibility, type CampaignManifest, type CampaignPlanCell, type CompletedCampaignCell } from "../campaign/index.js";
import type { BenchCorpus } from "../corpus/index.js";
import { expandCorpus } from "../expand-corpus.js";
import type { PrecreatedBenchCampaignOptions, RunBenchOutcome } from "../run-bench.js";
import { createShardedBench, resumeShardedBench, type CreateShardedBenchOptions, type ShardedBenchCrashPoint, type ShardedBenchLifecycle } from "../sharded-bench.js";

const scenario = (id: string): WebScenario => ({ id, recordingScript: [], expected: {} }) as unknown as WebScenario;
const manifests = [scenario("alpha"), scenario("beta"), scenario("gamma")];
const corpus: BenchCorpus = {
  id: "sharded-unit", description: "sharded unit", lanes: ["recording"],
  rows: manifests.map((manifest, index) => ({ id: `W0${index + 1}`, scenarioId: manifest.id, workflowId: null, unarmed: true, variantIds: [] })),
};
const compatibility: CampaignCompatibility = {
  repositories: { facilityCommit: "1".repeat(40), coreCommit: "2".repeat(40) },
  lockfiles: { facilitySha256: "3".repeat(64), coreSha256: "4".repeat(64) },
  builds: { testRunnerSha256: "5".repeat(64), extensionSha256: "6".repeat(64), scenarioLabSha256: "7".repeat(64) },
  environment: { platform: "win32", architecture: "x64", browserName: "chromium", browserVersion: "Chrome/134", locale: "en-US", timezone: "UTC", viewport: { width: 1280, height: 720 } },
};

function evaluation(cell: CampaignPlanCell, runId: string, verdict: "passed" | "failed" = "passed"): RunEvaluation {
  return {
    schemaVersion: "0.3", runId, verdict, ...(verdict === "failed" ? { failureCategory: "runtime.behavior" as const } : {}), facilityFailure: null,
    invariants: verdict === "passed" ? [] : [{ id: "runner-verdict", passed: false, expected: "passed", actual: "failed", evidenceSequences: [] }], metrics: {},
    scenarioId: cell.scenarioId, workflowId: cell.workflowId, variantId: cell.variantId, repeatIndex: cell.repeatIndex, lane: cell.lane,
    flowCreated: null, oracleVerdict: verdict, reportedVerdict: null, automationFailureReported: null, automationFailureExpected: cell.expectedFailure,
    harnessActivations: 0, durationMs: 10, actions: [{ actionType: "web.dom.click", durationMs: 2 }],
    evidence: { sanitizedPacketBytes: [], rawSnapshotBytes: [], truncationCount: 0 }, llm: { mode: "disabled", profileId: null, calls: 0 },
    extraction: null,
    harnessRecovery: null, adaptationCost: null, adaptationValidation: null, adaptationPersistence: null, adaptationReuse: null,
  };
}

type Harness = ReturnType<typeof harness>;
function harness(configuration: { crashChildOnce?: number; failedChild?: number; delay?: boolean } = {}) {
  const childCalls: number[] = [];
  const slotEvents: string[] = [];
  let activeChildren = 0;
  let maxActiveChildren = 0;
  let crashed = false;
  let slotId = 0;
  const executeChild = async (options: PrecreatedBenchCampaignOptions): Promise<RunBenchOutcome> => {
    assert.equal(options.manifest.execution.mode, "shard-child");
    const index = options.manifest.execution.mode === "shard-child" ? options.manifest.execution.shardIndex : -1;
    childCalls.push(index);
    const existing = await loadCampaignCheckpointChain(options.directory, options.manifest);
    if (existing.latest?.state === "finished") return dummyOutcome(options.directory, options.manifest.benchId);
    activeChildren += 1;
    maxActiveChildren = Math.max(maxActiveChildren, activeChildren);
    try {
      if (configuration.delay) await new Promise<void>(resolve => setTimeout(resolve, 5));
      if (configuration.crashChildOnce === index && !crashed) { crashed = true; throw new Error(`child ${index} crashed`); }
      const completed: CompletedCampaignCell[] = [];
      await mkdir(path.join(options.directory, "evaluations"), { recursive: true });
      for (const [cellIndex, cell] of options.manifest.plan.entries()) {
        await options.withCellSlot?.(async () => {
          if (configuration.delay) await new Promise<void>(resolve => setTimeout(resolve, 2));
        });
        const runId = `run-child${index}-cell${cellIndex}`;
        const value = evaluation(cell, runId, configuration.failedChild === index ? "failed" : "passed");
        const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
        const relative = `evaluations/${runId}.json`;
        await writeFile(path.join(options.directory, ...relative.split("/")), bytes);
        completed.push({ cellKey: cell.cellKey, runId, evaluation: relative, evaluationSha256: sha(bytes) });
      }
      await writeFile(path.join(options.directory, "runs.json"), `child-runs-${index}\n`);
      await writeFile(path.join(options.directory, "report.json"), `child-report-${index}\n`);
      await writeFile(path.join(options.directory, "report.md"), `child-markdown-${index}\n`);
      await writeCampaignCheckpoint(options.directory, {
        generation: 0, previousSha256: null, campaignId: options.manifest.benchId, planSha256: options.manifest.planSha256,
        completed, activeAttempt: null, state: "finished",
      });
      return dummyOutcome(options.directory, options.manifest.benchId);
    } finally { activeChildren -= 1; }
  };
  const acquireSlot = async () => {
    const id = slotId++;
    slotEvents.push(`acquire-${id}`);
    return {
      owner: { schemaVersion: "0.1" as const, ticketId: `ticket_${String(id).padStart(9, "0")}`, pid: 1, bootIdentitySha256: "a".repeat(64), processIdentitySha256: "b".repeat(64), requestedAt: "2026-09-14T00:00:00.000Z" },
      slotIndex: id % 2,
      assertOwned: async () => { slotEvents.push(`assert-${id}`); },
      release: async () => { slotEvents.push(`release-${id}`); },
    };
  };
  return { executeChild, acquireSlot, childCalls, slotEvents, maxActive: () => maxActiveChildren };
}

function options(root: string, worker: Harness, changes: Partial<CreateShardedBenchOptions> = {}): CreateShardedBenchOptions {
  return {
    corpus, repeatCount: 1, target: { mode: "isolated" }, manifests,
    repositoryRoot: root, fluxiqRepositoryRoot: root, runsDirectory: path.join(root, "runs"), environment: {},
    runScenario: async () => { throw new Error("stub child executor owns execution"); }, inspectRun: async () => ({ valid: true }),
    compatibility, shardCount: 3, jobs: 2, benchId: "bench-sharded-0123abcd",
    campaignLeaseOptions: leaseOptions(), runtime: { executeChild: worker.executeChild, acquireSlot: worker.acquireSlot },
    ...changes,
  };
}

test("creation publishes lifecycle once, honors saved jobs, and wraps every cell in a released machine slot", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-sharded-orchestrator-"));
  const worker = harness({ delay: true });
  const lifecycle: ShardedBenchLifecycle[] = [];
  try {
    const outcome = await createShardedBench(options(root, worker, { lifecycle: record => { lifecycle.push(record); } }));
    assert.equal(outcome.status, "passed");
    assert.equal(worker.maxActive(), 2);
    assert.deepEqual(worker.childCalls.sort(), [0, 1, 2]);
    assert.equal(worker.slotEvents.filter(event => event.startsWith("acquire-")).length, 3);
    assert.equal(worker.slotEvents.filter(event => event.startsWith("release-")).length, 3);
    assert.deepEqual(lifecycle.map(({ event }) => event), ["created", "children-finished", "aggregating", "sealed", "finished"]);
    const manifest = await loadCampaignManifest(outcome.directory);
    assert.deepEqual(manifest.execution, { mode: "shard-parent", algorithm: CAMPAIGN_SHARD_ALGORITHM, shardCount: 3, jobs: 2 });
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("a recorded cell failure does not stop siblings, while a child crash is resumed after healthy siblings finish", async () => {
  const failedRoot = await mkdtemp(path.join(os.tmpdir(), "fluxiq-sharded-failure-"));
  try {
    const worker = harness({ failedChild: 0 });
    const result = await createShardedBench(options(failedRoot, worker));
    assert.equal(result.status, "failed");
    assert.deepEqual(worker.childCalls.sort(), [0, 1, 2]);
  } finally { await rm(failedRoot, { recursive: true, force: true }); }

  const crashRoot = await mkdtemp(path.join(os.tmpdir(), "fluxiq-sharded-child-crash-"));
  try {
    const worker = harness({ crashChildOnce: 0, delay: true });
    const created = options(crashRoot, worker);
    await assert.rejects(createShardedBench(created), /did not reach terminal/u);
    assert.deepEqual(new Set(worker.childCalls), new Set([0, 1, 2]));
    const resumed = await resumeShardedBench(resumeOptions(created));
    assert.equal(resumed.status, "passed");
    assert.ok(worker.childCalls.filter(index => index === 0).length >= 2);
  } finally { await rm(crashRoot, { recursive: true, force: true }); }
});

test("every parent merge boundary resumes without rerunning completed cells", async (t) => {
  for (const point of ["after-parent-created", "after-child-pool", "after-merge-authenticated", "after-parent-aggregating", "after-parent-projections", "after-merge-seal", "after-parent-finished"] as const) await t.test(point, async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-sharded-boundary-"));
    const worker = harness();
    let armed = true;
    const created = options(root, worker, { crashHook: candidate => { if (armed && candidate === point) { armed = false; throw new Error(`crash ${point}`); } } });
    try {
      await assert.rejects(createShardedBench(created), new RegExp(`crash ${point}`));
      const callsBeforeResume = worker.childCalls.length;
      const result = await resumeShardedBench(resumeOptions(created));
      assert.equal(result.status, "passed");
      if (point !== "after-parent-created" && point !== "after-merge-authenticated") assert.equal(worker.childCalls.length, callsBeforeResume);
      const parent = await loadCampaignManifest(result.directory);
      const chain = await loadCampaignCheckpointChain(result.directory, parent);
      assert.equal(chain.latest?.state, "finished");
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});

test("a finished second resume preserves sealed projection bytes and rejects scheduler overrides", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-sharded-second-resume-"));
  const worker = harness();
  try {
    const created = options(root, worker);
    const first = await createShardedBench(created);
    const before = await projectionBytes(first.directory);
    const calls = worker.childCalls.length;
    const second = await resumeShardedBench(resumeOptions(created));
    assert.deepEqual(second, first);
    assert.deepEqual(await projectionBytes(first.directory), before);
    assert.equal(worker.childCalls.length, calls);
    await assert.rejects(resumeShardedBench({ ...resumeOptions(created), jobs: 1 } as never), /refuses scheduler/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("invalid creation settings and a serial parent are refused", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-sharded-invalid-"));
  const worker = harness();
  try {
    await assert.rejects(createShardedBench(options(root, worker, { jobs: 4 })), /jobs/u);
    await assert.rejects(createShardedBench(options(root, worker, { target: { mode: "persistent-isolated", workspace: "unit" } })), /isolated target/u);
    const serialId = "bench-serial-89abcdef";
    const directory = path.join(root, "runs", "bench", serialId);
    const plan = createCampaignPlan(expandCorpus(corpus, manifests), 1);
    const manifest: CampaignManifest = {
      schemaVersion: CAMPAIGN_SCHEMA_VERSION, benchId: serialId, createdAt: "2026-09-14T00:00:00.000Z", benchSemanticsVersion: BENCH_SEMANTICS_VERSION,
      request: { corpusId: corpus.id, repeatCount: 1, target: { mode: "isolated", workspace: null }, evidence: null }, plan, planSha256: campaignPlanSha256(plan), compatibility, execution: { mode: "serial" },
    };
    await writeCampaignManifest(directory, manifest);
    await assert.rejects(resumeShardedBench({ ...resumeOptions(options(root, worker)), benchId: serialId }), /shard-parent/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});

function resumeOptions(created: CreateShardedBenchOptions) {
  const { shardCount: _shardCount, jobs: _jobs, ...base } = created;
  return { ...base, benchId: created.benchId! };
}
function leaseOptions() {
  return { processId: 91, randomId: () => "lease_orchestrator_0001", processProbe: { bootIdentity: async () => "boot", processIdentity: async () => "process" } };
}
function dummyOutcome(directory: string, benchId: string): RunBenchOutcome {
  return { status: "passed", benchId, directory, report: path.join(directory, "report.json"), markdown: path.join(directory, "report.md"), results: 1, runs: 1, passed: 1, skipped: 0, notExecuted: 0, actionsExecuted: 1 };
}
async function projectionBytes(directory: string): Promise<Buffer[]> { return Promise.all(["runs.json", "report.json", "report.md", "merge-seal.json"].map(name => readFile(path.join(directory, name)))); }
function sha(value: Uint8Array): string { return createHash("sha256").update(value).digest("hex"); }
