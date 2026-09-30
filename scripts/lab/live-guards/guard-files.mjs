// Where the live-run guards keep their state: one machine-wide directory,
// shared by every checkout and worktree, beside the Lab slot directories.
//
// The directory is fixed, not configurable. An environment variable or flag
// that moved it would be a way for an agent to point the guards at an empty
// ledger and no stop or override files; the only inputs are files a person
// writes, and the ledger the guards themselves append to.
// Tests pass a temporary directory to the functions directly.

import os from "node:os";
import path from "node:path";

/** `~/FluxStuff/lab-slots`, which is `C:/Users/osrs_/FluxStuff/lab-slots` on the machine the rules were written for. */
export const DEFAULT_LAB_SLOTS_DIRECTORY = path.join(os.homedir(), "FluxStuff", "lab-slots");

/**
 * @param {string} directory the lab-slots directory
 * @returns {{ directory: string, ledger: string, stopBalance: string, override: (rule: string) => string }}
 */
export function guardFiles(directory) {
  return {
    directory,
    ledger: path.join(directory, "spend-ledger.jsonl"),
    stopBalance: path.join(directory, "STOP-balance"),
    override: (rule) => path.join(directory, `OVERRIDE-${rule}`),
  };
}
