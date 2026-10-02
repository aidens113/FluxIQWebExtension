// The one question `run-lab.mjs` asks before anything else: may this live run
// start? Answered before Core is waited on, before anything is built and
// before any provider call, so a refusal costs nothing.
//
// Everything it reads is a file under `lab-slots/` or the source tree; every
// rule is in `rules/`. A read that fails throws, and the Lab refuses the run:
// a guard that cannot see its ledger does not guess.

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { isProcessAlive } from "../../build-cache/index.mjs";
import { evaluateLiveGuards } from "./evaluate-live-guards.mjs";
import { readDevAncestry } from "./dev-ancestry.mjs";
import { DEFAULT_LAB_SLOTS_DIRECTORY, guardFiles } from "./guard-files.mjs";
import { readLedger } from "./ledger.mjs";
import { describeLiveLaunch } from "./live-launch.mjs";
import { reconcileLedger } from "./reconcile-ledger.mjs";
import { RULE_NAMES } from "./rules/index.mjs";
import { sourceFingerprint } from "./source-fingerprint.mjs";

/** Where a run's debug file lives, relative to the tree the run is launched from. */
export const DEBUG_DIRECTORY = path.join("docs", "working", "language-driven-flow-loop-plan", "debugs");

/**
 * @param {{
 *   args: string[], env: NodeJS.ProcessEnv, repositoryRoot: string, coreRoot: string,
 *   slotsDirectory?: string, now?: number, isAlive?: (pid: number) => boolean,
 *   fingerprint?: (roots: string[]) => Promise<{ digest: string, files: number }>,
 *   devAncestry?: (root: string) => Promise<import("./dev-ancestry.mjs").DevAncestry>,
 * }} options
 * @returns {Promise<null | {
 *   launch: { instance: string, scenarioId: string, task: string, fingerprint: string, repositoryRoot: string, runsDirectory: string },
 *   files: ReturnType<typeof guardFiles>,
 *   refusals: import("./rules/guard-state.mjs").Refusal[],
 *   overridden: string[],
 * }>} null when the invocation makes no provider call and is not guarded
 */
export async function admitLiveRun(options) {
  const { args, env, repositoryRoot, coreRoot, slotsDirectory = DEFAULT_LAB_SLOTS_DIRECTORY, now = Date.now(), isAlive = isProcessAlive, fingerprint = sourceFingerprint, devAncestry = readDevAncestry } = options;
  const described = describeLiveLaunch(args, env);
  if (described === null) return null;
  const files = guardFiles(slotsDirectory);

  await reconcileLedger(files, { now, isAlive });
  const [entries, stopBalance, tree, repositoryAncestry, coreAncestry] = await Promise.all([
    readLedger(files.ledger), readStop(files.stopBalance), fingerprint([repositoryRoot, coreRoot]),
    devAncestry(repositoryRoot), devAncestry(coreRoot),
  ]);
  const debugPath = (runId) => path.join(repositoryRoot, DEBUG_DIRECTORY, `${runId}.md`);
  const overrides = new Set(RULE_NAMES.filter((rule) => existsSync(files.override(rule))));
  const { refusals, overridden } = evaluateLiveGuards({
    now, launch: described, stopBalance, entries, fingerprint: tree.digest,
    devAncestry: { repository: repositoryAncestry, core: coreAncestry },
    hasDebug: (runId) => existsSync(debugPath(runId)), debugPath, files,
  }, overrides);

  return {
    launch: { ...described, fingerprint: tree.digest, repositoryRoot, runsDirectory: runsDirectoryOf(env, repositoryRoot) },
    files, refusals, overridden,
  };
}

/** The runner's own rule (`packages/test-runner/src/lab-instance/resolve-lab-paths.ts`), restated. */
function runsDirectoryOf(env, root) {
  const declared = env.FLUXIQ_TEST_RUNS_DIR?.trim();
  if (declared) return path.resolve(declared);
  const instance = env.FLUXIQ_LAB_INSTANCE?.trim();
  return instance ? path.join(root, "test-runs", "instances", instance) : path.join(root, "test-runs");
}

async function readStop(file) {
  try {
    return await readFile(file, "utf8");
  } catch (error) {
    // No stop file is the normal state: live runs are not stopped.
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}
