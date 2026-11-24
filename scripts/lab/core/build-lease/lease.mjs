// Hold the builder's own locks, rather than a Lab-only flag a build ignores.
// Resolve them with the exact Core checkout's registry, never a copied path.
//
// A Lab run only reads Core's libraries, so it holds each one's step lock as a
// reader (Core's `acquireStepReadLock`): any number of runs share one Core
// checkout, while a build of a library waits until every run reading it has
// left, and a run waits while a build writes or is waiting to.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { CORE_PACKAGES, coreCacheOwnsBuild } from "../../../worktree/index.mjs";

/**
 * Acquires a shared read hold on every Core library's real build lock before
 * the caller reads Core. Core heartbeats each hold from the moment it is
 * acquired, including while the next is waited for. Normal release is
 * asynchronous; exit cleanup is synchronous and token-owned.
 * @param {string} coreRoot
 * @param {{ env?: NodeJS.ProcessEnv, heartbeatMs?: number, lock?: object, onLost?: (error: Error) => void, onAcquired?: (step: string, waitedMs: number) => void }} [options]
 */
export async function acquireCoreBuildLease(coreRoot, options = {}) {
  const env = options.env ?? process.env;
  const heartbeatMs = options.heartbeatMs ?? 30_000;
  if (!Number.isFinite(heartbeatMs) || heartbeatMs <= 0 || heartbeatMs >= 30 * 60 * 1000) throw new Error("Core build lease heartbeat must be positive and shorter than the builder's 30-minute stale bound");
  for (const item of CORE_PACKAGES) {
    if (!coreCacheOwnsBuild(coreRoot, item)) throw new Error(`Core build lease unsupported: ${item.filter} does not use Core's build cache in ${coreRoot}`);
  }
  if (!existsSync(path.join(coreRoot, ".git"))) throw new Error(`Core build lease requires a Git checkout: ${coreRoot}`);
  const { resolveStep, acquireStepReadLock } = await import(pathToFileURL(path.join(coreRoot, "scripts/build-cache/index.mjs")).href);
  if (typeof resolveStep !== "function" || typeof acquireStepReadLock !== "function") throw new Error(`Core build lease unsupported: missing owning resolver or shared read lock API in ${coreRoot}`);
  const held = [];
  let released = false;
  let lost = null;
  const exit = () => {
    for (const item of held.toReversed()) item.lock.releaseSync();
  };
  process.once("exit", exit);
  const release = async () => {
    if (released) return;
    released = true;
    process.removeListener("exit", exit);
    const results = await Promise.allSettled(held.toReversed().map((item) => item.lock.release()));
    const failed = results.find((result) => result.status === "rejected");
    if (failed) throw failed.reason;
  };
  try {
    for (const item of CORE_PACKAGES) {
      const step = `${item.directory}:build`;
      const resolved = resolveStep(step, { repoRoot: coreRoot, env });
      const lock = await acquireStepReadLock(`${resolved.stampPath}.lock`, {
        ...options.lock,
        heartbeatMs,
        onLost: (error) => {
          if (lost) return;
          lost = new Error(`Core build lease heartbeat failed for ${step}`, { cause: error });
          options.onLost?.(lost);
        }
      });
      held.push({ step, lock });
      const owner = JSON.parse(readFileSync(lock.path, "utf8"));
      if (owner.pid !== process.pid || owner.token !== lock.token) throw new Error(`Core build lease lost ownership of ${step}`);
      options.onAcquired?.(step, lock.waitedMs);
    }
    return { release, assertHeld() { if (lost) throw lost; } };
  } catch (error) {
    await release();
    throw error;
  }
}
