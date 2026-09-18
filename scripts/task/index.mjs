// The task lifecycle: opening a unit of work on its own branch, optionally in
// its own worktree, and closing it with a merge boundary that can be reverted
// whole. Design and the measurements behind it are in
// docs/working/agent-git-workflow-plan.md.

export { parseTaskArguments } from "./arguments.mjs";
export { COMMAND_OPTIONS } from "./command-options.mjs";
export { abandonTask } from "./abandon.mjs";
export { parseTaskBranch, taskBranchName } from "./branch-name.mjs";
export { runTaskCommandLine } from "./command-line.mjs";
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
export { nextTaskId } from "./task-id.mjs";
