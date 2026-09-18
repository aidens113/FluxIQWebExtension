// `pnpm task sync-core`: moving the shared Core this checkout builds against up
// to Core's `dev`.
//
// `pnpm task start --worktree` does this itself whenever it opens a task beside
// the shared Core. This command is for the time in between: Core's `dev` moves
// whenever a Core task is merged, and a worktree opened before that still
// builds against the Core it was given, which fails in the Lab as a Core that
// rejects what this repository's `dev` asks of it. Run it inside that worktree
// before a Lab run or a check that needs the current Core.
//
// It moves the Core this checkout's domain actually links
// (`scripts/worktree/core-sibling.mjs`), never a configured one, so what it
// moves is what the next build imports. From the main checkout that sibling is
// the main Core, which is on a branch, so the move is refused there; from a
// Core-paired task's worktree it is that task's own Core, refused the same way.
// Every refusal is `planSharedCoreMove`'s and is decided before anything
// changes.

import { withoutProviderSecrets } from "../provider-secret-environment.mjs";
import { applyMove, planSharedCoreMove, resolveCoreSibling } from "../worktree/index.mjs";

/**
 * @param {{ repositoryRoot: string, coreRepositoryRoot?: string, to?: string, allowRunning?: boolean, dryRun?: boolean }} input
 */
export async function syncSharedCore({ repositoryRoot, coreRepositoryRoot, to = "dev", allowRunning = false, dryRun = false }) {
  const sibling = await resolveCoreSibling(repositoryRoot, coreRepositoryRoot ? { coreRepositoryRoot } : {});
  if (!sibling.present) throw new Error(`${repositoryRoot} has no Core beside it at ${sibling.root}, so there is nothing to move. A task worktree gets one from pnpm task start --worktree.`);
  const plan = await planSharedCoreMove({ coreRoot: sibling.root, repositoryRoot, target: to, allowRunning });
  if (plan.refusal) throw new Error(plan.refusal);
  const summary = {
    core: plan.root, to: plan.target, from: plan.from, target: plan.to, behind: plan.behind,
    checkout: plan.checkout, install: plan.install, build: plan.build, sharedWith: plan.sharers,
  };
  if (dryRun) return { ...summary, applied: false };
  await applyMove(plan, { env: { ...withoutProviderSecrets(process.env), npm_config_workspace_concurrency: "1" } });
  return { ...summary, applied: true };
}
