// Throwing a task away. This is the safety valve that keeps the workflow from
// ever being the reason work stalls: a task that went wrong is deleted whole
// and `dev` needs no cleaning, because nothing was ever merged into it.
//
// Commits that never reached the integration branch are lost, so a task that
// has any is refused unless --force says to discard them. The reflog still
// holds them for a while, but nothing about that is a promise.

import { removeWorktree, runGit } from "../worktree/index.mjs";
import { locateTask } from "./locate.mjs";

export async function abandonTask({ repositoryRoot, id, integrationBranch = "dev", force = false, allowRunning = false, dryRun = false }) {
  const task = await locateTask(repositoryRoot, id);

  const stdout = await runGit(repositoryRoot, ["rev-list", "--count", `${integrationBranch}..${task.branch}`]);
  const unmerged = Number(stdout.trim());
  if (unmerged > 0 && !force) {
    throw new Error(`${task.branch} has ${unmerged} commit(s) that never reached ${integrationBranch}. Abandoning discards them; pass --force if that is what you mean.`);
  }

  if (dryRun) return { id, branch: task.branch, worktree: task.worktree?.root ?? null, unmerged, applied: false };

  if (task.worktree) await removeWorktree({ repositoryRoot, root: task.worktree.root, allowRunning });
  await runGit(repositoryRoot, ["branch", "-D", task.branch]);

  return { id, branch: task.branch, worktree: task.worktree?.root ?? null, unmerged, applied: true };
}
