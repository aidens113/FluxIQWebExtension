import { campaignCellKey, canonicalJson, type CampaignPlanCell } from "./identity.js";

export const CAMPAIGN_SHARD_ALGORITHM = "result-round-robin-v1" as const;
export const MIN_CAMPAIGN_SHARDS = 2;
export const MAX_CAMPAIGN_SHARDS = 8;

export type CampaignPlanShard = Readonly<{
  algorithm: typeof CAMPAIGN_SHARD_ALGORITHM;
  index: number;
  plan: readonly CampaignPlanCell[];
}>;

/**
 * Partitions complete result groups in first-plan order. Every repeat of one
 * result stays in one shard, while child ordinals are local execution order.
 */
export function createCampaignPlanShards(plan: readonly CampaignPlanCell[], shardCount: number): CampaignPlanShard[] {
  if (!Number.isSafeInteger(shardCount) || shardCount < MIN_CAMPAIGN_SHARDS || shardCount > MAX_CAMPAIGN_SHARDS) {
    throw new Error(`shardCount must be between ${MIN_CAMPAIGN_SHARDS} and ${MAX_CAMPAIGN_SHARDS}`);
  }
  const seenCells = new Set<string>();
  const groups = new Map<string, CampaignPlanCell[]>();
  plan.forEach((cell, index) => {
    if (cell.ordinal !== index) throw new Error("Campaign plan ordinals must match full-plan order before sharding");
    if (seenCells.has(cell.cellKey)) throw new Error("Campaign plan contains a duplicate cell key");
    seenCells.add(cell.cellKey);
    const key = resultGroupKey(cell);
    const group = groups.get(key) ?? [];
    group.push(cell);
    groups.set(key, group);
  });
  if (groups.size < shardCount) throw new Error("shardCount cannot exceed the campaign result-group count");

  const assigned = Array.from({ length: shardCount }, (): CampaignPlanCell[] => []);
  [...groups.values()].forEach((group, groupIndex) => assigned[groupIndex % shardCount]!.push(...group));
  const shards = assigned.map((cells, index): CampaignPlanShard => ({
    algorithm: CAMPAIGN_SHARD_ALGORITHM,
    index,
    plan: cells.map((cell, ordinal) => ({ ...cell, ordinal })),
  }));
  assertExactCoverage(plan, shards);
  return shards;
}

/** Verifies disjoint full coverage without depending on child completion order. */
export function assertExactCampaignShardCoverage(fullPlan: readonly CampaignPlanCell[], shards: readonly CampaignPlanShard[]): void {
  assertExactCoverage(fullPlan, shards);
}

function assertExactCoverage(fullPlan: readonly CampaignPlanCell[], shards: readonly CampaignPlanShard[]): void {
  if (shards.length < MIN_CAMPAIGN_SHARDS || shards.length > MAX_CAMPAIGN_SHARDS) {
    throw new Error(`Campaign shard count must be between ${MIN_CAMPAIGN_SHARDS} and ${MAX_CAMPAIGN_SHARDS}`);
  }
  const expected = new Map(fullPlan.map((cell, ordinal) => {
    if (cell.ordinal !== ordinal) throw new Error("Full campaign plan ordinals must match full-plan order");
    if (cell.cellKey !== campaignCellKey(cell)) throw new Error("Full campaign cell key does not match its identity");
    return [cell.cellKey, cell] as const;
  }));
  if (expected.size !== fullPlan.length) throw new Error("Full campaign plan contains duplicate cell keys");
  const observed = new Set<string>();
  for (const [expectedIndex, shard] of shards.entries()) {
    if (shard.algorithm !== CAMPAIGN_SHARD_ALGORITHM || shard.index !== expectedIndex) throw new Error("Campaign shard descriptor is not canonical");
    for (const [ordinal, cell] of shard.plan.entries()) {
      if (cell.ordinal !== ordinal) throw new Error("Campaign shard ordinals must be local and contiguous");
      const fullCell = expected.get(cell.cellKey);
      if (fullCell === undefined) throw new Error("Campaign shard contains a cell outside the full plan");
      if (cell.cellKey !== campaignCellKey(cell)) throw new Error("Campaign shard cell key does not match its identity");
      if (observed.has(cell.cellKey)) throw new Error("Campaign shards overlap");
      if (canonicalJson(cell) !== canonicalJson({ ...fullCell, ordinal })) {
        throw new Error("Campaign shard cell does not match its full-plan cell");
      }
      observed.add(cell.cellKey);
    }
  }
  if (observed.size !== expected.size) throw new Error("Campaign shards do not cover the full plan");

  const resultOwners = new Map<string, number>();
  for (const shard of shards) for (const cell of shard.plan) {
    const key = resultGroupKey(cell);
    const owner = resultOwners.get(key);
    if (owner !== undefined && owner !== shard.index) throw new Error("Campaign result repeats span more than one shard");
    resultOwners.set(key, shard.index);
  }
}

function resultGroupKey(cell: CampaignPlanCell): string {
  return JSON.stringify([cell.corpusRowId, cell.scenarioId, cell.workflowId, cell.variantId, cell.lane]);
}
