// One repository-wide lock around the Lab's build phase.
//
// Concurrent Lab instances each build before they run. The extension, scenario
// lab, and host outputs are per-instance, but the workspace TypeScript builds
// (domain, test-contracts, test-evidence, test-runner) still write shared
// package `dist/` directories, and two `tsc` processes writing the same file
// can be read torn by a third. Serializing the build phase removes that
// window without serializing the runs themselves: an instance holds the lock
// only while it builds, then releases it and runs in parallel with the rest.
//
// The lock waits rather than failing, because waiting for a sibling's build is
// the normal case. A lock whose recorded process is gone, or whose record is
// unreadable, is reclaimed: this guards a build, not a security boundary.

import { mkdir, open, readFile, rm } from "node:fs/promises";
import path from "node:path";

/**
 * Runs `body` while holding the build lock at `lockPath`.
 *
 * @template T
 * @param {string} lockPath
 * @param {() => Promise<T>} body
 * @param {{ pollMs?: number; timeoutMs?: number; pid?: number; isProcessAlive?: (pid: number) => boolean; onWait?: (owner: { pid: number } | null) => void }} [options]
 * @returns {Promise<T>}
 */
export async function withBuildLock(lockPath, body, options = {}) {
  const pollMs = options.pollMs ?? 500;
  const timeoutMs = options.timeoutMs ?? 45 * 60_000;
  const isProcessAlive = options.isProcessAlive ?? nativeProcessIsAlive;
  const record = { pid: options.pid ?? process.pid, acquiredAt: new Date().toISOString() };
  await mkdir(path.dirname(lockPath), { recursive: true });
  const deadline = Date.now() + timeoutMs;
  let announced = false;

  for (;;) {
    try {
      const handle = await open(lockPath, "wx", 0o600);
      try {
        await handle.writeFile(`${JSON.stringify(record)}\n`, "utf8");
      } finally {
        await handle.close();
      }
      break;
    } catch (error) {
      if (!hasCode(error, "EEXIST")) throw error;
    }
    const owner = await readOwner(lockPath);
    if (owner === null || !isProcessAlive(owner.pid)) {
      await rm(lockPath, { force: true });
      continue;
    }
    if (Date.now() > deadline) {
      throw new Error(`Timed out waiting ${Math.round(timeoutMs / 1000)}s for the Lab build lock held by process ${owner.pid} (${lockPath})`);
    }
    if (!announced) {
      announced = true;
      options.onWait?.(owner);
    }
    await new Promise(resolve => setTimeout(resolve, pollMs));
  }

  try {
    return await body();
  } finally {
    const current = await readOwner(lockPath);
    if (current !== null && current.pid === record.pid && current.acquiredAt === record.acquiredAt) {
      await rm(lockPath, { force: true });
    }
  }
}

/** @returns {Promise<{ pid: number; acquiredAt: string } | null>} */
async function readOwner(lockPath) {
  let text;
  try {
    text = await readFile(lockPath, "utf8");
  } catch (error) {
    if (hasCode(error, "ENOENT")) return null;
    throw error;
  }
  try {
    const value = JSON.parse(text);
    if (typeof value?.pid !== "number" || !Number.isSafeInteger(value.pid) || value.pid <= 0) return null;
    if (typeof value?.acquiredAt !== "string") return null;
    return { pid: value.pid, acquiredAt: value.acquiredAt };
  } catch {
    return null;
  }
}

function nativeProcessIsAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return !hasCode(error, "ESRCH");
  }
}

function hasCode(error, code) {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}
