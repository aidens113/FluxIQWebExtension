// Safe operations on a git worktree: what it takes to create one that can
// actually build, to read what state it is in, and to delete one without
// losing work.
//
// It exists because two unrelated callers need the same guarantees. The Lab's
// checkout pair (`scripts/lab/pair/`) moves two worktrees nobody edits so a
// campaign measures one pair of commits; a task (`scripts/task/`) gives one
// agent a worktree of its own so several can work at once. Both must resolve
// the Core SIBLING a worktree links rather than any configured Core, both must
// refuse to touch a checkout somebody is working in, and both must refuse to
// move or delete a tree that has something running inside it. Written once,
// those refusals are the same refusals; written twice, one copy drifts.
//
// By responsibility: `git-command.mjs` and `pnpm-command.mjs` run the two
// tools; `checkout-repository.mjs` says which repository a directory is the top of;
// `core-build.mjs` builds the Core packages a domain links;
// `path-identity.mjs` compares paths the way Windows does; `markers.mjs`
// records what finished in a worktree and `side-state.mjs` reads one
// worktree's whole state; `process-list.mjs` and `processes-using-roots.mjs`
// find what is running inside one; `disposable-root.mjs` decides whether a
// path may be deleted at all; `core-sibling.mjs` finds and proves the Core
// beside a worktree; `create.mjs`, `remove.mjs` and `env-local.mjs` are the
// lifecycle itself; `progress-note.mjs` is how a long step says it is running.

export { buildCore, coreDistPaths, CORE_PACKAGES } from "./core-build.mjs";
export { checkoutRepository } from "./checkout-repository.mjs";
export { resolveCoreSibling } from "./core-sibling.mjs";
export { createWorktree } from "./create.mjs";
export { assertDisposable } from "./disposable-root.mjs";
export { copyEnvLocal } from "./env-local.mjs";
export { runGit } from "./git-command.mjs";
export { clearMarker, readMarker, writeMarker } from "./markers.mjs";
export { pathInside, samePath } from "./path-identity.mjs";
export { runPnpm } from "./pnpm-command.mjs";
export { listProcesses } from "./process-list.mjs";
export { processesUsingRoots } from "./processes-using-roots.mjs";
export { noteProgress } from "./progress-note.mjs";
export { removeWorktree } from "./remove.mjs";
export { readSideState } from "./side-state.mjs";
