import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { BenchPlanEntry } from "../../expand-corpus.js";
import { BENCH_SEMANTICS_VERSION, CAMPAIGN_SCHEMA_VERSION, campaignPlanSha256, createCampaignPlan, sha256Canonical, type CampaignCompatibility } from "../identity.js";
import {
  createCampaignShardGroup,
  loadCampaignShardGroup,
  loadCampaignShardMergeSeal,
  parseCampaignShardMergeSeal,
  shardChildCampaignId,
  writeCampaignShardMergeSeal,
  type CampaignShardProjectionDigest,
} from "../shard-group-store.js";
import { CAMPAIGN_SHARD_ALGORITHM } from "../shard-plan.js";
import type { CampaignManifest } from "../store.js";

const compatibility: CampaignCompatibility = {
  repositories: { facilityCommit: "1".repeat(40), coreCommit: "2".repeat(40) },
  lockfiles: { facilitySha256: "3".repeat(64), coreSha256: "4".repeat(64) },
  builds: { testRunnerSha256: "5".repeat(64), extensionSha256: "6".repeat(64), scenarioLabSha256: "7".repeat(64) },
  environment: { platform: "win32", architecture: "x64", browserName: "chromium", browserVersion: "Chrome/134", locale: "en-US", timezone: "UTC", viewport: { width: 1280, height: 720 } },
};
const entries: BenchPlanEntry[] = [
  { corpusRowId: "W01", scenarioId: "basic-form", workflowId: null, variantId: null, lane: "recording", resolved: true, expectedFailure: null },
  { corpusRowId: "W01", scenarioId: "basic-form", workflowId: null, variantId: null, lane: "flow", resolved: true, expectedFailure: null },
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
    execution: { mode: "shard-parent", algorithm: CAMPAIGN_SHARD_ALGORITHM, shardCount: 2, jobs: 1 },
  };
}

const digest = (digit: string): string => digit.repeat(64);
const projections = (children: readonly CampaignManifest[]): CampaignShardProjectionDigest[] => children.map((child, index) => ({
  index,
  campaignId: child.benchId,
  terminalCheckpointSha256: digest(String(index + 1)),
  runsSha256: digest(String(index + 3)),
  reportSha256: digest(String(index + 5)),
  markdownSha256: digest(String(index + 7)),
}));
const merged = { runsSha256: digest("a"), reportSha256: digest("b"), markdownSha256: digest("c") };

test("create-only parent and children round trip with exact deterministic authority and coverage", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-shard-group-"));
  try {
    const created = await createCampaignShardGroup(root, parent());
    assert.equal(created.children.length, 2);
    assert.deepEqual(created.parent.execution, { mode: "shard-parent", algorithm: CAMPAIGN_SHARD_ALGORITHM, shardCount: 2, jobs: 1 });
    assert.deepEqual(created.children.map(({ benchId }) => benchId), [shardChildCampaignId(created.parent.benchId, 0), shardChildCampaignId(created.parent.benchId, 1)]);
    for (const [index, child] of created.children.entries()) {
      assert.deepEqual(child.request, created.parent.request);
      assert.deepEqual(child.compatibility, created.parent.compatibility);
      assert.equal(child.benchSemanticsVersion, created.parent.benchSemanticsVersion);
      assert.deepEqual(child.execution, { mode: "shard-child", algorithm: CAMPAIGN_SHARD_ALGORITHM, parentCampaignId: created.parent.benchId, parentPlanSha256: created.parent.planSha256, shardIndex: index, shardCount: 2 });
    }
    assert.deepEqual(await loadCampaignShardGroup(root), created);
    await assert.rejects(createCampaignShardGroup(root, parent()), (error: NodeJS.ErrnoException) => error.code === "EEXIST");
    assert.throws(() => shardChildCampaignId("../escape", 0), /invalid/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("loading rejects unknown child paths and request, identity, plan, or coverage corruption", async (t) => {
  for (const kind of ["unknown-directory", "request", "identity", "coverage"] as const) await t.test(kind, async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-shard-corrupt-"));
    try {
      const group = await createCampaignShardGroup(root, parent());
      if (kind === "unknown-directory") await mkdir(path.join(root, "shards", "999"));
      else {
        const file = path.join(root, "shards", "000", "campaign.json");
        const child = JSON.parse(await readFile(file, "utf8")) as CampaignManifest;
        if (kind === "request") (child as { request: CampaignManifest["request"] }).request = { ...child.request, corpusId: "other" };
        if (kind === "identity" && child.execution.mode === "shard-child") (child as { execution: CampaignManifest["execution"] }).execution = { ...child.execution, shardIndex: 1 };
        if (kind === "coverage") {
          const plan = child.plan.slice(1).map((cell, ordinal) => ({ ...cell, ordinal }));
          (child as { plan: CampaignManifest["plan"] }).plan = plan;
          (child as { planSha256: string }).planSha256 = campaignPlanSha256(plan);
        }
        await writeFile(file, JSON.stringify(child));
      }
      await assert.rejects(loadCampaignShardGroup(root), /child|directory|partition|coverage|identity|authority/u);
      assert.equal(group.parent.benchId, parent().benchId);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});

test("merge seal authenticates parent, children, terminal state and projections and refuses secrets", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-shard-seal-"));
  try {
    const group = await createCampaignShardGroup(root, parent());
    const seal = await writeCampaignShardMergeSeal(root, group, projections(group.children), merged);
    assert.equal(seal.parentManifestSha256, sha256Canonical(group.parent));
    assert.deepEqual(await loadCampaignShardMergeSeal(root, group), seal);
    await assert.rejects(writeCampaignShardMergeSeal(root, group, projections(group.children), merged), (error: NodeJS.ErrnoException) => error.code === "EEXIST");
    await assert.rejects(writeCampaignShardMergeSeal(path.join(root, "other"), group, projections(group.children).map((item, index) => index === 0 ? { ...item, bearerToken: "secret" } as never : item), merged), /secret-bearing key/u);
    assert.throws(() => parseCampaignShardMergeSeal({ ...seal, unknown: true }), /unexpected or missing keys/u);
    assert.throws(() => parseCampaignShardMergeSeal({ ...seal, parentPlanSha256: digest("d") }), /digest does not match/u);
    await writeFile(path.join(root, "merge-seal.json"), JSON.stringify({ ...seal, children: seal.children.map((child, index) => index === 0 ? { ...child, runsSha256: digest("e") } : child) }));
    await assert.rejects(loadCampaignShardMergeSeal(root, group), /digest does not match/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});
