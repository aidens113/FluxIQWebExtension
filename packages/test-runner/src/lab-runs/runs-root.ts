import os from "node:os";
import path from "node:path";

/**
 * The one machine-wide folder every live Lab run is filed under:
 * `FLUXIQ_LAB_RUNS_DIR` when it is an absolute path, else `~/FluxStuff/lab-runs`
 * (`C:/Users/osrs_/FluxStuff/lab-runs` on the machine the Lab runs on), beside
 * `lab-slots/` as `scripts/lab/live-guards/guard-files.mjs` places it. Every
 * checkout and worktree files into the same folder, so four lanes' runs are
 * read in one place.
 */
export function labRunsRoot(environment: NodeJS.ProcessEnv = process.env): string {
  const configured = environment.FLUXIQ_LAB_RUNS_DIR?.trim();
  return configured && path.isAbsolute(configured) ? configured : path.join(os.homedir(), "FluxStuff", "lab-runs");
}
