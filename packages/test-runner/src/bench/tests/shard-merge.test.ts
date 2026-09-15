import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { RunEvaluation } from "@fluxiq-web-extension/test-contracts";
import type { BenchPlanEntry } from "../expand-corpus.js";
import {
  BENCH_SEMANTICS_VERSION,
  CAMPAIGN_SCHEMA_VERSION,
  CAMPAIGN_SHARD_ALGORITHM,
  campaignPlanSha256,
  createCampaignPlan,
  createCampaignShardGroup,
  sha256Canonical,
  writeCampaignCheckpoint,
  type CampaignCheckpoint,
  type CampaignCompatibility,
  type CampaignManifest,
  type CampaignPlanCell,
  type CampaignShardGroup,
  type CompletedCampaignCell
} from "../campaign/index.js";
import { prepareAuthenticatedShardMerge } from "../shard-merge.js";

const compatibility: CampaignCompatibility = {
  repositories: { facilityCommit: "1".repeat(40), coreCommit: "2".repeat(40) },
  lockfiles: { facilitySha256: "3".repeat(64), coreSha256: "4".repeat(64) },
  builds: { testRunnerSha256: "5".repeat(64), extensionSha256: "6".repeat(64), scenarioLabSha256: "7".repeat(64) },
  environment: { platform: "win32", architecture: "x64", browserName: "chromium", browserVersion: "Chrome/134", locale: "en-US", timezone: "UTC", viewport: { width: 1280, height: 720 } },
};
const entries: BenchPlanEntry[] = [
  { corpusRowId: "W01", scenarioId: "basic-form", workflowId: null, variantId: null, lane: "recording", resolved: true, expectedFailure: null },
  { corpusRowId: "W02", scenarioId: "modal-flow", workflowId: null, variantId: null, lane: "flow", resolved: true, expectedFailure: null },
];

function parent(): CampaignManifest {
  const plan = createCampaignPlan(entries, 2);
  return {
    schemaVersion: CAMPAIGN_SCHEMA_VERSION,
    benchId: "bench-parent-0123abcd",
    createdAt: "2026-09-14T00:00:00.000Z",
    benchSemanticsVersion: BENCH_SEMANTICS_VERSION,
    request: { corpusId: "unit", repeatCount: 2, target: { mode: "isolated", workspace: null }, evidence: "failure" },
    plan,
    planSha256: campaignPlanSha256(plan),
    compatibility,
    execution: { mode: "shard-parent", algorithm: CAMPAIGN_SHARD_ALGORITHM, shardCount: 2, jobs: 2 },
  };
}

function evaluation(cell: CampaignPlanCell, runId = `run-${cell.cellKey.slice(0, 12)}`): RunEvaluation {
  return {
    schemaVersion: "0.2", runId, verdict: "passed", facilityFailure: null,
    invariants: [{ id: "runner-verdict", passed: true, expected: "passed", actual: "passed", evidenceSequences: [] }], metrics: {},
    scenarioId: cell.scenarioId, workflowId: cell.workflowId, variantId: cell.variantId, repeatIndex: cell.repeatIndex, lane: cell.lane,
    flowCreated: cell.lane === "flow" ? true : null, oracleVerdict: "passed", reportedVerdict: cell.lane === "flow" ? "passed" : null, automationFailureReported: null,
    automationFailureExpected: cell.expectedFailure, harnessActivations: 0, durationMs: 10, actions: [],
    evidence: { sanitizedPacketBytes: [], rawSnapshotBytes: [], truncationCount: 0 }, llm: { mode: "disabled", profileId: null, calls: 0 },
    harnessRecovery: null, adaptationCost: null, adaptationValidation: null, adaptationPersistence: null, adaptationReuse: null,
  };
}

type SetupOptions = Readonly<{
  childOrder?: readonly number[];
  state?: CampaignCheckpoint["state"];
  evaluationFor?: (cell: CampaignPlanCell, index: number) => RunEvaluation;
}>;

async function setup(options: SetupOptions = {}): Promise<{ root: string; group: CampaignShardGroup; bytes: Map<string, Buffer> }> {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-shard-merge-"));
  const group = await createCampaignShardGroup(root, parent());
  const bytes = new Map<string, Buffer>();
  for (const index of options.childOrder ?? [0, 1]) {
    const child = group.children[index]!;
    const childDirectory = path.join(root, "shards", index.toString().padStart(3, "0"));
    await mkdir(path.join(childDirectory, "evaluations"), { recursive: true });
    const completed: CompletedCampaignCell[] = [];
    for (const [cellIndex, cell] of child.plan.entries()) {
      const value = options.evaluationFor?.(cell, cellIndex) ?? evaluation(cell);
      const content = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
      const relative = `evaluations/${value.runId}.json`;
      await writeFile(path.join(childDirectory, ...relative.split("/")), content);
      bytes.set(cell.cellKey, content);
      completed.push({ cellKey: cell.cellKey, runId: value.runId, evaluation: relative, evaluationSha256: sha256(content) });
    }
    await writeFile(path.join(childDirectory, "runs.json"), `runs-${index}\n`);
    await writeFile(path.join(childDirectory, "report.json"), `report-${index}\n`);
    await writeFile(path.join(childDirectory, "report.md"), `markdown-${index}\n`);
    await writeCampaignCheckpoint(childDirectory, {
      generation: 0, previousSha256: null, campaignId: child.benchId, planSha256: child.planSha256,
      completed, activeAttempt: null, state: options.state ?? "finished",
    });
  }
  return { root, group, bytes };
}

