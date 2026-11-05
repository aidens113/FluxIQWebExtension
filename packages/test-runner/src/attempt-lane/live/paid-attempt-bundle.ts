import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/** What a failed step of Core's log says of itself, as the ledger reads a provider failure. */
type ProviderFailureRecord = { at: string | null; provider: { provider: unknown; model: unknown; httpStatus: unknown; code: string; body: unknown } };

type StepMeta = { finishedAt?: string; provider?: unknown; model?: unknown; httpStatus?: unknown; error?: { code?: unknown } | null };

const BALANCE_CODE = "llm.provider_balance_exhausted";

/** A run that logged no step has no folder of them, and met no provider. */
async function stepNames(stepsDirectory: string): Promise<string[]> {
  try {
    return await readdir(stepsDirectory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

/** A step folder holds its `meta.json` once it is complete, and a step still being written has nothing to say. */
async function stepMeta(file: string): Promise<StepMeta | undefined> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as StepMeta;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

/**
 * The steps of the run's log that met an empty balance. An attempt's ending says only
 * `budget_out` for one, so the log is the one place that tells it from a spent purse, and
 * every later live run must stop on it.
 */
async function balanceFailures(stepsDirectory: string): Promise<ProviderFailureRecord[]> {
  const failures: ProviderFailureRecord[] = [];
  for (const name of (await stepNames(stepsDirectory)).sort()) {
    const meta = await stepMeta(path.join(stepsDirectory, name, "meta.json"));
    if (meta?.error?.code === BALANCE_CODE) failures.push({ at: meta.finishedAt ?? null, provider: { provider: meta.provider, model: meta.model, httpStatus: meta.httpStatus, code: BALANCE_CODE, body: meta.error } });
  }
  return failures;
}

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
  await writeFile(path.join(directory, "provider-failures.local.json"), JSON.stringify({ records: await balanceFailures(input.stepsDirectory) }, null, 2));
}
