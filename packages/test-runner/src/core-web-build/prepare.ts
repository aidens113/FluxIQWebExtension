import { mkdir } from "node:fs/promises";
import path from "node:path";
import { RunnerFailure } from "../failure.js";
import type { ProcessSpec, ProcessSupervisor } from "../process-supervisor.js";
import { acquireWorkspaceOperationLock, type WorkspaceOperationLock, type WorkspaceOperationLockOptions } from "../workspace-lock.js";
import { coreWebBuildEnvironment } from "./build-environment.js";
import { coreWebBuildCacheRoot } from "./cache-root.js";
import { collectCoreWebBuildInputs } from "./inputs.js";
import { coreWebBuildKey } from "./key.js";
import { coreWebBuildPathBudget, WINDOWS_PATH_LIMIT, type CoreWebBuildPathBudget } from "./path-budget.js";
import { markBuildComplete, newBuildAttemptName, publishBuildAttempt, readBuildId, readPublishedCoreWebBuild } from "./publication.js";
import type { CoreWebBuild, CoreWebBuildInputs } from "./types.js";
import { prepareWebWorkspace } from "./workspace.js";

const BUILD_PROCESS_NAME = "core-web-build";
/** The one-off build's own bound. No earlier bound is widened: the build step did not exist before. */
const BUILD_TIMEOUT_MS = 600_000;
/** A waiter outlasts one whole build by the lock holder, plus the holder's staging copy. */
const WAIT_TIMEOUT_MS = BUILD_TIMEOUT_MS + 120_000;
const LOCK_POLL_INTERVAL_MS = 1_000;
/**
 * `workspace-lock.ts` creates its file and then writes the owner record, so a
 * waiter can briefly read an empty lock. A lock that stays unreadable this long
 * is a real fault, and fails closed.
 */
const LOCK_SETTLE_MS = 10_000;

export type CoreWebBuildOptions = {
  fluxiqRepositoryRoot: string;
  /**
   * Where published builds are cached. Defaults to the one place every checkout
   * of this Core agrees on (`cache-root.ts`), which is what lets worktrees
   * sharing a Core share one build and one lock.
   */
  cacheRoot?: string;
  /** Owns the build child, so a run's cleanup stops a build it started. */
  supervisor: ProcessSupervisor;
  /** Where the build's output goes, when this caller is the one that builds. */
  logPath: string;
  signal?: AbortSignal;
};

export type CoreWebBuildDependencies = {
  collectInputs: (fluxiqRepositoryRoot: string) => Promise<{ inputs: CoreWebBuildInputs; nextExecutable: string }>;
  stageWorkspace: (fluxiqRepositoryRoot: string, webDirectory: string) => Promise<unknown>;
  runBuild: (supervisor: ProcessSupervisor, spec: ProcessSpec, timeoutMs: number) => Promise<void>;
  lock: WorkspaceOperationLockOptions;
  /**
   * Whether the cache root leaves room for the build. A collaborator because
   * the deepest path is measured from a REAL Next build, and the tests about
   * locking and publication fake the build and run below whatever
   * `os.tmpdir()` is on the machine -- 84 characters here, which the real
   * budget rightly refuses. Path length has tests of its own.
   */
  pathBudget: (cacheRoot: string) => CoreWebBuildPathBudget;
  buildTimeoutMs: number;
  waitTimeoutMs: number;
  lockSettleMs: number;
  pollIntervalMs: number;
};

const defaultDependencies: CoreWebBuildDependencies = {
  collectInputs: root => collectCoreWebBuildInputs(root),
  stageWorkspace: prepareWebWorkspace,
  runBuild: (supervisor, spec, timeoutMs) => supervisor.run(spec, timeoutMs),
  lock: {},
  pathBudget: cacheRoot => coreWebBuildPathBudget(cacheRoot),
  buildTimeoutMs: BUILD_TIMEOUT_MS,
  waitTimeoutMs: WAIT_TIMEOUT_MS,
  lockSettleMs: LOCK_SETTLE_MS,
  pollIntervalMs: LOCK_POLL_INTERVAL_MS,
};

type LockAttempt = { lock: WorkspaceOperationLock } | { busy: true } | { unreadable: unknown };

/**
 * Returns the published production build of Core's web panel for the current
 * Core inputs, building it first when none is published. Concurrent callers
 * sharing a Core build once, wherever their runs directories are: one takes the key's create-only lock,
 * which is reclaimed only from a verifiably dead owner, and the rest wait for
 * its publication. Every failure is a closed `RunnerFailure`; the build's own
 * output stays in its log.
 */
