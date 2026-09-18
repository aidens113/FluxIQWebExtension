// Opening a task. Two shapes: a branch in the checkout you are already in, or a
// branch in a worktree of its own. The branch is the cheap default because it
// is two git commands and buys the merge boundary; the worktree is for when
// another agent is running repository-wide validation at the same time, when
// the work may be thrown away, or for a long Lab or build run.
//
// A flat worktree builds against the Core every flat worktree beside it shares,
// and that Core is brought up to Core's `dev` here, so the task gets the Core
// that this repository's `dev` was written against (`shared-core-move.mjs`
// says what went wrong while it was not).
//
// Every refusal is decided before anything changes, so a rejected start leaves
// no half-made branch or half-installed worktree behind.

import { stat } from "node:fs/promises";

import { applyMove, assertDisposable, buildCore, copyEnvLocal, coreDistPaths, createWorktree, planSharedCoreMove, readSideState, runGit, runPnpm, writeMarker } from "../worktree/index.mjs";
import { withoutProviderSecrets } from "../provider-secret-environment.mjs";
import { taskBranchName } from "./branch-name.mjs";
import { resolveTaskRoots } from "./roots.mjs";
import { nextTaskId } from "./task-id.mjs";

export async function startTask({ repositoryRoot, coreRepositoryRoot, slug, worktree = false, core = false, base, from = "dev", coreFrom = "dev", allowRunning = false, dryRun = false }) {
  if (!slug) throw new Error('Name the work: pnpm task start <slug>, for example "flow-editor-cleanup".');
  if (core && !worktree) throw new Error("--core needs --worktree: a Core-paired task takes a nested worktree with a Core of its own, because the shared Core is detached and every other task builds against it.");
  if (core && !coreRepositoryRoot) throw new Error("--core needs a Core checkout beside this one; none was resolved, so the paired branch has nowhere to be created.");

  const id = await nextTaskId(repositoryRoot, { integrationBranch: from });
  const branch = taskBranchName(id, slug);

  const existing = await runGit(repositoryRoot, ["branch", "--list", "--format=%(refname:short)", branch]);
  if (existing.trim()) throw new Error(`${branch} already exists.`);

  const roots = worktree ? resolveTaskRoots({ repositoryRoot, id, slug, core, base }) : null;
  if (roots) {
    assertDisposable({ base: roots.base, root: roots.extRoot, repositoryRoot, workingRoots: [repositoryRoot, coreRepositoryRoot].filter(Boolean) });
  }

  // Whether the shared Core can be moved to Core's `dev` is decided here, with
  // every other refusal: moving it touches every task beside it, so a Core that
  // is dirty, on a commit nothing else holds, or in use by a running process
  // refuses the start rather than being found out after the worktree exists.
  const sharedCore = roots && !core && await present(roots.coreRoot)
    ? await planSharedCoreMove({ coreRoot: roots.coreRoot, repositoryRoot, target: coreFrom, allowRunning })
    : null;
  if (sharedCore?.refusal) throw new Error(sharedCore.refusal);

  if (!worktree) {
    const state = await readSideState(repositoryRoot, from);
    if (state.dirtyLines?.length) {
      throw new Error(`${repositoryRoot} has ${state.dirtyLines.length} uncommitted or untracked change(s); commit, stash or discard them before opening a task branch here, or use --worktree to leave this checkout alone.`);
    }
  }

  if (dryRun) return { id, branch, from, worktree: roots?.extRoot ?? null, core: roots?.coreRoot ?? null, coreBranch: core ? branch : null, sharedCore: describeMove(sharedCore), applied: false };

  if (worktree) {
    const env = { ...withoutProviderSecrets(process.env), npm_config_workspace_concurrency: "1" };
    // A Core-paired task branches Core under the SAME name, so one id names the
    // unit of work in both histories and each side keeps its own merge boundary.
    // A task that only builds against Core passes no branch and keeps the shared
    // detached Core, which is what makes it cost seconds rather than a minute.
    // Either way a Core added here starts at Core's `dev`, not at whatever the
    // main Core happens to have checked out.
    const created = await createWorktree({
      repositoryRoot, branch, root: roots.extRoot, startPoint: from, coreRepositoryRoot, env, coreStartPoint: coreFrom,
      ...core ? { coreBranch: branch } : {}
    });

    // createWorktree installs both sides but deliberately builds neither, and
    // Core's dist/ is gitignored. Without this the worktree installs cleanly
    // and then fails every type check with TS2307.
    let moved = null;
    if (core) {
      if (created.coreCreated || !await built(created.coreRoot)) await buildCore(created.coreRoot, { env });
    } else {
      moved = await moveSharedCore(created.coreRoot, { repositoryRoot, coreFrom, env });
    }

    // The workspace's own packages need building for the same reason Core does:
    // every `dist/` is gitignored, so a fresh worktree resolves
    // `@fluxiq-web-extension/test-evidence` and its siblings to nothing and
    // `pnpm check` dies with TS2307 on a worktree that installed perfectly.
    // Measured at 16.5s, which is the price of a worktree that can actually be
    // validated in.
    await runPnpm(created.root, ["build"], { env });

    const env_local = await copyEnvLocal({ fromRoot: repositoryRoot, toRoot: roots.extRoot });
    return { id, branch, from, worktree: created.root, core: created.coreRoot, coreCreated: created.coreCreated, coreBranch: created.coreBranch, sharedCore: describeMove(moved), envLocal: env_local, applied: true };
  }

  await runGit(repositoryRoot, ["checkout", "-b", branch, from]);
  return { id, branch, from, worktree: null, core: null, coreBranch: null, applied: true };
}

/**
 * Brings the shared Core beside a just-created worktree to Core's `dev` and
 * builds it there. A shared Core that is already current and built costs
 * nothing, which is what keeps a second worktree at seconds rather than a
 * minute.
 */
async function moveSharedCore(coreRoot, { repositoryRoot, coreFrom, env }) {
  // createWorktree has just installed this Core at its HEAD. pnpm's own record
  // of that install is what the move reads back (`installed-lockfile.mjs`);
  // this marker is the fallback for a linker that writes no such record, and
  // without it such a worktree would reinstall on its first move.
  await writeMarker(coreRoot, "install", await runGit(coreRoot, ["rev-parse", "--verify", "HEAD:pnpm-lock.yaml"]));
  // Running processes were ruled out before anything changed. Checking again
  // now could only refuse after the worktree exists, which is the half-made
  // start every refusal above is there to prevent.
  const plan = await planSharedCoreMove({ coreRoot, repositoryRoot, target: coreFrom, allowRunning: true });
  if (plan.refusal) throw new Error(plan.refusal);
  await applyMove(plan, { env });
  return plan;
}

function describeMove(plan) {
  if (!plan) return null;
  return { from: plan.from, to: plan.to, behind: plan.behind, checkout: plan.checkout, install: plan.install, build: plan.build };
}

async function present(target) {
  return stat(target).then(() => true, (error) => {
    if (error?.code === "ENOENT") return false;
    throw error;
  });
}

async function built(coreRoot) {
  const distPresent = await Promise.all(coreDistPaths(coreRoot).map((dist) => stat(dist).then(() => true, () => false)));
  return distPresent.every(Boolean);
}
