// Allocating the next task number. An id must not collide with work that is
// still open or with work whose merge is already history, so both are scanned:
// open work is a `task/t<NNN>-` branch, finished work is the subject of its
// `--no-ff` merge commit. History is scanned rather than a counter stored,
// because a counter in a tracked file is itself a merge conflict between two
// tasks allocated at the same time, and a counter in ignored space does not
// survive a fresh clone.

import { runGit } from "../worktree/index.mjs";

const OPEN = /^task\/t(\d+)-/u;
const MERGED = /^Merge task t(\d+):/u;

export async function nextTaskId(repositoryRoot, { integrationBranch = "dev" } = {}) {
  const branches = await runGit(repositoryRoot, ["branch", "--list", "--format=%(refname:short)", "task/*"]);
  const subjects = await runGit(repositoryRoot, ["log", "--first-parent", "--format=%s", integrationBranch]);

  const used = [
    ...branches.stdout.split("\n").map((line) => OPEN.exec(line.trim())?.[1]),
    ...subjects.stdout.split("\n").map((line) => MERGED.exec(line.trim())?.[1])
  ].filter(Boolean).map(Number);

  const next = used.length === 0 ? 1 : Math.max(...used) + 1;
  return `t${String(next).padStart(3, "0")}`;
}
