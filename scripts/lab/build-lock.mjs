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
//
// **A holder that dies without releasing is reclaimed by its heartbeat, not by
// its pid.** Checking only whether the pid is alive is wrong after a crash,
// because the operating system reuses pids: on 2026-09-24 a campaign died with
// the machine, its lock kept `{"pid":2656}`, and the next campaign's own node
// process was handed pid 2656 -- so it waited on itself. It printed one line
// and sat there. Nothing was broken and nothing was building; the run simply
// never started, and would have waited out the full 45-minute timeout.
//
// So the holder rewrites the record every `heartbeatMs` while it builds, and a
// waiter reclaims a lock whose heartbeat has gone stale, whatever the pid says.
// A crashed holder stops writing, so the lock frees itself within a few beats
// rather than at the timeout. The pid check stays as the fast path: a holder
// that exited cleanly enough for its pid to be gone is still reclaimed at once.

import { mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Runs `body` while holding the build lock at `lockPath`.
 *
 * @template T
 * @param {string} lockPath
 * @param {() => Promise<T>} body
 * @param {{ pollMs?: number; timeoutMs?: number; pid?: number; heartbeatMs?: number; staleAfterMs?: number; now?: () => number; isProcessAlive?: (pid: number) => boolean; onWait?: (owner: { pid: number } | null) => void }} [options]
 * @returns {Promise<T>}
 */
export async function withBuildLock(lockPath, body, options = {}) {
  const pollMs = options.pollMs ?? 500;
  const timeoutMs = options.timeoutMs ?? 45 * 60_000;
  const heartbeatMs = options.heartbeatMs ?? 5_000;
  // Six missed beats. Generous on purpose: a machine building four TypeScript
  // projects at once can starve a timer for a while, and reclaiming a lock from
  // a holder that is merely busy is the one outcome worse than waiting.
  const staleAfterMs = options.staleAfterMs ?? heartbeatMs * 6;
  const now = options.now ?? Date.now;
  const isProcessAlive = options.isProcessAlive ?? nativeProcessIsAlive;
  const record = { pid: options.pid ?? process.pid, acquiredAt: new Date(now()).toISOString(), heartbeatAt: new Date(now()).toISOString() };
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
    // A record too old to have been written by anything still building. This is
    // the clause that survives a pid the operating system handed out again.
    const beat = owner === null ? 0 : Date.parse(owner.heartbeatAt ?? owner.acquiredAt);
    const stale = owner !== null && (!Number.isFinite(beat) || now() - beat > staleAfterMs);
    if (owner === null || !isProcessAlive(owner.pid) || stale) {
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

  // Written while the build runs, so a waiter can tell this holder from a dead
  // one. `unref` so a beat is never what keeps the process alive.
  const beatPath = lockPath + '.beat';
  const beating = setInterval(() => {
    void (async () => {
      const held = await readOwner(lockPath);
      if (held === null || held.pid !== record.pid || held.acquiredAt !== record.acquiredAt) return;
      record.heartbeatAt = new Date(now()).toISOString();
      try {
        // Written beside the lock and renamed over it, never rewritten in
        // place. A waiter reads this file whenever it finds one, and an
        // in-place rewrite leaves a window where it reads a truncated record,
        // cannot parse it, and reclaims a lock that is very much held -- which
        // is what the first version of this heartbeat did, and what the test
        // 'a holder that keeps beating is not reclaimed' caught. A rename is
        // atomic, so a waiter sees the old record or the new one, never half.
        await writeFile(beatPath, JSON.stringify(record) + "\n", "utf8");
        await rename(beatPath, lockPath);
      } catch {
        // best-effort: a beat that cannot be written leaves the lock looking
        // stale, which frees a build rather than blocking one, and this holder
        // still owns its own release below.
      }
    })();
  }, heartbeatMs);
  beating.unref?.();

  try {
    return await body();
  } finally {
    clearInterval(beating);
    await rm(beatPath, { force: true });
    const current = await readOwner(lockPath);
    if (current !== null && current.pid === record.pid && current.acquiredAt === record.acquiredAt) {
      await rm(lockPath, { force: true });
    }
  }
}

/** @returns {Promise<{ pid: number; acquiredAt: string; heartbeatAt?: string } | null>} */
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
    // A record written before heartbeats existed has no beat, so `acquiredAt`
    // stands in for one: an old lock left behind is judged by its age rather
    // than taken for fresh.
    return { pid: value.pid, acquiredAt: value.acquiredAt, ...(typeof value?.heartbeatAt === "string" ? { heartbeatAt: value.heartbeatAt } : {}) };
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
