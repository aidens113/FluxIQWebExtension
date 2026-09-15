import { mkdir, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { createDurableJson } from "../durable-file.js";
import { BENCH_SEMANTICS_VERSION, CAMPAIGN_SCHEMA_VERSION, campaignPlanSha256, canonicalJson, isSha256, sha256Canonical } from "./identity.js";
import { containedPath, loadCampaignManifest, parseCampaignManifest, refuseCampaignSecretKeys, writeCampaignManifest, type CampaignManifest } from "./store.js";
import { assertExactCampaignShardCoverage, CAMPAIGN_SHARD_ALGORITHM, createCampaignPlanShards } from "./shard-plan.js";

const SHARD_GROUP_SEAL_SCHEMA_VERSION = "0.1" as const;
const CHILD_DIRECTORY = /^\d{3}$/u;

export type CampaignShardGroup = Readonly<{ parent: CampaignManifest; children: readonly CampaignManifest[] }>;

export type CampaignShardProjectionDigest = Readonly<{
  index: number;
  campaignId: string;
  terminalCheckpointSha256: string;
  runsSha256: string;
  reportSha256: string;
  markdownSha256: string;
}>;

export type CampaignShardMergeSeal = Readonly<{
  schemaVersion: typeof SHARD_GROUP_SEAL_SCHEMA_VERSION;
  parentCampaignId: string;
  parentPlanSha256: string;
  parentManifestSha256: string;
  children: readonly Readonly<CampaignShardProjectionDigest & { planSha256: string; manifestSha256: string }>[];
  merged: Readonly<{ runsSha256: string; reportSha256: string; markdownSha256: string }>;
  sealSha256: string;
}>;

/** Deterministic, file-safe child identity derived only from parent identity and shard index. */
export function shardChildCampaignId(parentCampaignId: string, shardIndex: number): string {
  if (!/^bench-[a-z0-9]+-[0-9a-f]{8}$/u.test(parentCampaignId)) throw new Error("Parent campaign id is invalid");
  if (!Number.isSafeInteger(shardIndex) || shardIndex < 0 || shardIndex > 7) throw new Error("Shard index is invalid");
  return `bench-shard${shardIndex}-${sha256Canonical([parentCampaignId, shardIndex]).slice(0, 8)}`;
}

/** Validates the full authority graph before creating any parent or child manifest. */
export async function createCampaignShardGroup(directory: string, parentInput: CampaignManifest): Promise<CampaignShardGroup> {
  const parent = parseCampaignManifest(parentInput);
  if (parent.execution.mode !== "shard-parent") throw new Error("Shard group parent must use shard-parent execution identity");
  const shards = createCampaignPlanShards(parent.plan, parent.execution.shardCount);
  const children = shards.map((shard): CampaignManifest => parseCampaignManifest({
    schemaVersion: CAMPAIGN_SCHEMA_VERSION,
    benchId: shardChildCampaignId(parent.benchId, shard.index),
    createdAt: parent.createdAt,
    benchSemanticsVersion: BENCH_SEMANTICS_VERSION,
    request: parent.request,
    plan: shard.plan,
    planSha256: campaignPlanSha256(shard.plan),
    compatibility: parent.compatibility,
    execution: { mode: "shard-child", algorithm: CAMPAIGN_SHARD_ALGORITHM, parentCampaignId: parent.benchId, parentPlanSha256: parent.planSha256, shardIndex: shard.index, shardCount: shards.length },
  }));
  assertCampaignShardGroup({ parent, children });
  await writeCampaignManifest(directory, parent);
  for (const [index, child] of children.entries()) await writeCampaignManifest(childDirectory(directory, index), child);
  return { parent, children };
}

/** Loads only the exact canonical child directory set, then re-proves the authority graph. */
export async function loadCampaignShardGroup(directory: string): Promise<CampaignShardGroup> {
  const parent = await loadCampaignManifest(directory);
  if (parent.execution.mode !== "shard-parent") throw new Error("Shard group parent must use shard-parent execution identity");
  const shardsDirectory = containedPath(directory, "shards");
  const names = (await readdir(shardsDirectory)).sort();
  const expected = Array.from({ length: parent.execution.shardCount }, (_, index) => shardDirectoryName(index));
  if (canonicalJson(names) !== canonicalJson(expected) || names.some((name) => !CHILD_DIRECTORY.test(name))) throw new Error("Shard group child directory set is not exact");
  const children = await Promise.all(expected.map((_, index) => loadCampaignManifest(childDirectory(directory, index))));
  const group = { parent, children };
  assertCampaignShardGroup(group);
  return group;
}

/** Create-only authenticated seal for terminal children and merged projections. */
export async function writeCampaignShardMergeSeal(
  directory: string,
  group: CampaignShardGroup,
  projections: readonly CampaignShardProjectionDigest[],
  merged: CampaignShardMergeSeal["merged"],
): Promise<CampaignShardMergeSeal> {
  assertCampaignShardGroup(group);
  refuseCampaignSecretKeys({ projections, merged });
  if (projections.length !== group.children.length) throw new Error("Merge seal must cover every child exactly once");
  const children = projections.map((projection, index) => {
    const child = group.children[index];
    if (!child || projection.index !== index || projection.campaignId !== child.benchId) throw new Error("Merge seal child identity is not canonical");
    return {
      ...validatedProjection(projection),
      planSha256: child.planSha256,
      manifestSha256: sha256Canonical(child),
    };
  });
  const unsigned = {
    schemaVersion: SHARD_GROUP_SEAL_SCHEMA_VERSION,
    parentCampaignId: group.parent.benchId,
    parentPlanSha256: group.parent.planSha256,
    parentManifestSha256: sha256Canonical(group.parent),
    children,
    merged: validatedMerged(merged),
  };
  const seal = parseCampaignShardMergeSeal({ ...unsigned, sealSha256: sha256Canonical(unsigned) });
  await mkdir(path.resolve(directory), { recursive: true });
  await createDurableJson(containedPath(directory, "merge-seal.json"), seal);
  return seal;
}

export async function loadCampaignShardMergeSeal(directory: string, group: CampaignShardGroup): Promise<CampaignShardMergeSeal> {
  const seal = parseCampaignShardMergeSeal(JSON.parse(await readFile(containedPath(directory, "merge-seal.json"), "utf8")));
  assertCampaignShardGroup(group);
  if (seal.parentCampaignId !== group.parent.benchId || seal.parentPlanSha256 !== group.parent.planSha256 || seal.parentManifestSha256 !== sha256Canonical(group.parent)) throw new Error("Merge seal parent authority does not match");
  if (seal.children.length !== group.children.length || seal.children.some((child, index) => child.index !== index || child.campaignId !== group.children[index]?.benchId || child.planSha256 !== group.children[index]?.planSha256 || child.manifestSha256 !== sha256Canonical(group.children[index]))) throw new Error("Merge seal child authority does not match");
  return seal;
}

export function parseCampaignShardMergeSeal(input: unknown): CampaignShardMergeSeal {
  refuseCampaignSecretKeys(input);
  const value = exactObject(input, ["schemaVersion", "parentCampaignId", "parentPlanSha256", "parentManifestSha256", "children", "merged", "sealSha256"], "merge seal");
  if (value.schemaVersion !== SHARD_GROUP_SEAL_SCHEMA_VERSION) throw new Error("Merge seal schema version is invalid");
  if (!Array.isArray(value.children)) throw new Error("Merge seal children must be an array");
  const children = value.children.map((child, index) => {
    const object = exactObject(child, ["index", "campaignId", "terminalCheckpointSha256", "runsSha256", "reportSha256", "markdownSha256", "planSha256", "manifestSha256"], `merge seal child ${index}`);
    if (object.index !== index) throw new Error("Merge seal child indices must be exact and ordered");
    return { ...validatedProjection(object as unknown as CampaignShardProjectionDigest), planSha256: digest(object.planSha256, "planSha256"), manifestSha256: digest(object.manifestSha256, "manifestSha256") };
  });
  const unsigned = {
    schemaVersion: SHARD_GROUP_SEAL_SCHEMA_VERSION,
    parentCampaignId: campaignId(value.parentCampaignId),
    parentPlanSha256: digest(value.parentPlanSha256, "parentPlanSha256"),
    parentManifestSha256: digest(value.parentManifestSha256, "parentManifestSha256"),
    children,
    merged: validatedMerged(value.merged),
  };
  const sealSha256 = digest(value.sealSha256, "sealSha256");
  if (sha256Canonical(unsigned) !== sealSha256) throw new Error("Merge seal digest does not match its content");
  return { ...unsigned, sealSha256 };
}

function assertCampaignShardGroup(group: CampaignShardGroup): void {
  const { parent, children } = group;
  if (parent.execution.mode !== "shard-parent" || parent.execution.algorithm !== CAMPAIGN_SHARD_ALGORITHM || children.length !== parent.execution.shardCount) throw new Error("Shard group parent identity is inconsistent");
  const shards = createCampaignPlanShards(parent.plan, parent.execution.shardCount);
  for (const [index, child] of children.entries()) {
    const expected = shards[index];
    if (!expected || child.benchId !== shardChildCampaignId(parent.benchId, index) || child.createdAt !== parent.createdAt || child.benchSemanticsVersion !== parent.benchSemanticsVersion || canonicalJson(child.request) !== canonicalJson(parent.request) || canonicalJson(child.compatibility) !== canonicalJson(parent.compatibility)) throw new Error("Shard child does not inherit exact parent authority");
    if (child.execution.mode !== "shard-child" || child.execution.algorithm !== CAMPAIGN_SHARD_ALGORITHM || child.execution.parentCampaignId !== parent.benchId || child.execution.parentPlanSha256 !== parent.planSha256 || child.execution.shardIndex !== index || child.execution.shardCount !== children.length) throw new Error("Shard child execution identity is inconsistent");
    if (child.planSha256 !== campaignPlanSha256(child.plan) || canonicalJson(child.plan) !== canonicalJson(expected.plan)) throw new Error("Shard child plan does not match the deterministic partition");
  }
  assertExactCampaignShardCoverage(parent.plan, children.map((child, index) => ({ algorithm: CAMPAIGN_SHARD_ALGORITHM, index, plan: child.plan })));
}

function validatedProjection(input: CampaignShardProjectionDigest): CampaignShardProjectionDigest {
  return { index: nonNegativeInteger(input.index, "index"), campaignId: campaignId(input.campaignId), terminalCheckpointSha256: digest(input.terminalCheckpointSha256, "terminalCheckpointSha256"), runsSha256: digest(input.runsSha256, "runsSha256"), reportSha256: digest(input.reportSha256, "reportSha256"), markdownSha256: digest(input.markdownSha256, "markdownSha256") };
}
function validatedMerged(input: unknown): CampaignShardMergeSeal["merged"] { const value = exactObject(input, ["runsSha256", "reportSha256", "markdownSha256"], "merged projections"); return { runsSha256: digest(value.runsSha256, "runsSha256"), reportSha256: digest(value.reportSha256, "reportSha256"), markdownSha256: digest(value.markdownSha256, "markdownSha256") }; }
function childDirectory(directory: string, index: number): string { return containedPath(directory, `shards/${shardDirectoryName(index)}`); }
function shardDirectoryName(index: number): string { return nonNegativeInteger(index, "shard index").toString().padStart(3, "0"); }
function campaignId(value: unknown): string { if (typeof value !== "string" || !/^bench-[a-z0-9]+-[0-9a-f]{8}$/u.test(value)) throw new Error("Campaign id is invalid"); return value; }
function digest(value: unknown, label: string): string { if (!isSha256(value)) throw new Error(`${label} must be a SHA-256 digest`); return value; }
function nonNegativeInteger(value: unknown, label: string): number { if (!Number.isSafeInteger(value) || (value as number) < 0) throw new Error(`${label} must be a non-negative integer`); return value as number; }
function exactObject(value: unknown, keys: readonly string[], label: string): Record<string, unknown> { if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`${label} must be an object`); const object = value as Record<string, unknown>; const actual = Object.keys(object).sort(); const expected = [...keys].sort(); if (canonicalJson(actual) !== canonicalJson(expected)) throw new Error(`${label} has unexpected or missing keys`); return object; }
