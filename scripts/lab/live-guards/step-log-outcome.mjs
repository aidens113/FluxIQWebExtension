// What a killed run paid the provider, read from its step log.
//
// A run's bundle, `snapshots/live-llm.json` and `provider-failures.local.json`
// exist only once `finalize` renames its staging directory, so a run killed
// before then left nothing the ledger read, and was recorded with no run and
// no cost (`run-muq0in9r-0793b448` cause 3: lane B's killed run had made
// provider calls). The run's step log is the record that survives: the
// runner opens `lab-runs/<local date>/<runId>/steps/` before Core starts
// (`packages/test-runner/src/lab-runs/lab-run-record.ts`), and Core writes one
// folder per model and tool step there, `meta.json` last, naming the provider,
// the HTTP status, any error code and what the call cost.
//
// Counted the way `packages/test-runner/src/live-llm/step-log-spend.ts`
// counts: a complete `meta.json` that names a provider is one call. A call in
// flight when the run was killed has no meta yet and is not counted, so the
// figure is what the log proves was spent, not an upper bound.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { detectBalanceFailure } from "./balance-failure.mjs";

const STEP_FOLDER = /^\d{4,}-/u;

/**
 * @param {string} labRunsDirectory the machine-wide `lab-runs/` folder
 * @param {string} runId
 * @returns {Promise<{ calls: number, totalEstimatedCostUsd: number, balanceFailure: ReturnType<typeof detectBalanceFailure> } | null>}
 *   null when the run has no step log at all, so its cost stays unknown
 */
export async function readStepLogOutcome(labRunsDirectory, runId) {
  const steps = await findSteps(labRunsDirectory, runId);
  if (steps === null) return null;
  let calls = 0;
  let micros = 0;
  const failures = [];
  for (const name of steps.names) {
    const meta = await readMeta(path.join(steps.directory, name, "meta.json"));
    if (meta === null || typeof meta.provider !== "string" || meta.provider.length === 0) continue;
    calls += 1;
    if (typeof meta.costUsd === "number" && Number.isFinite(meta.costUsd) && meta.costUsd >= 0) micros += meta.costUsd * 1e9;
    if (meta.status !== "ok" || meta.error !== null) {
      failures.push({
        at: typeof meta.finishedAt === "string" ? meta.finishedAt : null,
        provider: { provider: meta.provider, model: meta.model ?? null, httpStatus: typeof meta.httpStatus === "number" ? meta.httpStatus : null, code: typeof meta.error?.code === "string" ? meta.error.code : null, body: meta.error ?? null },
      });
    }
  }
  return { calls, totalEstimatedCostUsd: Math.round(micros) / 1e9, balanceFailure: detectBalanceFailure({ records: failures }) };
}

/** The run's `steps/` under whichever date folder holds it, and its step folders in order. */
async function findSteps(labRunsDirectory, runId) {
  let dates;
  try {
    dates = (await readdir(labRunsDirectory, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort().reverse();
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
  for (const date of dates) {
    const directory = path.join(labRunsDirectory, date, runId, "steps");
    try {
      const names = (await readdir(directory, { withFileTypes: true })).filter((entry) => entry.isDirectory() && STEP_FOLDER.test(entry.name)).map((entry) => entry.name).sort();
      return { directory, names };
    } catch (error) {
      if (error?.code !== "ENOENT" && error?.code !== "ENOTDIR") throw error;
    }
  }
  return null;
}

async function readMeta(file) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    // No meta yet, or one cut short by the kill: a step still being written, as Core treats it.
    if (error?.code === "ENOENT" || error instanceof SyntaxError) return null;
    throw error;
  }
}
