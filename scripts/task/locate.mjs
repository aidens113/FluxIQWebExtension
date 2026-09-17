// Finding a task by its id: the branch that carries it, and the worktree it is
// checked out in if it has one. Both are read from git rather than from any
// record this tooling keeps, so a branch or worktree created or removed by hand
// is still seen. A task with no worktree is a task worked on in the main
// checkout, which is the ordinary case.

import { runGit } from "../worktree/index.mjs";
import { parseTaskBranch } from "./branch-name.mjs";

export async function listWorktrees(repositoryRoot) {
  const { stdout } = await runGit(repositoryRoot, ["worktree", "list", "--porcelain"]);
  const worktrees = [];
  let current = null;

  for (const line of stdout.split("\n")) {
    if (line.startsWith("worktree ")) {
      current = { root: line.slice("worktree ".length).trim(), branch: null, detached: false };
      worktrees.push(current);
    } else if (line.startsWith("branch ") && current) {
      current.branch = line.slice("branch refs/heads/".length).trim();
    } else if (line.trim() === "detached" && current) {
      current.detached = true;
    }
  }

  return worktrees;
}

export async function locateTask(repositoryRoot, id) {
  const { stdout } = await runGit(repositoryRoot, ["branch", "--list", "--format=%(refname:short)", `task/${id}-*`]);
  const branches = stdout.split("\n").map((line) => line.trim()).filter(Boolean);

  if (branches.length === 0) throw new Error(`No branch for task ${id}. Open tasks are listed by "pnpm task list".`);
  if (branches.length > 1) throw new Error(`Task ${id} has ${branches.length} branches (${branches.join(", ")}); an id names one unit of work, so resolve this by hand.`);

  const branch = branches[0];
  const worktree = (await listWorktrees(repositoryRoot)).find((entry) => entry.branch === branch) ?? null;

  return { id, branch, slug: parseTaskBranch(branch)?.slug ?? null, worktree };
}
