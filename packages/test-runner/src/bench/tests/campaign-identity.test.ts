import assert from "node:assert/strict";
import test from "node:test";
import { assertCampaignCompatibility, campaignCellIdentity, campaignCellKey, campaignPlanSha256, canonicalJson, createCampaignPlan, type CampaignCompatibility } from "../campaign/index.js";
import type { BenchPlanEntry } from "../expand-corpus.js";

const entry = (lane: "recording" | "flow" = "recording"): BenchPlanEntry => ({
  corpusRowId: "W01", scenarioId: "basic-form", workflowId: null, variantId: null,
  lane, resolved: true, expectedFailure: null,
});

const compatibility = (browserVersion = "Chrome/134"): CampaignCompatibility => ({
  repositories: { facilityCommit: "a".repeat(40), coreCommit: "b".repeat(40) },
  lockfiles: { facilitySha256: "c".repeat(64), coreSha256: "d".repeat(64) },
  builds: { testRunnerSha256: "e".repeat(64), extensionSha256: "f".repeat(64), scenarioLabSha256: "0".repeat(64) },
  environment: { platform: "win32", architecture: "x64", browserName: "chromium", browserVersion, locale: "en-US", timezone: "America/Los_Angeles", viewport: { width: 1280, height: 720 } },
});

test("canonical JSON and plan hashes are independent of object insertion order", () => {
  assert.equal(canonicalJson({ z: 1, a: { d: 2, b: 3 } }), '{"a":{"b":3,"d":2},"z":1}');
  assert.equal(campaignPlanSha256([{ b: 2, a: 1 } as never]), campaignPlanSha256([{ a: 1, b: 2 } as never]));
  assert.throws(() => canonicalJson({ missing: undefined }), /undefined/u);
  assert.throws(() => canonicalJson(Number.NaN), /non-finite/u);
});

test("cell keys include lane and repeat index and a created plan is unique in repeat-major order", () => {
  const recording0 = campaignCellIdentity(entry(), 0);
  const flow0 = campaignCellIdentity(entry("flow"), 0);
  const recording1 = campaignCellIdentity(entry(), 1);
  assert.equal(new Set([campaignCellKey(recording0), campaignCellKey(flow0), campaignCellKey(recording1)]).size, 3);
  const plan = createCampaignPlan([entry(), entry("flow")], 2);
  assert.deepEqual(plan.map(({ ordinal, lane, repeatIndex }) => [ordinal, lane, repeatIndex]), [[0, "recording", 0], [1, "flow", 0], [2, "recording", 1], [3, "flow", 1]]);
  assert.equal(new Set(plan.map(({ cellKey }) => cellKey)).size, 4);
});

test("duplicate identities and invalid repeats fail before persistence", () => {
  assert.throws(() => createCampaignPlan([entry(), entry()], 1), /duplicate cell identities/u);
  assert.throws(() => createCampaignPlan([entry()], 0), /positive safe integer/u);
  assert.throws(() => campaignCellIdentity(entry(), -1), /non-negative safe integer/u);
});

test("compatibility comparison is exact across stable fields", () => {
  assert.doesNotThrow(() => assertCampaignCompatibility(compatibility(), compatibility()));
  assert.throws(() => assertCampaignCompatibility(compatibility(), compatibility("Chrome/135")), /does not match/u);
  assert.throws(() => assertCampaignCompatibility(compatibility(), { ...compatibility(), environment: { ...compatibility().environment, locale: "fr-FR" } }), /does not match/u);
});
