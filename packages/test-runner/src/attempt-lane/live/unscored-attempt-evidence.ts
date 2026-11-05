import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { LiveAttemptEnded } from "./live-driver.js";
import { writePaidAttemptBundle } from "./paid-attempt-bundle.js";

/**
 * What a run keeps when something throws after its attempts ended: an attempt record for each
 * one that ended, marked as not scored and saying why, and for a paid run the bundle the spend
 * ledger reads its run id, verdict and spend from. `run-mw43h5ew-a04a583d` lost all three to a
 * dataset read that threw after a $0.54 attempt, and its ledger line had no run and no cost.
 *
 * Its picture and `answer-turn.json` are written as each attempt ends (`../live/live-driver.ts`
 * keeps that ending whatever its scoring throws), so they are already in the evidence folder.
 * An attempt record the run already wrote is left as it is: it is the whole one. The spend is
 * what Core recorded for the attempts that ended; with none ended there is no spend to stand
 * behind and no bundle is written, as before. Returns the line that says what was kept.
 */
export async function writeUnscoredAttemptEvidence(input: {
  evidence: string;
  attempts: number;
  kept: ReadonlyMap<number, { ended: LiveAttemptEnded; cache: unknown; modelCalls: Record<string, number> | null }>;
  error: unknown;
  recorded: boolean;
  paid?: { runsDirectory: string; runId: string; startedAt: string; plan: { maxTotalEstimatedCostUsd: number }; stepsDirectory: string };
}): Promise<string> {
  const ended = [...input.kept.entries()].sort(([left], [right]) => left - right).map(([, each]) => each);
  if (ended.length === 0) return "no attempt had ended, so there was no attempt to keep";
  const notScored = { name: input.error instanceof Error ? input.error.name : typeof input.error, ...categoryOf(input.error), message: input.error instanceof Error ? input.error.message : String(input.error) };
  const records = ended.map(({ ended: { ordinal, outcome, site }, cache, modelCalls }) => ({ ordinal, notScored, attempt: outcome.attempt, result: outcome.result ?? null, saved: outcome.saved ?? null, budgetUsd: outcome.attempt.budget.usd, cache, actsWithNoRow: outcome.attempt.actsWithNoRow ?? 0, modelCalls, site }));
  if (!input.recorded) {
    await writeFile(path.join(input.evidence, "attempt.json"), JSON.stringify(input.attempts === 1 && records.length === 1 ? records[0] : { notScored, attempts: records }, null, 2));
    await writeFile(path.join(input.evidence, "attempt-report.txt"), `${records.map(({ ordinal, attempt }) => `Attempt ${ordinal} ended ${attempt.status}${attempt.waitingFor ? ` for ${attempt.waitingFor}` : ""} and was not scored: ${notScored.message}`).join("\n")}\n`);
  }
  const spentUsd = records.reduce((sum, { attempt }) => sum + attempt.spend.usd, 0);
  if (input.paid) await writePaidAttemptBundle({ ...input.paid, verdict: "failed", spentUsd });
  return `${records.length} attempt(s) ended and were kept unscored${input.paid ? `, with $${spentUsd.toFixed(4)} spent in the ledger` : ""}`;
}

function categoryOf(error: unknown): { category?: string } {
  const category = error && typeof error === "object" ? (error as { category?: unknown }).category : undefined;
  return typeof category === "string" ? { category } : {};
}
