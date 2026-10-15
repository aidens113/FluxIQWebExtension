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
//
// Branches and merges alone forget an abandoned task: its branch is deleted
// and it never merged, so its number was handed out again. t574, t598 and t616
// (abandoned at 19:10 on 2026-10-14 and re-allocated seconds later) each came
// to name two units of work while trailers, ledgers and reports still pointed
// at the first. So every allocation is recorded as a local ref,
// `refs/fluxiq/task-ids/t<NNN>`, at the commit the task started from, in each
// repository it was allocated against (`record-task-id.mjs`), and those refs
// count as used. A ref cannot conflict between two tasks, survives branch
// deletion, abandon and prune (none of which touch it), and costs nothing.
// `Task: t<NNN>` trailers on any local branch count as well, which covers ids
// spent before the refs existed. A fresh clone has neither, and still clears
// every merged id from history exactly as before.

import { runGit } from "../worktree/index.mjs";
import { TASK_ID_REF_PREFIX } from "./task-id-ref-prefix.mjs";

const OPEN = /^task\/t(\d+)-/u;
const MERGED = /^Merge task t(\d+):/u;
const RECORDED = /^refs\/fluxiq\/task-ids\/t(\d+)$/u;
const TRAILER = /^t(\d+)$/u;

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
  const recorded = await runGit(root, ["for-each-ref", "--format=%(refname)", TASK_ID_REF_PREFIX]);
  const trailers = await runGit(root, ["log", "--branches", "--format=%(trailers:key=Task,valueonly)"]);

  return [
    ...branches.split("\n").map((line) => OPEN.exec(line.trim())?.[1]),
    ...subjects.split("\n").map((line) => MERGED.exec(line.trim())?.[1]),
    ...recorded.split("\n").map((line) => RECORDED.exec(line.trim())?.[1]),
    ...trailers.split("\n").map((line) => TRAILER.exec(line.trim())?.[1])
  ].filter(Boolean).map(Number);
}
