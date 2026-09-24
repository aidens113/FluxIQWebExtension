// Allocating the next task number. An id must not collide with work that is
// still open or with work whose merge is already history, so both are scanned:
// open work is a `task/t<NNN>-` branch, finished work is the subject of its
// `--no-ff` merge commit. History is scanned rather than a counter stored,
// because a counter in a tracked file is itself a merge conflict between two
// tasks allocated at the same time, and a counter in ignored space does not
// survive a fresh clone.
//
// A Core-paired task is allocated against both repositories at once. The id is
// meant to name one unit of work in both histories, so an id free here but
// already spent in Core would put two different tasks under one number in
// Core's own log, which a reader of `Merge task t122:` has no way to
// disambiguate. On 2026-09-24 this repository's next free id was t122 while
// Core had already merged its own t122 and t123, so the next paired task would
// have collided. Both roots are scanned and the higher wins.

import { runGit } from "../worktree/index.mjs";

const OPEN = /^task\/t(\d+)-/u;
const MERGED = /^Merge task t(\d+):/u;

export async function nextTaskId(repositoryRoot, { integrationBranch = "dev", coreRepositoryRoot = null, coreIntegrationBranch = "dev" } = {}) {
  const roots = [[repositoryRoot, integrationBranch]];
  if (coreRepositoryRoot) roots.push([coreRepositoryRoot, coreIntegrationBranch]);

  const used = (await Promise.all(roots.map(([root, branch]) => usedIds(root, branch)))).flat();

  const next = used.length === 0 ? 1 : Math.max(...used) + 1;
  return `t${String(next).padStart(3, "0")}`;
}

async function usedIds(root, integrationBranch) {
  const branches = await runGit(root, ["branch", "--list", "--format=%(refname:short)", "task/*"]);
  const subjects = await runGit(root, ["log", "--first-parent", "--format=%s", integrationBranch]);

  return [
    ...branches.split("\n").map((line) => OPEN.exec(line.trim())?.[1]),
    ...subjects.split("\n").map((line) => MERGED.exec(line.trim())?.[1])
  ].filter(Boolean).map(Number);
}
