import { createHash } from "node:crypto";
import type { BenchPlanEntry } from "../expand-corpus.js";

export const CAMPAIGN_SCHEMA_VERSION = "0.2" as const;
export const BENCH_SEMANTICS_VERSION = "0.2" as const;
const SHA256 = /^[0-9a-f]{64}$/u;

export type CampaignCellIdentity = Readonly<{
  corpusRowId: string;
  scenarioId: string;
  workflowId: string | null;
  variantId: string | null;
  lane: BenchPlanEntry["lane"];
  repeatIndex: number;
}>;

export type CampaignPlanCell = Readonly<CampaignCellIdentity & {
  ordinal: number;
  cellKey: string;
  resolved: boolean;
  expectedFailure: BenchPlanEntry["expectedFailure"];
  skipReason: string | null;
}>;

export type CampaignRequest = Readonly<{
  corpusId: string;
  repeatCount: number;
  target: Readonly<{ mode: "isolated" | "persistent-isolated"; workspace: string | null }>;
  evidence: "none" | "failure" | "checkpoints" | "events" | null;
}>;

export type CampaignCompatibility = Readonly<{
  repositories: Readonly<{ facilityCommit: string; coreCommit: string }>;
  lockfiles: Readonly<{ facilitySha256: string; coreSha256: string }>;
  builds: Readonly<{ testRunnerSha256: string; extensionSha256: string; scenarioLabSha256: string }>;
  environment: Readonly<{
    platform: string;
    architecture: string;
    browserName: string;
    browserVersion: string;
    locale: string;
    timezone: string;
    viewport: Readonly<{ width: number; height: number }>;
  }>;
}>;

/** Canonical JSON with lexicographically ordered object keys. Undefined and non-JSON values are refused. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalValue(value));
}

export function sha256Canonical(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

export function campaignCellIdentity(entry: BenchPlanEntry, repeatIndex: number): CampaignCellIdentity {
  requireNonNegativeInteger(repeatIndex, "repeatIndex");
  return {
    corpusRowId: requireIdentifier(entry.corpusRowId, "corpusRowId"),
    scenarioId: requireIdentifier(entry.scenarioId, "scenarioId"),
    workflowId: nullableIdentifier(entry.workflowId, "workflowId"),
    variantId: nullableIdentifier(entry.variantId, "variantId"),
    lane: entry.lane,
    repeatIndex,
  };
}

/** Digest of the exact six-field identity; lane and repeat are intentionally identity-bearing. */
export function campaignCellKey(identity: CampaignCellIdentity): string {
  return sha256Canonical([identity.corpusRowId, identity.scenarioId, identity.workflowId, identity.variantId, identity.lane, identity.repeatIndex]);
}

/** Expands entries in execution order: one complete plan pass per repeat. */
export function createCampaignPlan(entries: readonly BenchPlanEntry[], repeatCount: number): CampaignPlanCell[] {
  requirePositiveInteger(repeatCount, "repeatCount");
  const cells: CampaignPlanCell[] = [];
  for (let repeatIndex = 0; repeatIndex < repeatCount; repeatIndex += 1) {
    for (const entry of entries) {
      const identity = campaignCellIdentity(entry, repeatIndex);
      cells.push({
        ...identity,
        ordinal: cells.length,
        cellKey: campaignCellKey(identity),
        resolved: entry.resolved,
        expectedFailure: entry.expectedFailure,
        skipReason: entry.skipReason ?? null,
      });
    }
  }
  if (new Set(cells.map(({ cellKey }) => cellKey)).size !== cells.length) throw new Error("Campaign plan contains duplicate cell identities");
  return cells;
}

export function campaignPlanSha256(plan: readonly CampaignPlanCell[]): string {
  return sha256Canonical(plan);
}

export function assertCampaignCompatibility(saved: CampaignCompatibility, current: CampaignCompatibility): void {
  const savedCanonical = canonicalJson(saved);
  const currentCanonical = canonicalJson(current);
  if (savedCanonical !== currentCanonical) throw new Error("Campaign compatibility does not match the current repositories, builds, browser, or stable environment");
}

export function isSha256(value: unknown): value is string { return typeof value === "string" && SHA256.test(value); }

function canonicalValue(value: unknown): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Canonical JSON refuses non-finite numbers");
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => canonicalValue(item));
  if (typeof value !== "object") throw new Error(`Canonical JSON refuses ${typeof value}`);
  const object = value as Record<string, unknown>;
  return Object.fromEntries(Object.keys(object).sort().map((key) => {
    if (object[key] === undefined) throw new Error(`Canonical JSON refuses undefined at ${key}`);
    return [key, canonicalValue(object[key])];
  }));
}

function requireIdentifier(value: unknown, name: string): string {
  if (typeof value !== "string" || value.length < 1 || value.length > 200) throw new Error(`${name} must be a non-empty bounded string`);
  return value;
}

function nullableIdentifier(value: unknown, name: string): string | null { return value === null ? null : requireIdentifier(value, name); }
function requireNonNegativeInteger(value: number, name: string): void { if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${name} must be a non-negative safe integer`); }
function requirePositiveInteger(value: number, name: string): void { if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${name} must be a positive safe integer`); }