export async function prepareCoreWebBuild(options: CoreWebBuildOptions, overrides: Partial<CoreWebBuildDependencies> = {}): Promise<CoreWebBuild> {
  const dependencies: CoreWebBuildDependencies = { ...defaultDependencies, ...overrides };
  try {
    // Asked first, before Core is even hashed: a cache root too long for this
    // filesystem cannot hold the build whatever the inputs are, and the point
    // of asking is to answer in a sentence about path length rather than as a
    // Turbopack internal error partway through a build.
    const cacheRoot = options.cacheRoot ? path.resolve(options.cacheRoot) : coreWebBuildCacheRoot(options.fluxiqRepositoryRoot);
    const budget = dependencies.pathBudget(cacheRoot);
    if (!budget.fits) {
      throw new RunnerFailure("environment.missing", `The Core web build cache path is too long for this filesystem: ${cacheRoot} is ${budget.root} characters and the deepest file Next writes below it needs ${budget.longest}, over the ${WINDOWS_PATH_LIMIT}-character limit. Point FLUXIQ_CORE_WEB_BUILD_CACHE at a short directory (for example F:\\fxcache) -- at most ${budget.allowed} characters.`, { details: { process: BUILD_PROCESS_NAME, cacheRoot, ...budget } });
    }
    const { inputs, nextExecutable } = await dependencies.collectInputs(options.fluxiqRepositoryRoot);
    const key = coreWebBuildKey(inputs);
    const keyDirectory = path.join(cacheRoot, key);
    await mkdir(keyDirectory, { recursive: true });
    const deadline = Date.now() + dependencies.waitTimeoutMs;
    let unreadableSince: number | undefined;
    for (;;) {
      const published = await readPublishedCoreWebBuild(keyDirectory, key, nextExecutable);
      if (published) return published;
      options.signal?.throwIfAborted();
      const attempt = await tryAcquireBuildLock(keyDirectory, dependencies.lock);
      if ("lock" in attempt) return await buildUnderLock(attempt.lock, options, dependencies, key, keyDirectory, nextExecutable);
      if ("unreadable" in attempt) {
        unreadableSince ??= Date.now();
        if (Date.now() - unreadableSince >= dependencies.lockSettleMs) {
          throw new RunnerFailure("process.startup", "Core web build lock could not be taken, and is never reclaimed automatically", { cause: attempt.unreadable, details: { process: BUILD_PROCESS_NAME, timeoutMs: dependencies.lockSettleMs } });
        }
      } else {
        unreadableSince = undefined;
      }
      if (Date.now() >= deadline) {
        throw new RunnerFailure("process.startup", "Timed out waiting for another Lab process to build the Core web panel", { details: { process: BUILD_PROCESS_NAME, timeoutMs: dependencies.waitTimeoutMs } });
      }
      await pause(dependencies.pollIntervalMs, options.signal);
    }
  } catch (error) {
    if (error instanceof RunnerFailure) throw error;
    throw new RunnerFailure("process.startup", "Core web panel production build could not be prepared", { cause: error, details: { process: BUILD_PROCESS_NAME } });
  }
}

async function buildUnderLock(lock: WorkspaceOperationLock, options: CoreWebBuildOptions, dependencies: CoreWebBuildDependencies, key: string, keyDirectory: string, nextExecutable: string): Promise<CoreWebBuild> {
  let build: CoreWebBuild;
  try {
    build = await readPublishedCoreWebBuild(keyDirectory, key, nextExecutable) ?? await buildAndPublish(options, dependencies, key, keyDirectory, nextExecutable);
  } catch (error) {
    await lock.release().catch(() => undefined);
    throw error;
  }
  await lock.release();
  return build;
}

async function buildAndPublish(options: CoreWebBuildOptions, dependencies: CoreWebBuildDependencies, key: string, keyDirectory: string, nextExecutable: string): Promise<CoreWebBuild> {
  const attempt = newBuildAttemptName();
  const directory = path.join(keyDirectory, attempt);
  const webDirectory = path.join(directory, "apps", "web");
  const fluxiqRoot = path.join(directory, "fluxiq-root");
  // Create-only: an attempt never shares its directory with another.
  await mkdir(directory);
  await mkdir(webDirectory, { recursive: true });
  await mkdir(path.join(fluxiqRoot, ".fluxiq"), { recursive: true });
  await dependencies.stageWorkspace(options.fluxiqRepositoryRoot, webDirectory);
  try {
    await dependencies.runBuild(options.supervisor, {
      name: BUILD_PROCESS_NAME,
      command: nextExecutable,
      args: ["build", "--turbopack"],
      cwd: webDirectory,
      shell: process.platform === "win32",
      env: coreWebBuildEnvironment(fluxiqRoot),
      logPath: options.logPath,
    }, dependencies.buildTimeoutMs);
  } catch (cause) {
    throw new RunnerFailure("process.startup", "Core web panel production build did not succeed", { cause, details: { process: BUILD_PROCESS_NAME } });
  }
  const buildId = await readBuildId(webDirectory);
  if (!buildId) throw new RunnerFailure("process.startup", "Core web panel production build left no build id", { details: { process: BUILD_PROCESS_NAME } });
  await markBuildComplete(directory, key, buildId);
  await publishBuildAttempt(keyDirectory, key, attempt);
  return { key, directory, webDirectory, nextExecutable, buildId };
}

/**
 * The key's lock; `busy` while a live owner holds it or it was released
 * between this caller's create and its read; `unreadable` for anything else,
 * which the caller tolerates only briefly.
 */
async function tryAcquireBuildLock(keyDirectory: string, options: WorkspaceOperationLockOptions): Promise<LockAttempt> {
  const isProcessAlive = options.isProcessAlive ?? processIsAlive;
  let liveOwner = false;
  try {
    return { lock: await acquireWorkspaceOperationLock(keyDirectory, { ...options, isProcessAlive: async pid => (liveOwner = await isProcessAlive(pid)) }) };
  } catch (error) {
    return liveOwner || hasCode(error, "ENOENT") ? { busy: true } : { unreadable: error };
  }
}

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return !hasCode(error, "ESRCH");
  }
}

function pause(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(signal.reason); return; }
    const onAbort = () => { clearTimeout(timer); reject(signal?.reason); };
    const timer = setTimeout(() => { signal?.removeEventListener("abort", onAbort); resolve(); }, milliseconds);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function hasCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}
