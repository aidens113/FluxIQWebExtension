// Creating a task worktree, with its Core beside it and both installed.
//
// Four things have to be true before anything can be built in a worktree of
// its own, and only the first is what `git worktree add` does.
//
// The Core a worktree links is its SIBLING, not the Core this checkout uses
// (core-sibling.mjs says why), so a freshly added worktree usually has no Core
// at all and one is added beside it.
//
// How it is added depends on what the task is for. A task that only builds
// against Core takes it detached: that Core is shared by every task beside it,
// so it is moved to a commit and never developed on, and a branch there would
// belong to no one task. A shared Core that is already there is left where it
// is; keeping it at Core's `dev` is the caller's job (`shared-core-move.mjs`),
// because moving it touches every task beside it and has refusals of its own.
// A task that CHANGES Core -- which is the nested layout, and the only reason
// to pay for a Core worktree of its own -- takes `coreBranch`
// instead and gets a real branch, so the Core side of the work has the same
// merge boundary, the same revert, and the same `Task:` trailer as this side.
// Both sides of such a task carry ONE id, allocated here and passed to Core, so
// a cross-repository change reads as one task in both histories.
//
// Both sides are then installed, Core first, because the extension side's
// install is what creates `domain/node_modules/fluxiq` and it can only link a
// Core that is already there (`install-worktree.mjs` says how each is installed).
//
// Finally the link is followed to a real path and required to land inside that
// sibling. Nothing before it proves that: pnpm can leave an older directory in
// place, a junction can point elsewhere, and a worktree quietly building
// against the wrong Core is the failure this whole module exists to prevent.
//
// What is deliberately NOT done here: Core's packages are not built. A fresh
// Core worktree has no `dist/` -- it is gitignored -- so `pnpm check` there
// fails with TS2307 until they are built, and that takes about a minute. The
// build order belongs to Core's own root `build` script and is not copied into
// a second place; the caller runs it once this returns.
//
// Every refusal is decided before `git worktree add` runs, so a rejected
// request leaves nothing behind.
//
// The installer is a collaborator rather than a call, because the ordering and
// the link check around it are the whole point of this module and a test that
// had to run two real installs to reach them would take minutes and depend on
// what is in the pnpm store.

import { realpath, stat } from "node:fs/promises";
import path from "node:path";
import { withoutProviderSecrets } from "../provider-secret-environment.mjs";
import { checkoutRepository } from "./checkout-repository.mjs";
import { resolveCoreSibling } from "./core-sibling.mjs";
import { runGit } from "./git-command.mjs";
import { pathInside } from "./path-identity.mjs";
import { installWorktree } from "./install-worktree.mjs";
import { noteProgress } from "./progress-note.mjs";

/**
 * @param {{
 *   repositoryRoot: string, branch: string, root: string, startPoint: string,
 *   coreRepositoryRoot: string, coreStartPoint?: string, coreBranch?: string,
 *   env?: NodeJS.ProcessEnv, note?: (line: Record<string, unknown>) => void,
 *   runInstall?: (root: string, env: NodeJS.ProcessEnv, note: Function, side: string) => Promise<void>,
 * }} input
 */
export async function createWorktree({ repositoryRoot, branch, root, startPoint, coreRepositoryRoot, coreStartPoint = "HEAD", coreBranch, env, note = noteProgress, runInstall = install }) {
  const installEnv = env ?? { ...withoutProviderSecrets(process.env), npm_config_workspace_concurrency: "1" };
  if (await exists(root)) throw new Error(`Refusing to create the worktree ${root}: something is there already.`);
  if (await runGit(repositoryRoot, ["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`]).then(() => true, () => false)) {
    throw new Error(`Refusing to create the worktree ${root}: the branch ${JSON.stringify(branch)} already exists in ${repositoryRoot}.`);
  }
  const start = await runGit(repositoryRoot, ["rev-parse", "--verify", "--quiet", `${startPoint}^{commit}`]).catch((error) => {
    throw new Error(`Refusing to create the worktree ${root}: ${JSON.stringify(startPoint)} does not name a commit in ${repositoryRoot}.`, { cause: error });
  });
  await checkoutRepository(coreRepositoryRoot).catch((error) => {
    throw new Error(`Refusing to create the worktree ${root}: its Core ${coreRepositoryRoot} is not the top of a git checkout, so a Core sibling cannot be added from it.`, { cause: error });
  });
  // Decided here with every other refusal, because a Core branch that already
  // exists is found only after this repository's worktree and branch are made,
  // and a half-made pair is worse than a refused one.
  if (coreBranch && await runGit(coreRepositoryRoot, ["rev-parse", "--verify", "--quiet", `refs/heads/${coreBranch}`]).then(() => true, () => false)) {
    throw new Error(`Refusing to create the worktree ${root}: the paired branch ${JSON.stringify(coreBranch)} already exists in Core (${coreRepositoryRoot}). One id names one unit of work on both sides.`);
  }
  if (coreBranch) {
    await runGit(coreRepositoryRoot, ["rev-parse", "--verify", "--quiet", `${coreStartPoint}^{commit}`]).catch((error) => {
      throw new Error(`Refusing to create the worktree ${root}: ${JSON.stringify(coreStartPoint)} does not name a commit in Core (${coreRepositoryRoot}), so the paired branch has nothing to start from.`, { cause: error });
    });
  }

  note({ step: "add", root, branch, startPoint: start });
  await runGit(repositoryRoot, ["worktree", "add", "-b", branch, root, start]);
  const found = await resolveCoreSibling(root, { coreRepositoryRoot });
  if (!found.present) {
    note({ step: "add-core", root: found.root, from: coreRepositoryRoot, startPoint: coreStartPoint, branch: coreBranch ?? null });
    const placement = coreBranch ? ["-b", coreBranch] : ["--detach"];
    await runGit(coreRepositoryRoot, ["worktree", "add", ...placement, found.root, coreStartPoint]);
  }
  const core = await resolveCoreSibling(root, { coreRepositoryRoot });
  await runInstall(core.root, installEnv, note, "core");
  await runInstall(root, installEnv, note, "ext");

  const link = path.join(root, "domain", "node_modules", "fluxiq");
  const target = await realpath(link);
  if (!pathInside(core.root, target)) throw new Error(`${link} resolves to ${target}, not into this worktree's Core ${core.root}. The worktree would build against a Core nobody asked for.`);
  note({ step: "linked", link, target });
  return { root, branch, startPoint: start, coreRoot: core.root, coreCreated: !found.present, coreBranch: found.present ? null : coreBranch ?? null, linkTarget: target };
}

function install(root, env, note, side) {
  return installWorktree(root, { env, note, side });
}

async function exists(target) {
  try {
    await stat(target);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}
