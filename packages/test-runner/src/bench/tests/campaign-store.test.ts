import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { BENCH_SEMANTICS_VERSION, CAMPAIGN_SCHEMA_VERSION, campaignPlanSha256, containedPath, createCampaignPlan, loadCampaignCheckpointChain, loadCampaignManifest, parseCampaignCheckpoint, parseCampaignManifest, preserveInterruptedStaging, writeCampaignCheckpoint, writeCampaignManifest, writeCampaignProjection, type CampaignCheckpointInput, type CampaignCompatibility, type CampaignManifest } from "../campaign/index.js";
import type { BenchPlanEntry } from "../expand-corpus.js";

const benchId = "bench-unit-0123abcd";
const compatibility: CampaignCompatibility = {
  repositories: { facilityCommit: "a".repeat(40), coreCommit: "b".repeat(40) },
  lockfiles: { facilitySha256: "c".repeat(64), coreSha256: "d".repeat(64) },
  builds: { testRunnerSha256: "e".repeat(64), extensionSha256: "f".repeat(64), scenarioLabSha256: "0".repeat(64) },
  environment: { platform: "win32", architecture: "x64", browserName: "chromium", browserVersion: "Chrome/134", locale: "en-US", timezone: "UTC", viewport: { width: 1280, height: 720 } },
};
const entries: BenchPlanEntry[] = [
  { corpusRowId: "W01", scenarioId: "basic-form", workflowId: null, variantId: null, lane: "recording", resolved: true, expectedFailure: null },
  { corpusRowId: "W02", scenarioId: "basic-form", workflowId: "missing", variantId: null, lane: "flow", resolved: false, expectedFailure: null, skipReason: "unresolved" },
];

function manifest(): CampaignManifest {
  const plan = createCampaignPlan(entries, 1);
  return {
    schemaVersion: CAMPAIGN_SCHEMA_VERSION, benchId, createdAt: "2026-09-14T00:00:00.000Z", benchSemanticsVersion: BENCH_SEMANTICS_VERSION,
    request: { corpusId: "unit", repeatCount: 1, target: { mode: "isolated", workspace: null }, evidence: null },
    plan, planSha256: campaignPlanSha256(plan), compatibility,
  };
}

function checkpoint(campaign: CampaignManifest, generation: number, previousSha256: string | null, overrides: Partial<CampaignCheckpointInput> = {}): CampaignCheckpointInput {
  return {
    generation, previousSha256, campaignId: campaign.benchId, planSha256: campaign.planSha256,
    completed: [], activeAttempt: null, state: "running", ...overrides,
  };
}

