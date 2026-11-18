import { gitAnsweredNo, runGit } from "../core-scripts/index.mjs";

/**
 * Whether the Core beside this checkout is the task tool's shared Core or a
 * Core this checkout may prepare itself.
 *
 * The shared Core that flat task worktrees build against is a linked worktree
 * of Core on a detached HEAD (`scripts/worktree/shared-core-move.mjs`): a Core
 * on a branch is somebody's working checkout -- the main Core, or a
 * Core-paired task's own -- and is prepared as usual. The base directory's
 * name is not part of the answer, because `pnpm task start --base` and the
 * Lab's pinned worktrees put shared Cores elsewhere too.
 *
 * @param {string} coreRoot
 * @param {{ git?: (cwd: string, args: string[]) => Promise<string> }} [options] `git` replaced by tests
 * @returns {Promise<"shared" | "own">}
 */
export async function coreKind(coreRoot, { git = runGit } = {}) {
  // `symbolic-ref` exits non-zero exactly when HEAD is on no branch; git
  // failing to run at all is not that answer.
  const branch = await git(coreRoot, ["symbolic-ref", "--quiet", "--short", "HEAD"]).catch((error) => {
    if (gitAnsweredNo(error)) return "";
    throw error;
  });
  if (branch.trim()) return "own";
  const [gitDir, commonDir] = await Promise.all([
    git(coreRoot, ["rev-parse", "--path-format=absolute", "--git-dir"]),
    git(coreRoot, ["rev-parse", "--path-format=absolute", "--git-common-dir"])
  ]);
  return normalized(gitDir) === normalized(commonDir) ? "own" : "shared";
}

function normalized(directory) {
  return directory.trim().replace(/\\/gu, "/").replace(/\/+$/u, "").toLowerCase();
}
