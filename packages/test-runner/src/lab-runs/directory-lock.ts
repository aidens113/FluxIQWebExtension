import { mkdir, rm, stat } from "node:fs/promises";

export type DirectoryLockOptions = {
  /** A lock older than this is a holder that died; it is taken over. */
  staleMs?: number;
  /** How long to wait for a live holder before doing the work anyway. */
  timeoutMs?: number;
  pollMs?: number;
  log?: (line: string) => void;
};

const STALE_MS = 30_000;
const TIMEOUT_MS = 15_000;
const POLL_MS = 50;

/**
 * Runs `work` while holding `lockPath`, a directory whose creation is the lock:
 * `mkdir` either creates it or fails, atomically, across every process on the
 * machine. A lock older than `staleMs` is removed and taken. A holder still
 * alive after `timeoutMs` is waited out no longer: the work runs anyway,
 * because the index it guards is regenerated from scratch every time and the
 * next regeneration repairs whatever a race cost.
 */
export async function withDirectoryLock<T>(lockPath: string, work: () => Promise<T>, options: DirectoryLockOptions = {}): Promise<T> {
  const held = await acquire(lockPath, options);
  try {
    return await work();
  } finally {
    if (held) await rm(lockPath, { recursive: true, force: true });
  }
}

async function acquire(lockPath: string, options: DirectoryLockOptions): Promise<boolean> {
  const staleMs = options.staleMs ?? STALE_MS;
  const giveUpAt = Date.now() + (options.timeoutMs ?? TIMEOUT_MS);
  for (;;) {
    try {
      await mkdir(lockPath);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
    const age = await lockAge(lockPath);
    if (age !== null && age > staleMs) {
      await rm(lockPath, { recursive: true, force: true });
      continue;
    }
    if (Date.now() >= giveUpAt) {
      options.log?.(`[lab runs] ${lockPath} is still held after ${options.timeoutMs ?? TIMEOUT_MS} ms; writing without it`);
      return false;
    }
    await new Promise(resolve => setTimeout(resolve, options.pollMs ?? POLL_MS));
  }
}

/** How old the lock is, in ms, or `null` when it was released between the attempt and this look. */
async function lockAge(lockPath: string): Promise<number | null> {
  try {
    return Date.now() - (await stat(lockPath)).mtimeMs;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