test("manifest round trips strictly and is immutable", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "campaign-store-"));
  try {
    const expected = manifest();
    await writeCampaignManifest(root, expected);
    assert.deepEqual(await loadCampaignManifest(root), expected);
    await assert.rejects(writeCampaignManifest(root, expected), (error: NodeJS.ErrnoException) => error.code === "EEXIST");
    const extra = { ...expected, surprise: true };
    assert.throws(() => parseCampaignManifest(extra), /unexpected or missing keys/u);
    assert.throws(() => parseCampaignManifest({ ...expected, planSha256: "1".repeat(64) }), /does not match/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("checkpoint generations form an immutable contiguous hash chain and temporary debris is disclosed", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "campaign-store-"));
  try {
    const campaign = manifest();
    const first = await writeCampaignCheckpoint(root, checkpoint(campaign, 0, null));
    const second = await writeCampaignCheckpoint(root, checkpoint(campaign, 1, first.checkpointSha256, {
      activeAttempt: { cellKey: campaign.plan[0]!.cellKey, ordinal: 0, attempt: 1, runId: "run-safe-1", startedAt: "2026-09-14T00:01:00.000Z" },
    }));
    await writeFile(path.join(root, "checkpoints", ".000000000002.json.dead.tmp"), "{truncated");
    const loaded = await loadCampaignCheckpointChain(root, campaign);
    assert.deepEqual(loaded.checkpoints.map(({ generation }) => generation), [0, 1]);
    assert.equal(loaded.latest?.checkpointSha256, second.checkpointSha256);
    assert.deepEqual(loaded.ignored, [".000000000002.json.dead.tmp"]);
    await assert.rejects(writeCampaignCheckpoint(root, checkpoint(campaign, 1, first.checkpointSha256)), (error: NodeJS.ErrnoException) => error.code === "EEXIST");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("a missing generation terminates the authoritative chain and discloses later generations", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "campaign-store-"));
  try {
    const campaign = manifest();
    await writeCampaignCheckpoint(root, checkpoint(campaign, 2, "1".repeat(64)));
    const loaded = await loadCampaignCheckpointChain(root, campaign);
    assert.equal(loaded.latest, null);
    assert.deepEqual(loaded.ignored, ["000000000002.json"]);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("bad content hashes and contradictory successor links fail closed", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "campaign-store-"));
  try {
    const campaign = manifest();
    const first = await writeCampaignCheckpoint(root, checkpoint(campaign, 0, null));
    const badHash = { ...first, state: "aggregating" };
    assert.throws(() => parseCampaignCheckpoint(badHash), /hash does not match/u);
    const validButUnlinked = await writeCampaignCheckpoint(root, checkpoint(campaign, 1, "2".repeat(64)));
    assert.equal(validButUnlinked.generation, 1);
    await assert.rejects(loadCampaignCheckpointChain(root, campaign), /invalid previousSha256 link/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("completed and active cells are exact, in-plan, nonduplicated, and finished means complete", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "campaign-store-"));
  try {
    const campaign = manifest();
    const complete = { cellKey: campaign.plan[0]!.cellKey, runId: "run-safe", evaluation: "evaluations/run-safe.json", evaluationSha256: "3".repeat(64) };
    await writeCampaignCheckpoint(root, checkpoint(campaign, 0, null, { completed: [complete], state: "finished" }));
    assert.equal((await loadCampaignCheckpointChain(root, campaign)).latest?.state, "finished");

    const duplicateRoot = path.join(root, "duplicate");
    await writeCampaignCheckpoint(duplicateRoot, checkpoint(campaign, 0, null, { completed: [complete, complete] }));
    await assert.rejects(loadCampaignCheckpointChain(duplicateRoot, campaign), /duplicate completed cell/u);

    const skippedRoot = path.join(root, "skipped");
    await writeCampaignCheckpoint(skippedRoot, checkpoint(campaign, 0, null, { completed: [{ ...complete, cellKey: campaign.plan[1]!.cellKey }] }));
    await assert.rejects(loadCampaignCheckpointChain(skippedRoot, campaign), /unknown or skipped/u);

    const unfinishedRoot = path.join(root, "unfinished");
    await writeCampaignCheckpoint(unfinishedRoot, checkpoint(campaign, 0, null, { state: "finished" }));
    await assert.rejects(loadCampaignCheckpointChain(unfinishedRoot, campaign), /does not cover every executable/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("paths cannot escape, interrupted staging is preserved, and projections replace atomically", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "campaign-store-"));
  try {
    assert.throws(() => containedPath(root, "../outside.json"), /aliased|escapes/u);
    assert.throws(() => containedPath(root, "C:\\outside.json"), /portable relative/u);
    assert.throws(() => containedPath(root, "nested/../runs.json"), /aliased segment/u);
    const staging = path.join(root, ".staging-run-safe");
    await mkdir(staging);
    const preserved = await preserveInterruptedStaging(root, staging, "run-safe");
    assert.equal(preserved, path.join(root, "interrupted", "run-safe"));
    await assert.rejects(preserveInterruptedStaging(root, path.dirname(root), "run-other"), /outside/u);
    const runsRoot = path.join(root, "all-runs");
    const externalStaging = path.join(runsRoot, ".staging-run-external");
    await mkdir(externalStaging, { recursive: true });
    assert.equal(await preserveInterruptedStaging(root, externalStaging, "run-external", runsRoot), path.join(root, "interrupted", "run-external"));
    const projection = await writeCampaignProjection(root, "runs.json", { generation: 0 });
    await writeCampaignProjection(root, "runs.json", { generation: 1 });
    assert.deepEqual(JSON.parse(await readFile(projection, "utf8")), { generation: 1 });
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("secret-bearing keys are refused at every persistence parser boundary", async () => {
  const campaign = manifest();
  assert.throws(() => parseCampaignManifest({ ...campaign, compatibility: { ...compatibility, token: "no" } }), /secret-bearing key token/u);
  assert.throws(() => parseCampaignManifest({ ...campaign, compatibility: { ...compatibility, apiKey: "no" } }), /secret-bearing key apiKey/u);
  const root = await mkdtemp(path.join(os.tmpdir(), "campaign-store-"));
  try { await assert.rejects(writeCampaignProjection(root, "runs.json", { nested: { authorization_password: "no" } }), /secret-bearing key authorization_password/u); }
  finally { await rm(root, { recursive: true, force: true }); }
});
