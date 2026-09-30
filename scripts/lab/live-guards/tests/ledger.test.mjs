// The spend ledger: its arithmetic, and a read that fails closed.

import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { appendLedgerEntry, budgetWindowStart, readLedger, windowSpend } from "../index.mjs";

const finish = (at, totalEstimatedCostUsd) => ({ event: "finish", launchId: "l", at, runId: "run-a", instance: "i", task: "t", verdict: "failed", totalEstimatedCostUsd, balanceFailure: null, fingerprint: "f", exitCode: 1 });

test("window spend sums finishes from the window's start, exactly, and counts unknown costs without adding them", () => {
  const since = Date.parse("2026-09-30T00:00:00.000Z");
  const entries = [
    ...Array.from({ length: 10 }, () => finish("2026-09-30T01:00:00.000Z", 0.1)),
    finish("2026-09-30T00:00:00.000Z", 0.05),
    finish("2026-09-29T23:59:59.999Z", 3),
    finish("2026-09-30T02:00:00.000Z", null),
    { event: "start", launchId: "l2", at: "2026-09-30T03:00:00.000Z", instance: "i", task: "t" },
  ];
  assert.deepEqual(windowSpend(entries, since), { usd: 1.05, runs: 12, unknown: 1 });
  assert.deepEqual(windowSpend([], since), { usd: 0, runs: 0, unknown: 0 });
});

test("the day window starts at local midnight", () => {
  const noon = new Date(2026, 8, 30, 12, 30).getTime();
  assert.equal(budgetWindowStart("day", noon), new Date(2026, 8, 30, 0, 0, 0, 0).getTime());
  assert.throws(() => budgetWindowStart("week", noon), /unknown budget window/u);
});

test("entries append one line each and read back in order; an absent ledger is empty", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "live-guards-ledger-"));
  try {
    const file = path.join(directory, "nested", "spend-ledger.jsonl");
    assert.deepEqual(await readLedger(file), []);
    await appendLedgerEntry(file, finish("2026-09-30T01:00:00.000Z", 0.2));
    await appendLedgerEntry(file, finish("2026-09-30T02:00:00.000Z", 0.3));
    const entries = await readLedger(file);
    assert.deepEqual(entries.map((entry) => entry.totalEstimatedCostUsd), [0.2, 0.3]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("a corrupt ledger line fails the read instead of being skipped", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "live-guards-ledger-"));
  try {
    const file = path.join(directory, "spend-ledger.jsonl");
    await writeFile(file, `${JSON.stringify(finish("2026-09-30T01:00:00.000Z", 0.2))}\n{"event":"fin`, "utf8");
    await assert.rejects(readLedger(file), /line 2 is not JSON/u);
    await writeFile(file, `{"event":"other"}\n`, "utf8");
    await assert.rejects(readLedger(file), /line 1 is neither a start nor a finish/u);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
