// Installing one worktree's dependencies from its own lockfile.
//
// The install runs offline first: everything a known lockfile needs is in the
// store already, and an offline install neither waits on the network nor picks
// up something published since. A failure means the store is genuinely missing
// a package, so it is retried online rather than treated as fatal.
//
// Creating a worktree installs both sides, and moving one to a commit with a
// different lockfile installs it again; both go through here, so the two can
// never come to install differently.

import { runPnpm } from "./pnpm-command.mjs";
import { noteProgress } from "./progress-note.mjs";

const INSTALL = ["install", "--frozen-lockfile", "--config.confirm-modules-purge=false"];

/** @param {string} root @param {{ env: NodeJS.ProcessEnv, side: string, note?: (line: Record<string, unknown>) => void }} options */
export async function installWorktree(root, { env, side, note = noteProgress }) {
  note({ step: "install", side, root, offline: true });
  try {
    await runPnpm(root, [...INSTALL, "--offline"], { env });
  } catch (error) {
    note({ step: "install", side, root, offline: false, why: `the offline install failed, so the store may lack a package: ${error instanceof Error ? error.message : String(error)}` });
    await runPnpm(root, INSTALL, { env });
  }
}
