// The machine-wide folder every Lab run files its evidence in. Mirrors
// `packages/test-runner/src/lab-runs/runs-root.ts`, which the runner owns:
// `FLUXIQ_LAB_RUNS_DIR` when absolute, else `~/FluxStuff/lab-runs`.

import os from "node:os";
import path from "node:path";

/** @param {NodeJS.ProcessEnv} [environment] */
export function labRunsRoot(environment = process.env) {
  const configured = environment.FLUXIQ_LAB_RUNS_DIR?.trim();
  return configured && path.isAbsolute(configured) ? configured : path.join(os.homedir(), "FluxStuff", "lab-runs");
}
