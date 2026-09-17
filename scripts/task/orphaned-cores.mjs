// A FluxIQ Core worktree under the disposable base that no task is using any
// more.
//
// Finishing or abandoning a task removes that task's own worktree and nothing
// else, which is correct: the flat layout deliberately shares one Core between
// every task beside it, and the last task to finish has no way of knowing it
// was the last. The consequence is that the shared Core outlives every task
// that ever used it, and nothing reclaims it. Measured 2026-09-17,
// `F:/fxwork/!FluxIQ` held 650 MB with no task worktree left beside it.
//
// Both layouts fall out of a single rule, because both put Core where the
// `link:../../!FluxIQ/packages/fluxiq` dependency resolves it -- beside the
// worktree that links it. A Core under the base is orphaned when no worktree of
// this repository sits in the same directory. For the flat layout that
// directory is the base itself; for a Core-paired task it is that task's own
// `<base>/<id>/`. Nothing here needs to know which layout it is looking at.
//
// This decides only which Cores are unused. Whether one may actually be deleted
// is a separate question with its own refusals -- it must be below the
// disposable base, it must be a linked worktree of the Core repository rather
// than somebody's real checkout, it must be clean, and nothing may be running
// inside it -- and those live in assertDisposable and removeWorktree, where the
// Lab's checkout pair already relies on them.

import path from "node:path";
import { pathInside, samePath } from "../worktree/index.mjs";

/**
 * @param {{ base: string, extWorktrees: string[], coreWorktrees: string[] }} input
 *   `extWorktrees` are the worktrees of this repository and `coreWorktrees`
 *   those of FluxIQ Core, both as `git worktree list` reports them.
 * @returns {string[]} absolute paths of the Core worktrees nothing is using
 */
export function orphanedCores({ base, extWorktrees, coreWorktrees }) {
  const resolvedBase = path.resolve(base);
  const occupied = extWorktrees.map((root) => path.dirname(path.resolve(root)));

  return coreWorktrees
    .map((root) => path.resolve(root))
    .filter((root) => pathInside(resolvedBase, root))
    .filter((root) => !occupied.some((directory) => samePath(directory, path.dirname(root))));
}
