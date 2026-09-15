import assert from "node:assert/strict";
import test from "node:test";
import { campaignCellKey, type CampaignCellIdentity, type CampaignPlanCell } from "../identity.js";
import { assertExactCampaignShardCoverage, CAMPAIGN_SHARD_ALGORITHM, createCampaignPlanShards } from "../shard-plan.js";

function cell(group: string, lane: "recording" | "flow", repeatIndex: number, ordinal: number): CampaignPlanCell {
  const identity: CampaignCellIdentity = {
    corpusRowId: group,
    scenarioId: `scenario-${group.toLowerCase()}`,
    workflowId: null,
    variantId: null,
    lane,
    repeatIndex,
  };
  return { ...identity, ordinal, cellKey: campaignCellKey(identity), resolved: true, expectedFailure: null, skipReason: null };
}

function plan(): CampaignPlanCell[] {
  const cells: CampaignPlanCell[] = [];
  for (let repeatIndex = 0; repeatIndex < 3; repeatIndex += 1) {
    for (const [group, lane] of [["W01", "recording"], ["W01", "flow"], ["W02", "flow"], ["W03", "flow"], ["W04", "recording"]] as const) {
      cells.push(cell(group, lane, repeatIndex, cells.length));
    }
  }
  return cells;
}

test("result-round-robin-v1 is deterministic, balanced, and keeps every repeat together", () => {
  const full = plan();
  const first = createCampaignPlanShards(full, 3);
  const second = createCampaignPlanShards(full, 3);
  assert.deepEqual(second, first);
  assert.deepEqual(first.map(({ algorithm }) => algorithm), Array(3).fill(CAMPAIGN_SHARD_ALGORITHM));
  assert.deepEqual(first.map(({ plan: shard }) => shard.length), [6, 6, 3]);
  assert.deepEqual(first.map(({ plan: shard }) => shard.map(({ ordinal }) => ordinal)), [[0, 1, 2, 3, 4, 5], [0, 1, 2, 3, 4, 5], [0, 1, 2]]);
  for (const group of new Set(full.map((candidate) => JSON.stringify([candidate.corpusRowId, candidate.lane])))) {
    const owners = first.flatMap((shard) => shard.plan.some((candidate) => JSON.stringify([candidate.corpusRowId, candidate.lane]) === group) ? [shard.index] : []);
    assert.equal(owners.length, 1, `${group} must have exactly one owner`);
  }
  assertExactCampaignShardCoverage(full, first);
});

test("lane is result identity and cell keys survive local ordinal reindexing", () => {
  const full = plan();
  const shards = createCampaignPlanShards(full, 2);
  const recordingOwner = shards.find(({ plan: shard }) => shard.some((candidate) => candidate.corpusRowId === "W01" && candidate.lane === "recording"))?.index;
  const flowOwner = shards.find(({ plan: shard }) => shard.some((candidate) => candidate.corpusRowId === "W01" && candidate.lane === "flow"))?.index;
  assert.notEqual(recordingOwner, flowOwner, "adjacent recording and Flow result groups round-robin independently");
  assert.deepEqual(new Set(shards.flatMap(({ plan: shard }) => shard.map(({ cellKey }) => cellKey))), new Set(full.map(({ cellKey }) => cellKey)));
});

test("coverage validation rejects overlap, omission, foreign cells, split repeats, and noncanonical descriptors", () => {
  const full = plan();
  const shards = createCampaignPlanShards(full, 2);
  const [left, right] = shards;
  assert.ok(left && right);
  assert.throws(() => assertExactCampaignShardCoverage(full, [{
    ...left,
    plan: [...left.plan, { ...right.plan[0]!, ordinal: left.plan.length }],
  }, right]), /overlap/);
  assert.throws(() => assertExactCampaignShardCoverage(full, [{ ...left, plan: left.plan.slice(1).map((entry, ordinal) => ({ ...entry, ordinal })) }, right]), /cover/);
  const foreign = cell("W99", "flow", 0, left.plan.length);
  assert.throws(() => assertExactCampaignShardCoverage(full, [{ ...left, plan: [...left.plan, foreign] }, right]), /outside/);
  const moved = left.plan.find((candidate) => candidate.repeatIndex === 1)!;
  assert.throws(() => assertExactCampaignShardCoverage(full, [
    { ...left, plan: left.plan.filter(({ cellKey }) => cellKey !== moved.cellKey).map((entry, ordinal) => ({ ...entry, ordinal })) },
    { ...right, plan: [...right.plan, { ...moved, ordinal: right.plan.length }] },
  ]), /repeats span/);
  assert.throws(() => assertExactCampaignShardCoverage(full, [{ ...left, index: 1 }, right]), /canonical/);
  assert.throws(() => assertExactCampaignShardCoverage(full, [{ ...left, algorithm: "changed" as never }, right]), /canonical/);
  assert.throws(() => assertExactCampaignShardCoverage(full, [{
    ...left,
    plan: left.plan.map((entry, index) => index === 0 ? { ...entry, scenarioId: `${entry.scenarioId}-changed` } : entry),
  }, right]), /does not match/);
  assert.throws(() => assertExactCampaignShardCoverage(full, [left]), /between 2 and 8/);
});

test("invalid shard counts and malformed full plans fail before scheduling", () => {
  const full = plan();
  for (const count of [0, 1, 9, 2.5, Number.NaN]) assert.throws(() => createCampaignPlanShards(full, count), /between 2 and 8/);
  assert.throws(() => createCampaignPlanShards(full.slice(0, 3), 4), /cannot exceed/);
  assert.throws(() => createCampaignPlanShards(full.map((entry, index) => index === 1 ? { ...entry, ordinal: 7 } : entry), 2), /ordinals/);
  assert.throws(() => createCampaignPlanShards([...full, { ...full[0]!, ordinal: full.length }], 2), /duplicate/);
});
