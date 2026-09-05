import { randomBytes } from "node:crypto";
import { lstat, open, readFile, rename, rm, stat } from "node:fs/promises";
import path from "node:path";

const LOCK_FILE_NAME = ".operation.lock";
const LOCK_SCHEMA_VERSION = 1;
const MAX_LOCK_BYTES = 4_096;

type LockOwner = {
  schemaVersion: 1;
  pid: number;
  ownerToken: string;
  acquiredAt: string;
};

export type WorkspaceOperationLock = {
  path: string;
  ownerToken: string;
  ownerPid: number;
  release(): Promise<void>;
};

export type WorkspaceOperationLockOptions = {
  pid?: number;
  now?: () => Date;
  isProcessAlive?: (pid: number) => boolean | Promise<boolean>;
};

/**
 * Takes an exclusive, process-owned lock for a persistent workspace. A lock is
 * reclaimed only when its record is valid and its recorded PID is confirmed
 * absent. Unknown process state and malformed records fail closed.
 */
export async function acquireWorkspaceOperationLock(
  workspaceRoot: string,
  options: WorkspaceOperationLockOptions = {},
): Promise<WorkspaceOperationLock> {
  const resolvedWorkspace = path.resolve(workspaceRoot);
  const lockPath = path.join(resolvedWorkspace, LOCK_FILE_NAME);
  if (path.dirname(lockPath) !== resolvedWorkspace) throw new Error("Workspace lock escaped its workspace");
  const workspaceDetails = await lstat(resolvedWorkspace);
  if (!workspaceDetails.isDirectory() || workspaceDetails.isSymbolicLink()) {
    throw new Error("Persistent workspace root is not a directly owned directory");
  }

  const pid = options.pid ?? process.pid;
  if (!Number.isSafeInteger(pid) || pid <= 0) throw new Error("Workspace lock owner PID must be a positive integer");
  const isProcessAlive = options.isProcessAlive ?? nativeProcessIsAlive;
  const owner: LockOwner = {
    schemaVersion: LOCK_SCHEMA_VERSION,
    pid,
    ownerToken: randomBytes(24).toString("base64url"),
    acquiredAt: (options.now ?? (() => new Date()))().toISOString(),
  };

  for (;;) {
    try {
      const handle = await open(lockPath, "wx", 0o600);
      try {
        await handle.writeFile(`${JSON.stringify(owner)}\n`, "utf8");
        await handle.sync();
      } catch (error) {
        await handle.close().catch(() => undefined);
        await rm(lockPath, { force: true }).catch(() => undefined);
        throw error;
      }
      await handle.close();
      return {
        path: lockPath,
        ownerToken: owner.ownerToken,
        ownerPid: owner.pid,
        release: () => releaseOwnedLock(lockPath, owner),
      };
    } catch (error) {
      if (!hasCode(error, "EEXIST")) throw error;
    }

    const existing = await readOwner(lockPath);
    if (await isProcessAlive(existing.pid)) {
      throw new Error(`Persistent workspace is already locked by live process ${existing.pid}`);
    }
    await reclaimStaleLock(lockPath, existing);
  }
}

async function releaseOwnedLock(lockPath: string, owner: LockOwner): Promise<void> {
  const releasePath = `${lockPath}.release-${owner.ownerToken}`;
  try {
    await rename(lockPath, releasePath);
  } catch (error) {
    if (hasCode(error, "ENOENT")) return;
    throw error;
  }
  let current: LockOwner;
  try {
    current = await readOwner(releasePath);
  } catch (error) {
    await restoreChangedLock(releasePath, lockPath);
    throw error;
  }
  if (!sameOwner(current, owner)) {
    await restoreChangedLock(releasePath, lockPath);
    throw new Error("Persistent workspace lock ownership changed before release");
  }
  await rm(releasePath);
}

async function reclaimStaleLock(lockPath: string, expected: LockOwner): Promise<void> {
  const quarantinePath = `${lockPath}.stale-${randomBytes(12).toString("hex")}`;
  try {
    await rename(lockPath, quarantinePath);
  } catch (error) {
    if (hasCode(error, "ENOENT")) return;
    throw error;
  }

  try {
    const quarantined = await readOwner(quarantinePath);
    if (!sameOwner(quarantined, expected)) {
      await restoreChangedLock(quarantinePath, lockPath);
      throw new Error("Persistent workspace lock changed while stale ownership was being verified");
    }
    await rm(quarantinePath);
  } catch (error) {
    if (!hasCode(error, "ENOENT")) throw error;
  }
}

async function restoreChangedLock(quarantinePath: string, lockPath: string): Promise<void> {
  try {
    await rename(quarantinePath, lockPath);
  } catch (error) {
    throw new Error("Could not safely restore a concurrently changed workspace lock", { cause: error });
  }
}

async function readOwner(lockPath: string): Promise<LockOwner> {
  const details = await stat(lockPath);
  if (!details.isFile() || details.size <= 0 || details.size > MAX_LOCK_BYTES) {
    throw new Error("Persistent workspace lock is malformed; refusing stale-lock reclamation");
  }
  let value: unknown;
  try {
    value = JSON.parse(await readFile(lockPath, "utf8"));
  } catch (error) {
    if (hasCode(error, "ENOENT")) throw error;
    throw new Error("Persistent workspace lock is malformed; refusing stale-lock reclamation", { cause: error });
  }
  if (!isOwner(value)) throw new Error("Persistent workspace lock is malformed; refusing stale-lock reclamation");
  return value;
}

function isOwner(value: unknown): value is LockOwner {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).sort().join(",") !== "acquiredAt,ownerToken,pid,schemaVersion") return false;
  return record.schemaVersion === LOCK_SCHEMA_VERSION
    && Number.isSafeInteger(record.pid)
    && (record.pid as number) > 0
    && typeof record.ownerToken === "string"
    && /^[A-Za-z0-9_-]{32}$/u.test(record.ownerToken)
    && typeof record.acquiredAt === "string"
    && Number.isFinite(Date.parse(record.acquiredAt));
}

function sameOwner(left: LockOwner, right: LockOwner): boolean {
  return left.schemaVersion === right.schemaVersion
    && left.pid === right.pid
    && left.ownerToken === right.ownerToken
    && left.acquiredAt === right.acquiredAt;
}

function nativeProcessIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return !hasCode(error, "ESRCH");
  }
}

function hasCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}
