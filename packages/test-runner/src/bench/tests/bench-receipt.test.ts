import assert from "node:assert/strict";
import test from "node:test";
import { assertBenchReceipt, assertSafeScenarioRunId, createBenchReceipt, parseBenchReceiptJson, type BenchReceiptMetadata } from "../bench-receipt.js";

const hash = (digit: string) => digit.repeat(64);
const metadata: BenchReceiptMetadata = {
  campaignId: "bench-m123-ab12cd34",
  planSha256: hash("a"),
  cellKey: hash("b"),
  cellIdentity: { corpusRowId: "W10", scenarioId: "broken-link", workflowId: "primary", variantId: null, lane: "flow", repeatIndex: 2 },
  attempt: 1,
};

test("a receipt round trips with only its bounded structural campaign fields", () => {
  const receipt = createBenchReceipt(metadata, "run-bench-m123-w10-flow-r2-a1");
  assert.deepEqual(parseBenchReceiptJson(JSON.stringify(receipt)), receipt);
  assert.deepEqual(Object.keys(receipt).sort(), ["attempt", "campaignId", "cellIdentity", "cellKey", "planSha256", "runId", "schemaVersion"]);
  assert.deepEqual(Object.keys(receipt.cellIdentity).sort(), ["corpusRowId", "lane", "repeatIndex", "scenarioId", "variantId", "workflowId"]);
});

test("strict parsing refuses missing, extra, secret-bearing, and oversized receipt data", () => {
  const receipt = createBenchReceipt(metadata, "run-safe");
  const { attempt: _attempt, ...missing } = receipt;
  assert.throws(() => assertBenchReceipt(missing), /unsupported or missing fields/u);
  assert.throws(() => assertBenchReceipt({ ...receipt, note: "extra" }), /unsupported or missing fields/u);
  assert.throws(() => assertBenchReceipt({ ...receipt, authToken: "do-not-store" }), /forbidden secret-bearing field/u);
  assert.throws(() => assertBenchReceipt({ ...receipt, cellIdentity: { ...receipt.cellIdentity, pageUrl: "https://example.test/private" } }), /forbidden secret-bearing field/u);
  assert.throws(() => parseBenchReceiptJson(`{${" ".repeat(8_192)}}`), /size limit/u);
});

test("campaign, plan, cell, attempt, identity, and run bindings fail closed", () => {
  const receipt = createBenchReceipt(metadata, "run-safe");
  const invalid: unknown[] = [
    { ...receipt, campaignId: "campaign-elsewhere" },
    { ...receipt, planSha256: hash("G") },
    { ...receipt, cellKey: hash("c").slice(1) },
    { ...receipt, attempt: 0 },
    { ...receipt, runId: "../outside" },
    { ...receipt, cellIdentity: { ...receipt.cellIdentity, lane: "other" } },
    { ...receipt, cellIdentity: { ...receipt.cellIdentity, repeatIndex: -1 } },
    { ...receipt, cellIdentity: { ...receipt.cellIdentity, workflowId: "https://not-structural.test" } },
  ];
  for (const value of invalid) assert.throws(() => assertBenchReceipt(value));
});

test("optional deterministic run ids are safe direct child names", () => {
  for (const valid of ["run-a", "RUN_2.3", "x"]) assert.doesNotThrow(() => assertSafeScenarioRunId(valid));
  for (const invalid of ["", ".", "..", "-starts-dash", "ends-dash-", "a/b", "a\\b", "a b", "x".repeat(161)]) assert.throws(() => assertSafeScenarioRunId(invalid));
});
