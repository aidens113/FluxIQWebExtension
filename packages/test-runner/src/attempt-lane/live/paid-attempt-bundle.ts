import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { attemptBalanceFailures } from "./balance-failures.js";

/**
 * What a paid attempt leaves for the spend ledger, in the files it reads a finished run
 * from (`scripts/lab/live-guards/run-outcomes.mjs`): its verdict, what its Core recorded
 * it spent, the ceiling it ran under, and an empty balance if it met one. A scripted run
 * never writes one, since it has nothing to ledger.
 */
export async function writePaidAttemptBundle(input: { runsDirectory: string; runId: string; startedAt: string; verdict: string; plan: { maxTotalEstimatedCostUsd: number }; spentUsd: number; stepsDirectory: string }): Promise<void> {
  const directory = path.join(input.runsDirectory, input.runId);
  await mkdir(path.join(directory, "snapshots"), { recursive: true });
  await writeFile(path.join(directory, "run.json"), JSON.stringify({ startedAt: input.startedAt, verdict: input.verdict }, null, 2));
  await writeFile(path.join(directory, "snapshots", "live-llm.json"), JSON.stringify({ authorized: { maxTotalEstimatedCostUsd: input.plan.maxTotalEstimatedCostUsd }, observed: { totalEstimatedCostUsd: input.spentUsd } }, null, 2));
  await writeFile(path.join(directory, "provider-failures.local.json"), JSON.stringify({ records: await attemptBalanceFailures(input.stepsDirectory) }, null, 2));
}
