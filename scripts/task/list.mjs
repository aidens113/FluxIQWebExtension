// What is open right now: every task branch, where it is checked out, and how
// far it has drifted from the integration branch. The drift is the number worth
// reading -- a task many commits behind `dev` is the one whose merge is about
// to surface a conflict, or worse, a semantic clash git will not report at all.

import { runGit } from "../worktree/index.mjs";
import { parseTaskBranch } from "./branch-name.mjs";
import { listWorktrees } from "./locate.mjs";

export async function listTasks(repositoryRoot, { integrationBranch = "dev" } = {}) {
  const stdout = await runGit(repositoryRoot, ["branch", "--list", "--format=%(refname:short)", "task/*"]);
  const branches = stdout.split("\n").map((line) => line.trim()).filter(Boolean);
  const worktrees = await listWorktrees(repositoryRoot);

  return Promise.all(branches.map(async (branch) => {
    const counts = await runGit(repositoryRoot, ["rev-list", "--left-right", "--count", `${integrationBranch}...${branch}`]);
    const [behind, ahead] = counts.trim().split(/\s+/u).map(Number);
    const parsed = parseTaskBranch(branch);

    return {
      id: parsed?.id ?? null,
      slug: parsed?.slug ?? null,
      branch,
      worktree: worktrees.find((entry) => entry.branch === branch)?.root ?? null,
      ahead,
      behind
    };
  }));
}
