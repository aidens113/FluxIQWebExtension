// Throwing a task away. This is the safety valve that keeps the workflow from
// ever being the reason work stalls: a task that went wrong is deleted whole
// and `dev` needs no cleaning, because nothing was ever merged into it.
//
// Commits that never reached the integration branch are lost, so a task that
// has any is refused unless --force says to discard them. The reflog still
// holds them for a while, but nothing about that is a promise.
//
// A Core-paired task is abandoned on both sides at once, because it is one unit
// of work that happens to span two repositories: leaving Core's branch behind
// would leave an id half-used, and the next cross-repository task carrying that
// id would be refused by a branch nobody remembers making. Core's unmerged
// commits are counted and refused on exactly the same terms as this
// repository's, and both counts are decided before either side is touched.

import { removeWorktree, runGit } from "../worktree/index.mjs";
import { locateTask } from "./locate.mjs";
import { pairedCore } from "./paired-core.mjs";

export async function abandonTask({ repositoryRoot, coreRepositoryRoot, id, integrationBranch = "dev", force = false, allowRunning = false, dryRun = false }) {
  const task = await locateTask(repositoryRoot, id);

  const stdout = await runGit(repositoryRoot, ["rev-list", "--count", `${integrationBranch}..${task.branch}`]);
  const unmerged = Number(stdout.trim());
  const core = task.worktree
    ? await pairedCore({ coreRepositoryRoot, extWorktreeRoot: task.worktree.root, branch: task.branch, integrationBranch })
    : null;

  if (unmerged > 0 && !force) {
    throw new Error(`${task.branch} has ${unmerged} commit(s) that never reached ${integrationBranch}. Abandoning discards them; pass --force if that is what you mean.`);
  }
  if (core && core.unmerged > 0 && !force) {
    throw new Error(`The paired Core branch ${core.branch} has ${core.unmerged} commit(s) that never reached ${integrationBranch} in ${coreRepositoryRoot}. Abandoning discards them too; pass --force if that is what you mean.`);
  }

  const result = { id, branch: task.branch, worktree: task.worktree?.root ?? null, unmerged, core: core && { branch: core.branch, worktree: core.root, unmerged: core.unmerged } };
  if (dryRun) return { ...result, applied: false };

  // Core first: its worktree is nested inside the task directory beside this
  // repository's, so removing it afterwards would mean reaching into a
  // directory the other removal may already have taken.
  if (core) {
    await removeWorktree({ repositoryRoot: coreRepositoryRoot, root: core.root, allowRunning });
    await runGit(coreRepositoryRoot, ["branch", "-D", core.branch]);
  }
  if (task.worktree) await removeWorktree({ repositoryRoot, root: task.worktree.root, allowRunning });
  // A task worked on in place leaves this checkout standing on its own branch,
  // and git refuses to delete the branch HEAD is on. Stepping back to the
  // integration branch first is what makes abandoning a task branch in the
  // shared checkout -- the common case, and the cheap tier -- work at all.
  const head = (await runGit(repositoryRoot, ["rev-parse", "--abbrev-ref", "HEAD"])).trim();
  if (head === task.branch) await runGit(repositoryRoot, ["checkout", integrationBranch]);
  await runGit(repositoryRoot, ["branch", "-D", task.branch]);

  return { ...result, applied: true };
}
