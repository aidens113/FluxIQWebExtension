// Carrying out a move `planSideMove` decided: check the worktree out at its
// target, install it if its lockfile changed, and build Core if it was last
// built anywhere else.
//
// Each marker is cleared before its step and written only once the step
// succeeded, so a move that dies halfway leaves a worktree whose markers say
// exactly what still has to run, and running the same move again finishes it.
// Refusals are not decided here: by the time a plan reaches this function its
// caller has already decided the move may happen.
//
// The installer and the builder are collaborators so the ordering and the
// markers can be tested without two real installs and a Core build.

import { buildCore } from "./core-build.mjs";
import { runGit } from "./git-command.mjs";
import { installWorktree } from "./install-worktree.mjs";
import { clearMarker, writeMarker } from "./markers.mjs";
import { noteProgress } from "./progress-note.mjs";

/**
 * @param {{ side: string, root: string, from: string, to: string, targetLock: string, checkout: boolean, install: boolean, build: boolean, packages?: Array<{ filter: string, directory: string }> }} plan
 * @param {{
 *   env: NodeJS.ProcessEnv, note?: (line: Record<string, unknown>) => void,
 *   runInstall?: (root: string, options: { env: NodeJS.ProcessEnv, side: string, note: Function }) => Promise<void>,
 *   runBuild?: (root: string, options: { env: NodeJS.ProcessEnv, note: Function }) => Promise<void>,
 * }} options
 */
export async function applyMove(plan, { env, note = noteProgress, runInstall = installWorktree, runBuild = buildCore }) {
  if (plan.checkout) {
    note({ step: "checkout", side: plan.side, root: plan.root, from: plan.from, to: plan.to });
    await runGit(plan.root, ["checkout", "--detach", plan.to]);
  }
  if (plan.install) {
    await clearMarker(plan.root, "install");
    await runInstall(plan.root, { env, side: plan.side, note });
    await writeMarker(plan.root, "install", plan.targetLock);
  }
  if (plan.build) {
    await clearMarker(plan.root, "build");
    await runBuild(plan.root, { env, note: (line) => note({ side: plan.side, commit: plan.to, ...line }), ...plan.packages ? { packages: plan.packages } : {} });
    await writeMarker(plan.root, "build", plan.to);
  }
}
