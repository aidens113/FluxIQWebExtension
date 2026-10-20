// The task lifecycle: opening a unit of work on its own branch, optionally in
// its own worktree, and closing it with a merge boundary that can be reverted
// whole. Design and the measurements behind it are in
// docs/working/agent-git-workflow-plan.md.
//
// The rules this shares with FluxIQ Core's own `pnpm task` -- task id
// allocation and the refs that record it, branch naming, the git runner -- are
// Core's (`scripts/task/` there) and are loaded from the Core beside this
// checkout through `scripts/core-scripts/` -- except the git runner and path
// identity, which `sync-core` needs before an outdated Core can provide them and
// which are therefore drift-checked copies there. This directory keeps only the
// worktree, Core-pairing, sync and prune half, and its own command wiring;
// `run-task.mjs` enters through `command-line.mjs`, not this barrel, so a
// command loads only its own module.

export { parseTaskArguments } from "./arguments.mjs";
export { COMMAND_OPTIONS } from "./command-options.mjs";
export { abandonTask } from "./abandon.mjs";
export { runTaskCommandLine } from "./command-line.mjs";
export { checkCoreCurrent } from "./core-currency.mjs";
export { finishTask } from "./finish.mjs";
export { listTasks } from "./list.mjs";
export { listWorktrees, locateTask } from "./locate.mjs";
export { orphanedCores } from "./orphaned-cores.mjs";
export { pairedCore } from "./paired-core.mjs";
export { DEFAULT_PRUNE_DAYS, pruneTasks } from "./prune.mjs";
export { DEFAULT_BASE_NAME, resolveTaskRoots } from "./roots.mjs";
export { findScratchRoots } from "./scratch-roots.mjs";
export { staleDirectories } from "./stale-directories.mjs";
export { startTask } from "./start.mjs";
export { syncSharedCore } from "./sync-core.mjs";