test("terminal children merge in parent order regardless of child finish order and provide exact seal inputs", async () => {
  const state = await setup({ childOrder: [1, 0] });
  try {
    const merged = await prepareAuthenticatedShardMerge(state.root);
    assert.deepEqual(merged.evaluations.map(({ cell }) => cell.cellKey), state.group.parent.plan.map(({ cellKey }) => cellKey));
    assert.deepEqual(merged.completed.map(({ evaluation }) => evaluation), merged.evaluations.map(({ evaluation }) => `evaluations/${evaluation.runId}.json`));
    for (const { cell, completed } of merged.evaluations) {
      assert.deepEqual(await readFile(path.join(state.root, completed.evaluation)), state.bytes.get(cell.cellKey));
    }
    assert.deepEqual(merged.childProjections.map(({ index, campaignId, terminalCheckpointSha256 }) => ({ index, campaignId, terminalCheckpointSha256 })), merged.group.children.map((child, index) => ({
      index, campaignId: child.benchId, terminalCheckpointSha256: merged.childProjections[index]!.terminalCheckpointSha256,
    })));
    assert.equal(merged.childProjections[0]!.runsSha256, sha256("runs-0\n"));
    assert.equal(merged.childProjections[1]!.markdownSha256, sha256("markdown-1\n"));
  } finally { await rm(state.root, { recursive: true, force: true }); }
});

test("create-exclusive copies are idempotent but contradictory parent bytes fail closed", async () => {
  const state = await setup();
  try {
    const first = await prepareAuthenticatedShardMerge(state.root);
    assert.deepEqual(await prepareAuthenticatedShardMerge(state.root), first);
    await writeFile(path.join(state.root, first.completed[0]!.evaluation), "different\n");
    await assert.rejects(prepareAuthenticatedShardMerge(state.root), /contradicts/u);
  } finally { await rm(state.root, { recursive: true, force: true }); }
});

test("byte corruption, missing receipts, and orphan receipts are rejected before merge", async (t) => {
  for (const kind of ["corrupt", "missing", "orphan"] as const) await t.test(kind, async () => {
    const state = await setup();
    try {
      const childDirectory = path.join(state.root, "shards", "000", "evaluations");
      const names = await readdirNames(childDirectory);
      if (kind === "corrupt") await writeFile(path.join(childDirectory, names[0]!), "{}\n");
      if (kind === "missing") await rm(path.join(childDirectory, names[0]!));
      if (kind === "orphan") await writeFile(path.join(childDirectory, "orphan.json"), "{}\n");
      await assert.rejects(prepareAuthenticatedShardMerge(state.root), /digest|missing|orphan/u);
      await assert.rejects(readFile(path.join(state.root, "evaluations", path.basename(names[0]!))), /ENOENT/u);
    } finally { await rm(state.root, { recursive: true, force: true }); }
  });
});

test("duplicate run ids and evaluation identity mismatches are rejected", async (t) => {
  await t.test("duplicate", async () => {
    const state = await setup({ evaluationFor: (cell) => evaluation(cell, cell.repeatIndex === 0 ? "run-duplicate" : `run-${cell.cellKey.slice(0, 12)}`) });
    try { await assert.rejects(prepareAuthenticatedShardMerge(state.root), /duplicate run id/u); }
    finally { await rm(state.root, { recursive: true, force: true }); }
  });
  await t.test("identity", async () => {
    const state = await setup({ evaluationFor: (cell, index) => ({ ...evaluation(cell), ...(index === 0 ? { scenarioId: "other-scenario" } : {}) }) });
    try { await assert.rejects(prepareAuthenticatedShardMerge(state.root), /identity/u); }
    finally { await rm(state.root, { recursive: true, force: true }); }
  });
});

test("nonterminal, leased, and path-escaping child authority cannot merge", async (t) => {
  await t.test("nonterminal", async () => {
    const state = await setup({ state: "aggregating" });
    try { await assert.rejects(prepareAuthenticatedShardMerge(state.root), /not terminal/u); }
    finally { await rm(state.root, { recursive: true, force: true }); }
  });
  await t.test("leased", async () => {
    const state = await setup();
    try {
      await mkdir(path.join(state.root, "shards", "000", "lease"));
      await assert.rejects(prepareAuthenticatedShardMerge(state.root), /still has a lease/u);
    } finally { await rm(state.root, { recursive: true, force: true }); }
  });
  await t.test("escape", async () => {
    const state = await setup();
    try {
      const checkpointFile = path.join(state.root, "shards", "000", "checkpoints", "000000000000.json");
      const checkpoint = JSON.parse(await readFile(checkpointFile, "utf8")) as CampaignCheckpoint;
      const completed = checkpoint.completed.map((record, index) => index === 0 ? { ...record, evaluation: "../outside.json" } : record);
      const unsigned = { ...checkpoint, completed } as Record<string, unknown>;
      delete unsigned.checkpointSha256;
      await writeFile(checkpointFile, `${JSON.stringify({ ...unsigned, checkpointSha256: sha256Canonical(unsigned) }, null, 2)}\n`);
      await assert.rejects(prepareAuthenticatedShardMerge(state.root), /evaluation path is unsafe|portable relative path/u);
    } finally { await rm(state.root, { recursive: true, force: true }); }
  });
});

async function readdirNames(directory: string): Promise<string[]> {
  return (await readdir(directory)).sort();
}
function sha256(value: string | Uint8Array): string { return createHash("sha256").update(value).digest("hex"); }
