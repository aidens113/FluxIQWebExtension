import { BENCH_ID_PATTERN } from "./report-store.js";

const RECEIPT_SCHEMA_VERSION = "0.1" as const;
const MAX_RECEIPT_BYTES = 8_192;
const MAX_ATTEMPT = 1_000_000;
const SAFE_ID = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,158}[A-Za-z0-9])?$/u;
const SHA256 = /^[0-9a-f]{64}$/u;
const FORBIDDEN_KEY = /(authorization|cookie|credential|environment|evidence|log|page|password|pin|secret|token|totp|url)/iu;

export type BenchReceiptCellIdentity = {
  corpusRowId: string;
  scenarioId: string;
  workflowId: string | null;
  variantId: string | null;
  lane: "recording" | "flow";
  repeatIndex: number;
};

/** The campaign-owned structural fields a scenario may persist in its bundle. */
export type BenchReceiptMetadata = {
  campaignId: string;
  planSha256: string;
  cellKey: string;
  cellIdentity: BenchReceiptCellIdentity;
  attempt: number;
};

/** A strict, non-secret link from one finalized bundle to one campaign attempt. */
export type BenchReceipt = BenchReceiptMetadata & {
  schemaVersion: typeof RECEIPT_SCHEMA_VERSION;
  runId: string;
};

export function assertSafeScenarioRunId(runId: string): void {
  if (!SAFE_ID.test(runId)) throw new Error("Scenario run id must be one safe path segment of 1-160 characters");
}

export function createBenchReceipt(metadata: BenchReceiptMetadata, runId: string): BenchReceipt {
  const receipt: BenchReceipt = { schemaVersion: RECEIPT_SCHEMA_VERSION, ...metadata, runId };
  assertBenchReceipt(receipt);
  return receipt;
}

export function parseBenchReceiptJson(text: string): BenchReceipt {
  if (Buffer.byteLength(text, "utf8") > MAX_RECEIPT_BYTES) throw new Error("Bench receipt exceeds its size limit");
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error("Bench receipt is not valid JSON"); }
  assertBenchReceipt(value);
  return value;
}

export function assertBenchReceipt(value: unknown): asserts value is BenchReceipt {
  rejectForbiddenKeys(value);
  const receipt = recordWithExactKeys(value, ["schemaVersion", "campaignId", "planSha256", "cellKey", "cellIdentity", "attempt", "runId"], "Bench receipt");
  if (receipt.schemaVersion !== RECEIPT_SCHEMA_VERSION) throw new Error("Bench receipt has an unsupported schema version");
  if (typeof receipt.campaignId !== "string" || !BENCH_ID_PATTERN.test(receipt.campaignId)) throw new Error("Bench receipt campaign id is invalid");
  if (typeof receipt.planSha256 !== "string" || !SHA256.test(receipt.planSha256)) throw new Error("Bench receipt plan hash is invalid");
  if (typeof receipt.cellKey !== "string" || !SHA256.test(receipt.cellKey)) throw new Error("Bench receipt cell key is invalid");
  if (!Number.isSafeInteger(receipt.attempt) || (receipt.attempt as number) < 1 || (receipt.attempt as number) > MAX_ATTEMPT) throw new Error("Bench receipt attempt is invalid");
  if (typeof receipt.runId !== "string") throw new Error("Bench receipt run id is invalid");
  assertSafeScenarioRunId(receipt.runId);
  assertCellIdentity(receipt.cellIdentity);
}

function assertCellIdentity(value: unknown): asserts value is BenchReceiptCellIdentity {
  const identity = recordWithExactKeys(value, ["corpusRowId", "scenarioId", "workflowId", "variantId", "lane", "repeatIndex"], "Bench receipt cell identity");
  boundedId(identity.corpusRowId, "corpus row id");
  boundedId(identity.scenarioId, "scenario id");
  nullableBoundedId(identity.workflowId, "workflow id");
  nullableBoundedId(identity.variantId, "variant id");
  if (identity.lane !== "recording" && identity.lane !== "flow") throw new Error("Bench receipt lane is invalid");
  if (!Number.isSafeInteger(identity.repeatIndex) || (identity.repeatIndex as number) < 0 || (identity.repeatIndex as number) > MAX_ATTEMPT) throw new Error("Bench receipt repeat index is invalid");
}

function boundedId(value: unknown, label: string): string {
  if (typeof value !== "string" || !SAFE_ID.test(value)) throw new Error(`Bench receipt ${label} is invalid`);
  return value;
}

function nullableBoundedId(value: unknown, label: string): void {
  if (value !== null) boundedId(value, label);
}

function recordWithExactKeys(value: unknown, keys: readonly string[], label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  const record = value as Record<string, unknown>;
  const actual = Object.keys(record).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) throw new Error(`${label} has unsupported or missing fields`);
  return record;
}

function rejectForbiddenKeys(value: unknown): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) { for (const item of value) rejectForbiddenKeys(item); return; }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_KEY.test(key)) throw new Error("Bench receipt contains a forbidden secret-bearing field");
    rejectForbiddenKeys(child);
  }
}
