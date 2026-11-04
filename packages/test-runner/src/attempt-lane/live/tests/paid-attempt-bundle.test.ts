import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { writePaidAttemptBundle } from "../index.js";

/** The ledger's own reader, by URL as `environment.ts` loads a root script, so this cannot drift from what the ledger reads. */
const OUTCOMES = new URL("../../../../../../scripts/lab/live-guards/run-outcomes.mjs", import.meta.url);
type Outcome = { runId: string; verdict: string | null; totalEstimatedCostUsd: number | null; buildCeilingUsd: number | null; balanceFailure: { code: string | null } | null };
const { readRunOutcomes } = await import(OUTCOMES.href) as { readRunOutcomes(directory: string, options: { sinceMs: number; knownRunIds: Set<string> }): Promise<Outcome[]> };

async function world(t: test.TestContext): Promise<{ runs: string; steps: string; runId: string; startedAt: string; now: number }> {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-paid-attempt-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const now = Date.now();
  return { runs: path.join(root, "runs"), steps: path.join(root, "steps"), runId: `run-${now.toString(36)}-0000abcd`, startedAt: new Date(now).toISOString(), now };
}

test("the ledger reads a paid attempt's verdict, spend and ceiling, with no balance failure", async (t) => {
  const { runs, steps, runId, startedAt, now } = await world(t);
  await writePaidAttemptBundle({ runsDirectory: runs, runId, startedAt, verdict: "passed", plan: { maxTotalEstimatedCostUsd: 5 }, spentUsd: 1.25, stepsDirectory: steps });
  const [read] = await readRunOutcomes(runs, { sinceMs: now, knownRunIds: new Set() });
  assert.equal(read?.runId, runId);
  assert.equal(read?.verdict, "passed");
  assert.equal(read?.totalEstimatedCostUsd, 1.25);
  assert.equal(read?.buildCeilingUsd, 5);
  assert.equal(read?.balanceFailure, null);
});

test("an empty balance in the step log reaches the ledger, so later live runs stop", async (t) => {
  const { runs, steps, runId, startedAt, now } = await world(t);
  await mkdir(path.join(steps, "0003-decide"), { recursive: true });
  await writeFile(path.join(steps, "0003-decide", "meta.json"), JSON.stringify({ finishedAt: startedAt, provider: "anthropic", model: "claude-sonnet-5-5", httpStatus: 400, status: "failed", error: { code: "llm.provider_balance_exhausted" } }));
  await mkdir(path.join(steps, "0004-still-writing"), { recursive: true });
  await writePaidAttemptBundle({ runsDirectory: runs, runId, startedAt, verdict: "failed", plan: { maxTotalEstimatedCostUsd: 5 }, spentUsd: 0.1, stepsDirectory: steps });
  const [read] = await readRunOutcomes(runs, { sinceMs: now, knownRunIds: new Set() });
  assert.equal(read?.balanceFailure?.code, "llm.provider_balance_exhausted");
});
