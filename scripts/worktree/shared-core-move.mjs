// Keeping the shared Core current: deciding whether the detached Core that
// flat task worktrees share may be moved to Core's `dev`, and what that takes.
//
// Every flat task worktree under one base links the same `<base>/!FluxIQ`
// (`core-sibling.mjs`). It is added at whatever Core commit is current when the
// first task beside it is opened, and until 2026-09-18 nothing ever moved it
// again. Core's `dev` moved on underneath it while this repository's `dev`
// moved with Core's, so every later task branched from a `dev` that expected a
// newer Core than the one it was given. The first place that showed was the
// Lab: a live run from a worktree asked Core for a 56,000-token budget that
// Core's `dev` accepts and the shared Core, eleven commits behind, rejected as
// "LLM execution limit is invalid". Core's server was then stopped by the
// run's cleanup with exit code 1, which read as Core crashing, and three
// worktree runs were written off as "worktrees cannot run the Lab".
//
// So the shared Core is moved, and moving it is decided here with every
// refusal that has to come first:
//
// - A Core on a branch is never moved. That is somebody's working checkout --
//   the main Core, or a Core-paired task's own -- not the shared one.
// - Uncommitted or untracked changes refuse the move (`move-plan.mjs`).
// - A detached HEAD that no branch or tag contains is refused, because moving
//   off it would leave that commit reachable from nothing.
// - A move that changes anything is refused while a process is working inside
//   the Core or inside any worktree that shares it, because a checkout or a
//   Core rebuild underneath a running Lab or type check deletes modules it has
//   loaded. `allowRunning` overrides only this last refusal.
//
// The worktrees that share it are read from git, as every worktree of this
// repository sitting in the Core's own directory, so one opened or removed by
// hand is still counted.

import path from "node:path";
import { fullCoreDistPaths, FULL_CORE_PACKAGES } from "./core-build.mjs";
import { gitAnsweredNo, runGit } from "./git-command.mjs";
import { planSideMove } from "./move-plan.mjs";
import { samePath } from "./path-identity.mjs";
import { processesUsingRoots } from "./processes-using-roots.mjs";
import { readSideState } from "./side-state.mjs";

/**
 * @param {{
 *   coreRoot: string, repositoryRoot: string, target?: string, allowRunning?: boolean,
 *   processes?: Array<{ pid: number, parentPid: number | null, name: string, commandLine: string }>, selfPid?: number,
 * }} input `processes` and `selfPid` replace the machine's process listing, for tests
 */
export async function planSharedCoreMove({ coreRoot, repositoryRoot, target = "dev", allowRunning = false, processes, selfPid }) {
  const state = await readSideState(coreRoot, target, { side: "core", buildable: true, distPaths: fullCoreDistPaths(coreRoot) });
  const plan = planSideMove({ ...state, forceBuild: false });
  const behind = Number(await runGit(coreRoot, ["rev-list", "--count", `${state.head}..${state.target}`]));
  const sharers = await worktreesBeside(repositoryRoot, coreRoot);
  const result = { ...plan, build: rebuilds(plan, state), packages: FULL_CORE_PACKAGES, target, behind, sharers, busy: [] };

  // `symbolic-ref` exits non-zero exactly when HEAD is on no branch, which is
  // the shared Core's normal state. Git failing to run at all is not that
  // answer, and must not be read as "detached, so safe to move".
  const branch = await runGit(coreRoot, ["symbolic-ref", "--quiet", "--short", "HEAD"]).catch((error) => {
    if (gitAnsweredNo(error)) return null;
    throw error;
  });
  if (branch) {
    return { ...result, refusal: `The Core ${coreRoot} is on the branch ${JSON.stringify(branch)}, so it is somebody's working checkout -- the main Core, or a Core-paired task's own -- and not the detached Core that task worktrees share. It is never moved from here.` };
  }

  const refusals = plan.refusal === null ? [] : [plan.refusal];
  if (plan.checkout && !await containedByAnyRef(coreRoot, state.head)) {
    refusals.push(`The shared Core ${coreRoot} is at ${state.head}, which no branch or tag contains; moving it to ${target} would leave that commit reachable from nothing. Put a branch on it, or move the Core by hand.`);
  }
  if (refusals.length === 0 && !allowRunning && changes(result).length > 0) {
    const busy = await processesUsingRoots([coreRoot, ...sharers], { ...(processes ? { processes } : {}), ...(selfPid === undefined ? {} : { selfPid }) });
    if (busy.length > 0) {
      const named = busy.slice(0, 5).map((entry) => `${entry.name} (pid ${entry.pid})`).join(", ");
      refusals.push(`Bringing the shared Core ${coreRoot} to ${target} needs ${listed(changes(result))}, but ${busy.length} running process(es) are working inside it or a worktree that shares it, e.g. ${named}. That would change files they have loaded: wait for them to finish, pass --allow-running, or open the task under another --base, which gets a shared Core of its own.`);
      return { ...result, busy: busy.map(({ pid, name }) => ({ pid, name })), refusal: refusals.join(" ") };
    }
  }
  return { ...result, refusal: refusals.length === 0 ? null : refusals.join(" ") };
}

async function worktreesBeside(repositoryRoot, coreRoot) {
  const listing = await runGit(repositoryRoot, ["worktree", "list", "--porcelain"]);
  return listing.split(/\r?\n/u)
    .filter((line) => line.startsWith("worktree "))
    .map((line) => path.resolve(line.slice("worktree ".length).trim()))
    .filter((root) => samePath(path.dirname(root), path.dirname(path.resolve(coreRoot))));
}

async function containedByAnyRef(root, commit) {
  const refs = await runGit(root, ["for-each-ref", "--count=1", "--format=%(refname)", "--contains", commit, "refs/heads", "refs/tags", "refs/remotes"]);
  return refs.trim() !== "";
}

/**
 * Whether the shared Core has to be built again.
 *
 * The Lab's pair rebuilds whenever it cannot prove which commit produced
 * `dist`, because a campaign that measures the wrong build reports the wrong
 * product. The shared Core cannot be held to that standard, because nothing
 * writes a build marker when a developer builds Core by hand -- which is
 * exactly what the Lab's own stale-build refusal tells them to do. On
 * 2026-09-18 every Core checkout on this machine was in that state, so an
 * absent marker is the normal case, not a suspicious one: honouring it would
 * rebuild a correct Core on every call and refuse the whole move whenever
 * anything was running beside it.
 *
 * So a build is planned when the move itself invalidates the old one, when
 * there is no output at all, or when a marker positively names another commit.
 * A build wrong for some other reason is still caught before it can matter:
 * the Lab refuses to start a run whose Core `dist` is older than Core's source
 * (`scripts/lab/core/build/stale.mjs`).
 */
function rebuilds(plan, state) {
  if (!state.buildable) return false;
  return plan.checkout || !state.distPresent || (state.builtCommit !== null && state.builtCommit !== state.target);
}

/** What the move would actually do, in the words the refusal uses. */
function changes(plan) {
  return [
    ...plan.checkout ? ["a checkout"] : [],
    ...plan.install ? ["an install"] : [],
    ...plan.build ? ["a rebuild"] : [],
  ];
}

function listed(items) {
  return items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}
