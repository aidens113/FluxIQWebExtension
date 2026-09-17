// Where a task's worktree lives. Two layouts, and the choice is forced by
// whether the task edits FluxIQ Core.
//
// `domain/package.json` links Core as `link:../../!FluxIQ/packages/fluxiq`,
// resolved from the worktree's `domain` directory, so Core is always the
// worktree's sibling. That means sibling worktrees share one Core -- which is
// how nine Lab worktrees live beside a single `F:/fxlab/!FluxIQ` -- and sharing
// it matters: standing up Core is 48.6s of a 52.6s setup, so the flat layout
// costs about four seconds per task after the first.
//
// A task that edits Core cannot use the shared Core, because it is detached and
// every other task builds against it. Such a task nests, paying the full cost
// for a Core worktree of its own.

import path from "node:path";

export const DEFAULT_BASE_NAME = "fxwork";

export function resolveTaskRoots({ repositoryRoot, id, slug, core = false, base }) {
  const disposableBase = path.resolve(base ?? path.join(repositoryRoot, "..", DEFAULT_BASE_NAME));

  if (core) {
    const taskDir = path.join(disposableBase, id);
    return {
      base: disposableBase,
      nested: true,
      extRoot: path.join(taskDir, path.basename(repositoryRoot)),
      coreRoot: path.join(taskDir, "!FluxIQ")
    };
  }

  return {
    base: disposableBase,
    nested: false,
    extRoot: path.join(disposableBase, `${id}-${slug}`),
    coreRoot: path.join(disposableBase, "!FluxIQ")
  };
}
