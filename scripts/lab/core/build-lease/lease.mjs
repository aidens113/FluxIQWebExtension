// Hold the builder's own locks, rather than a Lab-only flag a build ignores.
// Resolve them with the exact Core checkout's registry, never a copied path.
import { closeSync, existsSync, futimesSync, openSync, readFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { CORE_PACKAGES, coreCacheOwnsBuild } from "../../../worktree/index.mjs";

/**
 * Acquires every Core library's real build lock before the caller reads Core.
 * Heartbeats start for each lock immediately, including while the next waits.
 * Normal release is asynchronous; exit cleanup is synchronous and token-owned.
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
  const { resolveStep, acquireStepLock } = await import(pathToFileURL(path.join(coreRoot, "scripts/build-cache/index.mjs")).href);
  if (typeof resolveStep !== "function" || typeof acquireStepLock !== "function") throw new Error(`Core build lease unsupported: missing owning resolver or lock API in ${coreRoot}`);
  const held = [];
  let released = false;
  let lost = null;
  const exit = () => {
    for (const item of held.toReversed()) {
      clearInterval(item.timer);
      try {
        if (JSON.parse(readFileSync(item.path, "utf8")).token === item.token) unlinkSync(item.path);
      } catch { /* best-effort: exit cleanup never deletes an unreadable or replaced lock; dead ownership remains recoverable by Core. */ }
      closeSync(item.fd);
    }
  };
  process.once("exit", exit);
  const release = async () => {
    if (released) return;
    released = true;
    process.removeListener("exit", exit);
    const results = await Promise.allSettled(held.toReversed().map(async (item) => {
      clearInterval(item.timer);
      closeSync(item.fd);
      await item.lock.release();
    }));
    const failed = results.find((result) => result.status === "rejected");
    if (failed) throw failed.reason;
  };
  try {
    for (const item of CORE_PACKAGES) {
      const step = `${item.directory}:build`;
      const resolved = resolveStep(step, { repoRoot: coreRoot, env });
      const lockPath = `${resolved.stampPath}.lock`;
      const lock = await acquireStepLock(lockPath, options.lock);
      let fd;
      try {
        fd = openSync(lockPath, "r+");
        const owner = JSON.parse(readFileSync(fd, "utf8"));
        if (owner.pid !== process.pid || typeof owner.token !== "string") throw new Error(`Core build lease lost ownership of ${step}`);
        const record = { path: lockPath, token: owner.token, fd, lock, timer: null };
        held.push(record);
        record.timer = setInterval(() => {
          try {
            if (JSON.parse(readFileSync(lockPath, "utf8")).token !== record.token) throw new Error(`Core build lease replaced: ${step}`);
            const now = new Date();
            futimesSync(record.fd, now, now);
          } catch (error) {
            lost ??= new Error(`Core build lease heartbeat failed for ${step}`, { cause: error });
            clearInterval(record.timer);
            options.onLost?.(lost);
          }
        }, heartbeatMs);
        record.timer.unref();
      } catch (error) {
        if (fd !== undefined && !held.some((record) => record.fd === fd)) closeSync(fd);
        await lock.release();
        throw error;
      }
      options.onAcquired?.(step, lock.waitedMs);
    }
    return { release, assertHeld() { if (lost) throw lost; } };
  } catch (error) {
    await release();
    throw error;
  }
}
