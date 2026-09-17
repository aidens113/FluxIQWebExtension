// Closing a task: integrate, validate, merge, clean up.
//
// The integration step is the one that earns its keep. Two tasks can change
// different files, merge without a single conflict, and still leave the system
// incompatible -- git has no way to see that. Merging the integration branch
// into the task branch and re-running the checks there is what surfaces it,
// before `dev` is touched rather than after.
//
// The merge is always `--no-ff`, so the task keeps a boundary in history:
// first-parent history reads as a list of tasks, and `git revert -m 1` undoes
// one whole task cleanly. Commits are never squashed, because they are the
// step-by-step record of how the work went.
//
// A Core-paired task is NOT merged on both sides from here, and the order is
// forced rather than chosen. This side must finish first, because its
// `pnpm check` builds against the Core worktree beside it and would fail the
// moment that worktree went away. Core's own merge then runs Core's own checks
// in Core's own checkout, which is the only place they mean anything --
// merging Core from here would put a Core commit on Core's `dev` that Core's
// gates never saw. So this returns the paired branch and the command that
// closes it, rather than closing it or ignoring it.

import { processesUsingRoots, readSideState, removeWorktree, runGit, runPnpm } from "../worktree/index.mjs";
import { withoutProviderSecrets } from "../provider-secret-environment.mjs";
import { locateTask } from "./locate.mjs";
import { pairedCore } from "./paired-core.mjs";

export async function finishTask({ repositoryRoot, coreRepositoryRoot, id, integrationBranch = "dev", skipChecks = false, allowRunning = false, dryRun = false, title }) {
  const task = await locateTask(repositoryRoot, id);
  const workRoot = task.worktree?.root ?? repositoryRoot;

  const state = await readSideState(workRoot, task.branch);
  if (state.dirtyLines?.length) {
    throw new Error(`${workRoot} has ${state.dirtyLines.length} uncommitted or untracked change(s) (${state.dirtyLines.slice(0, 3).map((line) => line.trim()).join("; ")}). Commit or discard them: a task merges what is in its history, never what is lying in its tree.`);
  }

  const mainBranch = (await runGit(repositoryRoot, ["rev-parse", "--abbrev-ref", "HEAD"])).trim();
  if (task.worktree && mainBranch !== integrationBranch) {
    throw new Error(`${repositoryRoot} is on ${mainBranch}, not ${integrationBranch}, so there is nothing here to merge task ${id} into. Switch it first.`);
  }

  // Read before anything moves: it is resolved through the worktree's own
  // Core link, and this function is about to remove that worktree.
  const core = task.worktree
    ? await pairedCore({ coreRepositoryRoot, extWorktreeRoot: task.worktree.root, branch: task.branch, integrationBranch })
    : null;
  const pairing = core === null ? null : {
    branch: core.branch,
    worktree: core.root,
    unmerged: core.unmerged,
    next: `pnpm task finish ${id}`,
    why: `Task ${id} also has a branch in Core. Finish it there, in ${coreRepositoryRoot}, so Core's own checks run against Core's own merge. This side is finished first because its checks build against that worktree.`
  };

  if (dryRun) return { id, branch: task.branch, worktree: task.worktree?.root ?? null, core: pairing, applied: false };

  if (!task.worktree && mainBranch !== task.branch) {
    await runGit(repositoryRoot, ["checkout", task.branch]);
  }

  await runGit(workRoot, ["merge", "--no-edit", integrationBranch]);

  const validation = skipChecks
    ? { ran: false, command: null, reason: "--skip-checks" }
    : await validate(workRoot);

  if (!task.worktree) await runGit(repositoryRoot, ["checkout", integrationBranch]);

  const subject = `Merge task ${id}: ${title ?? task.slug ?? task.branch}`;
  await runGit(repositoryRoot, ["merge", "--no-ff", "-m", subject, task.branch]);

  if (task.worktree) {
    const busy = await processesUsingRoots([task.worktree.root]);
    if (busy.length > 0 && !allowRunning) {
      return { id, branch: task.branch, merged: subject, validation, worktree: task.worktree.root, removed: false, core: pairing, note: `Merged, but ${busy.length} process(es) are still running under the worktree, so it was left in place. Remove it with "pnpm task abandon ${id}" once they exit, or pass --allow-running.`, applied: true };
    }
    await removeWorktree({ repositoryRoot, root: task.worktree.root, allowRunning });
  }

  await runGit(repositoryRoot, ["branch", "-d", task.branch]);

  return { id, branch: task.branch, merged: subject, validation, worktree: task.worktree?.root ?? null, removed: Boolean(task.worktree), core: pairing, applied: true };
}

async function validate(workRoot) {
  try {
    await runPnpm(workRoot, ["check"], { env: { ...withoutProviderSecrets(process.env), npm_config_workspace_concurrency: "1" } });
    return { ran: true, command: "pnpm check", passed: true };
  } catch (cause) {
    throw new Error(`"pnpm check" failed in ${workRoot}, so the task was not merged. Fix it and run finish again, or pass --skip-checks if the failure is known and unrelated.`, { cause });
  }
}
