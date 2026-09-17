// Opening a task. Two shapes: a branch in the checkout you are already in, or a
// branch in a worktree of its own. The branch is the cheap default because it
// is two git commands and buys the merge boundary; the worktree is for when
// another agent is running repository-wide validation at the same time, when
// the work may be thrown away, or for a long Lab or build run.
//
// Every refusal is decided before anything changes, so a rejected start leaves
// no half-made branch or half-installed worktree behind.

import { stat } from "node:fs/promises";

import { assertDisposable, buildCore, copyEnvLocal, coreDistPaths, createWorktree, readSideState, runGit } from "../worktree/index.mjs";
import { withoutProviderSecrets } from "../provider-secret-environment.mjs";
import { taskBranchName } from "./branch-name.mjs";
import { resolveTaskRoots } from "./roots.mjs";
import { nextTaskId } from "./task-id.mjs";

export async function startTask({ repositoryRoot, coreRepositoryRoot, slug, worktree = false, core = false, base, from = "dev", dryRun = false }) {
  if (!slug) throw new Error('Name the work: pnpm task start <slug>, for example "flow-editor-cleanup".');
  if (core && !worktree) throw new Error("--core needs --worktree: a Core-paired task takes a nested worktree with a Core of its own, because the shared Core is detached and every other task builds against it.");

  const id = await nextTaskId(repositoryRoot, { integrationBranch: from });
  const branch = taskBranchName(id, slug);

  const existing = await runGit(repositoryRoot, ["branch", "--list", "--format=%(refname:short)", branch]);
  if (existing.trim()) throw new Error(`${branch} already exists.`);

  const roots = worktree ? resolveTaskRoots({ repositoryRoot, id, slug, core, base }) : null;
  if (roots) {
    assertDisposable({ base: roots.base, root: roots.extRoot, repositoryRoot, workingRoots: [repositoryRoot, coreRepositoryRoot].filter(Boolean) });
  }

  if (!worktree) {
    const state = await readSideState(repositoryRoot, from);
    if (state.dirtyLines?.length) {
      throw new Error(`${repositoryRoot} has ${state.dirtyLines.length} uncommitted or untracked change(s); commit, stash or discard them before opening a task branch here, or use --worktree to leave this checkout alone.`);
    }
  }

  if (dryRun) return { id, branch, from, worktree: roots?.extRoot ?? null, core: roots?.coreRoot ?? null, applied: false };

  if (worktree) {
    const env = { ...withoutProviderSecrets(process.env), npm_config_workspace_concurrency: "1" };
    const created = await createWorktree({ repositoryRoot, branch, root: roots.extRoot, startPoint: from, coreRepositoryRoot, env });

    // createWorktree installs both sides but deliberately builds neither, and
    // Core's dist/ is gitignored. Without this the worktree installs cleanly
    // and then fails every type check with TS2307. A shared Core that another
    // task already built is left alone, which is what makes the second
    // worktree cost seconds rather than a minute.
    if (created.coreCreated || !await built(created.coreRoot)) {
      await buildCore(created.coreRoot, { env });
    }

    const env_local = await copyEnvLocal({ fromRoot: repositoryRoot, toRoot: roots.extRoot });
    return { id, branch, from, worktree: created.root, core: created.coreRoot, coreCreated: created.coreCreated, envLocal: env_local, applied: true };
  }

  await runGit(repositoryRoot, ["checkout", "-b", branch, from]);
  return { id, branch, from, worktree: null, core: null, applied: true };
}

async function built(coreRoot) {
  const present = await Promise.all(coreDistPaths(coreRoot).map((dist) => stat(dist).then(() => true, () => false)));
  return present.every(Boolean);
}
