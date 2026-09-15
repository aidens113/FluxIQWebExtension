import { mkdir } from "node:fs/promises";
import path from "node:path";
import { RunnerFailure } from "../failure.js";
import type { ProcessSpec, ProcessSupervisor } from "../process-supervisor.js";
import { acquireWorkspaceOperationLock, type WorkspaceOperationLock, type WorkspaceOperationLockOptions } from "../workspace-lock.js";
import { coreWebBuildEnvironment } from "./build-environment.js";
import { collectCoreWebBuildInputs } from "./inputs.js";
import { coreWebBuildKey } from "./key.js";
import { markBuildComplete, newBuildAttemptName, publishBuildAttempt, readBuildId, readPublishedCoreWebBuild } from "./publication.js";
import type { CoreWebBuild, CoreWebBuildInputs } from "./types.js";
import { prepareWebWorkspace } from "./workspace.js";

/** The cache's directory below a runs directory; the leading dot keeps run and bundle enumeration away from it. */
const CACHE_DIRECTORY_NAME = ".core-web-build";
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
  /** The runs directory whose `.core-web-build/<key>/` holds the cache. */
  runsDirectory: string;
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
  buildTimeoutMs: BUILD_TIMEOUT_MS,
  waitTimeoutMs: WAIT_TIMEOUT_MS,
  lockSettleMs: LOCK_SETTLE_MS,
  pollIntervalMs: LOCK_POLL_INTERVAL_MS,
};

type LockAttempt = { lock: WorkspaceOperationLock } | { busy: true } | { unreadable: unknown };

/**
 * Returns the published production build of Core's web panel for the current
 * Core inputs, building it first when none is published. Concurrent callers
 * sharing a runs directory build once: one takes the key's create-only lock,
 * which is reclaimed only from a verifiably dead owner, and the rest wait for
 * its publication. Every failure is a closed `RunnerFailure`; the build's own
 * output stays in its log.
 */
export async function prepareCoreWebBuild(options: CoreWebBuildOptions, overrides: Partial<CoreWebBuildDependencies> = {}): Promise<CoreWebBuild> {
  const dependencies: CoreWebBuildDependencies = { ...defaultDependencies, ...overrides };
  try {
    const { inputs, nextExecutable } = await dependencies.collectInputs(options.fluxiqRepositoryRoot);
    const key = coreWebBuildKey(inputs);
    const keyDirectory = path.join(path.resolve(options.runsDirectory), CACHE_DIRECTORY_NAME, key);
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
