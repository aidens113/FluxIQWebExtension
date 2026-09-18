// The environment a Lab run or campaign started from the pair needs, on top of
// the caller's own.
//
// - FLUXIQ_CORE_ROOT: the Core the runner and its Core-quiet guard use. From
//   the pair the default already lands there; setting it says so outright.
// - FLUXIQ_TEST_ENV_FILES=none: the run takes no target configuration from an
//   env file. A live run still reads its provider key by that one name.
// - FLUXIQ_LAB_INSTANCE: builds into ignored `.lab-instances/<label>/`
//   directories. Without it the extension build rewrites the tracked
//   `apps/extension/build/`, the pair turns dirty, and the next move refuses.
// - FLUXIQ_LAB_ALLOW_BEHIND_CORE=1: the pair's Core is detached at the commit
//   the campaign measures, which is usually behind Core's `dev` and is meant
//   to be. The Lab refuses a Core behind `dev` because a task worktree's
//   shared Core goes stale without anyone deciding to leave it there
//   (scripts/lab/core/commit/); the pair decided, so it says so here.
// - npm_config_workspace_concurrency=1: workspace builds one at a time, which
//   this machine's memory needs.

/** @param {{ coreRoot: string, instance: string }} input */
export function campaignEnvironment({ coreRoot, instance }) {
  return Object.freeze({
    FLUXIQ_CORE_ROOT: coreRoot.replaceAll("\\", "/"),
    FLUXIQ_TEST_ENV_FILES: "none",
    FLUXIQ_LAB_INSTANCE: instance,
    FLUXIQ_LAB_ALLOW_BEHIND_CORE: "1",
    npm_config_workspace_concurrency: "1",
  });
}
