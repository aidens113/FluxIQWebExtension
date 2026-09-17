// The Core side of a task that changes Core.
//
// A Core-paired task is nested -- `<base>/<id>/{<repository>,!FluxIQ}` -- and
// its Core worktree sits on a branch of the SAME name as this repository's,
// because one id names one unit of work in both histories. All of that is
// discovered from git and the filesystem rather than from any record this
// tooling keeps, so a branch or worktree made or removed by hand is still seen.
// That is the same principle locate.mjs works on, and for the same reason: the
// tooling must describe the repository, not a belief about it.
//
// The distinction this module exists to make is between a task that CHANGES
// Core and one that merely builds against it. The second kind links the shared,
// detached Core that every flat task beside it uses, which is nobody's to
// delete and carries no branch. Getting that wrong would delete a branch in
// another repository, so the answer is read rather than assumed: the Core
// sibling must be a worktree Core itself lists, and it must be on exactly the
// branch this task's id names. Anything else is reported as unpaired.
//
// That listing is also why the sibling is resolved WITHOUT asking
// resolveCoreSibling to verify which repository it belongs to. Verification
// there reports a foreign Core by throwing, and a foreign Core is an ordinary
// answer here -- it is simply not this task's -- so catching it would put a
// genuine failure to read the worktree in the same bucket as "not paired", and
// abandon would silently skip a Core branch it was supposed to delete. Core's
// own worktree list answers the same question without that ambiguity: a
// sibling Core does not list is not Core's, and a sibling on another branch is
// not this task's.

import { resolveCoreSibling, runGit, samePath } from "../worktree/index.mjs";
import { listWorktrees } from "./locate.mjs";

/**
 * @param {{ coreRepositoryRoot: string, extWorktreeRoot: string, branch: string, integrationBranch?: string }} input
 * @returns {Promise<{ root: string, branch: string, unmerged: number } | null>} null when this task has no Core side of its own
 */
export async function pairedCore({ coreRepositoryRoot, extWorktreeRoot, branch, integrationBranch = "dev" }) {
  if (!coreRepositoryRoot || !extWorktreeRoot) return null;

  // Throws only when the worktree is not a checkout of this repository at all,
  // which is a real problem with the caller's input rather than an answer.
  const sibling = await resolveCoreSibling(extWorktreeRoot);
  if (!sibling.present) return null;

  const listed = (await listWorktrees(coreRepositoryRoot)).find((entry) => samePath(entry.root, sibling.root));
  if (!listed || listed.branch !== branch) return null;

  const stdout = await runGit(coreRepositoryRoot, ["rev-list", "--count", `${integrationBranch}..${branch}`]);
  return { root: sibling.root, branch, unmerged: Number(stdout.trim()) };
}
