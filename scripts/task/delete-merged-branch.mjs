// Deleting a task branch once its work is on the integration branch.
//
// The plain safe delete judges "merged" against the branch's upstream when it
// has one, so a branch pushed before the integration merge landed on it is
// refused even though every commit is in `dev`. The question that matters is
// whether the integration branch contains the branch, so it is asked directly
// and only a "yes" allows the forced delete; a "no" refuses rather than lose
// work. Local deletion only.

import { gitAnsweredNo, runGit } from "../worktree/index.mjs";

export async function deleteMergedBranch({ repositoryRoot, branch, integrationBranch }) {
  try {
    await runGit(repositoryRoot, ["merge-base", "--is-ancestor", branch, integrationBranch]);
  } catch (cause) {
    if (!gitAnsweredNo(cause)) throw cause;
    throw new Error(`${branch} was not deleted: ${integrationBranch} does not contain all of its commits, so deleting it would lose work. Inspect it with "git log ${integrationBranch}..${branch}".`, { cause });
  }
  await runGit(repositoryRoot, ["branch", "-D", branch]);
}
