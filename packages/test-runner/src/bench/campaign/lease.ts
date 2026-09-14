import { createHash, randomBytes } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, readFile, rename, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { createDurableJson, type DurableFileSystem } from "../durable-file.js";

const LEASE_SCHEMA_VERSION = "0.1" as const;
const SAFE_ID = /^[A-Za-z0-9_-]{16,96}$/u;
const CONTENTION_ERRORS = new Set(["EACCES", "EBUSY", "EEXIST", "ENOTEMPTY", "EPERM"]);
const RECOVERY_ATTEMPTS = 8;
const execFileAsync = promisify(execFile);

export type CampaignLeaseOwner = Readonly<{
  schemaVersion: typeof LEASE_SCHEMA_VERSION;
  leaseId: string;
  pid: number;
  bootIdentitySha256: string;
  processIdentitySha256: string;
  acquiredAt: string;
}>;

export type CampaignLeaseProcessProbe = {
  bootIdentity(): Promise<string>;
  processIdentity(pid: number): Promise<string | null>;
};

export type CampaignLeaseFileSystem = {
  mkdir(directory: string, options: { recursive?: boolean }): Promise<string | undefined | void>;
  readFile(file: string, encoding: "utf8"): Promise<string>;
  rename(source: string, destination: string): Promise<void>;
  remove(target: string, options: { recursive: true; force: true }): Promise<void>;
  durableFileSystem?: DurableFileSystem;
};

export type CampaignLeaseOptions = {
  fileSystem?: CampaignLeaseFileSystem;
  processProbe?: CampaignLeaseProcessProbe;
  processId?: number;
  now?: () => Date;
  randomId?: () => string;
  sleep?: (milliseconds: number) => Promise<void>;
  recoveryAttempts?: number;
};

export type CampaignLease = Readonly<{
  owner: CampaignLeaseOwner;
  assertOwned(): Promise<void>;
  release(): Promise<void>;
}>;

export class CampaignLeaseHeldError extends Error {
  constructor(readonly owner: CampaignLeaseOwner) {
    super(`Benchmark campaign is already owned by live process ${owner.pid} since ${owner.acquiredAt}`);
    this.name = "CampaignLeaseHeldError";
  }
}

const nativeFileSystem: CampaignLeaseFileSystem = {
  mkdir: (directory, options) => mkdir(directory, options),
  readFile,
  rename,
  remove: (target, options) => rm(target, options),
};

/**
 * Acquires exclusive ownership of one campaign. The fully synced owner record is
 * prepared before its directory is atomically published, so observers never see
 * a half-written lease. Dead, rebooted, and PID-reused owners are archived.
 */
export async function acquireCampaignLease(campaignDirectory: string, options: CampaignLeaseOptions = {}): Promise<CampaignLease> {
  const root = path.resolve(campaignDirectory);
  const fileSystem = options.fileSystem ?? nativeFileSystem;
  const probe = options.processProbe ?? defaultCampaignLeaseProcessProbe;
  const pid = options.processId ?? process.pid;
  if (!Number.isSafeInteger(pid) || pid < 1) throw new Error("Campaign lease process id must be a positive safe integer");
  const leaseId = (options.randomId ?? (() => randomBytes(18).toString("base64url")))();
  if (!SAFE_ID.test(leaseId)) throw new Error("Campaign lease id is unsafe");
  const now = options.now ?? (() => new Date());
  const acquiredAt = now().toISOString();
  if (Number.isNaN(Date.parse(acquiredAt))) throw new Error("Campaign lease clock returned an invalid date");
  const bootIdentity = await probe.bootIdentity();
  const processIdentity = await probe.processIdentity(pid);
  if (!bootIdentity || !processIdentity) throw new Error("Cannot establish the current process identity for a campaign lease");
  const owner: CampaignLeaseOwner = {
    schemaVersion: LEASE_SCHEMA_VERSION,
    leaseId,
    pid,
    bootIdentitySha256: digest(bootIdentity),
    processIdentitySha256: digest(processIdentity),
    acquiredAt,
  };

  await fileSystem.mkdir(root, { recursive: true });
  const leaseDirectory = inside(root, "lease");
  const historyDirectory = inside(root, "lease-history");
  const candidateDirectory = inside(root, `.lease-candidate-${leaseId}`);
  await fileSystem.mkdir(historyDirectory, { recursive: true });
  await fileSystem.mkdir(candidateDirectory, { recursive: false });
  try {
    await createDurableJson(path.join(candidateDirectory, "owner.json"), owner, {
      ...(fileSystem.durableFileSystem ? { fileSystem: fileSystem.durableFileSystem } : {}),
    });
    const attempts = options.recoveryAttempts ?? RECOVERY_ATTEMPTS;
    if (!Number.isSafeInteger(attempts) || attempts < 1 || attempts > 100) throw new Error("Campaign lease recoveryAttempts is invalid");
    const sleep = options.sleep ?? ((milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        await fileSystem.rename(candidateDirectory, leaseDirectory);
        return leaseHandle(root, owner, fileSystem);
      } catch (error) {
        if (!CONTENTION_ERRORS.has(errorCode(error) ?? "")) throw error;
      }

      let existing: CampaignLeaseOwner;
      try {
        existing = parseOwner(JSON.parse(await fileSystem.readFile(path.join(leaseDirectory, "owner.json"), "utf8")));
      } catch (error) {
        if (errorCode(error) === "ENOENT") {
          await sleep(Math.min(5 * (attempt + 1), 25));
          continue;
        }
        throw new Error("Campaign lease owner record is unreadable; refusing unsafe recovery", { cause: error });
      }
      if (await ownerIsLive(existing, probe, bootIdentity)) throw new CampaignLeaseHeldError(existing);

      // The archive name is deterministic for the observed lease. That detail is
      // the cross-process fence: only one contender can move the stale directory;
      // a delayed contender cannot move a newly published lease over this already
      // populated destination on either Windows or POSIX.
      const archived = inside(historyDirectory, existing.leaseId);
      try {
        await fileSystem.rename(leaseDirectory, archived);
      } catch (error) {
        if (!CONTENTION_ERRORS.has(errorCode(error) ?? "") && errorCode(error) !== "ENOENT") throw error;
      }
      await sleep(0);
    }
    throw new Error("Campaign lease contention did not settle within the bounded recovery attempts");
  } finally {
    await fileSystem.remove(candidateDirectory, { recursive: true, force: true }).catch(() => undefined);
  }
}

function leaseHandle(root: string, owner: CampaignLeaseOwner, fileSystem: CampaignLeaseFileSystem): CampaignLease {
  const leaseDirectory = inside(root, "lease");
  let released = false;
  const assertOwned = async (): Promise<void> => {
    if (released) throw new Error("Campaign lease has already been released");
    const current = parseOwner(JSON.parse(await fileSystem.readFile(path.join(leaseDirectory, "owner.json"), "utf8")));
    if (current.leaseId !== owner.leaseId) throw new Error("Campaign lease ownership was lost");
  };
  return {
    owner,
    assertOwned,
    release: async () => {
      if (released) return;
      await assertOwned();
      await fileSystem.remove(leaseDirectory, { recursive: true, force: true });
      released = true;
    },
  };
}

async function ownerIsLive(owner: CampaignLeaseOwner, probe: CampaignLeaseProcessProbe, currentBootIdentity: string): Promise<boolean> {
  if (owner.bootIdentitySha256 !== digest(currentBootIdentity)) return false;
  const identity = await probe.processIdentity(owner.pid);
  return identity !== null && owner.processIdentitySha256 === digest(identity);
}

function parseOwner(value: unknown): CampaignLeaseOwner {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("Campaign lease owner must be an object");
  const object = value as Record<string, unknown>;
  const expected = ["acquiredAt", "bootIdentitySha256", "leaseId", "pid", "processIdentitySha256", "schemaVersion"];
  const actual = Object.keys(object).sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) throw new Error("Campaign lease owner has unexpected or missing keys");
  if (object.schemaVersion !== LEASE_SCHEMA_VERSION || typeof object.leaseId !== "string" || !SAFE_ID.test(object.leaseId)) throw new Error("Campaign lease owner identity is invalid");
  if (!Number.isSafeInteger(object.pid) || (object.pid as number) < 1) throw new Error("Campaign lease owner pid is invalid");
  for (const key of ["bootIdentitySha256", "processIdentitySha256"] as const) {
    if (typeof object[key] !== "string" || !/^[a-f0-9]{64}$/u.test(object[key])) throw new Error(`Campaign lease owner ${key} is invalid`);
  }
  if (typeof object.acquiredAt !== "string" || Number.isNaN(Date.parse(object.acquiredAt))) throw new Error("Campaign lease owner acquiredAt is invalid");
  return object as CampaignLeaseOwner;
}

function inside(root: string, relative: string): string {
  if (!/^[A-Za-z0-9._-]+$/u.test(relative)) throw new Error("Campaign lease path segment is unsafe");
  const resolved = path.resolve(root, relative);
  if (!resolved.startsWith(`${root}${path.sep}`)) throw new Error("Campaign lease path escaped its campaign directory");
  return resolved;
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function errorCode(error: unknown): string | undefined {
  return error !== null && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : undefined;
}

async function powershell(script: string): Promise<string> {
  const { stdout } = await execFileAsync("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script], { windowsHide: true });
  return stdout.trim();
}

export const defaultCampaignLeaseProcessProbe: CampaignLeaseProcessProbe = {
  async bootIdentity(): Promise<string> {
    if (process.platform === "win32") return powershell("(Get-CimInstance Win32_OperatingSystem).LastBootUpTime.ToUniversalTime().Ticks.ToString()");
    if (process.platform === "linux") return (await readFile("/proc/sys/kernel/random/boot_id", "utf8")).trim();
    const { stdout } = await execFileAsync("sysctl", ["-n", "kern.boottime"]);
    return stdout.trim();
  },
  async processIdentity(pid: number): Promise<string | null> {
    if (process.platform === "win32") {
      // A missing PID is data, while a PowerShell/process-query failure is
      // uncertainty and must fail closed instead of stealing a live lease.
      const result = await powershell(`$p = Get-Process -Id ${pid} -ErrorAction SilentlyContinue; if ($null -eq $p) { '__FLUXIQ_MISSING_PROCESS__' } else { $p.StartTime.ToUniversalTime().Ticks.ToString() }`);
      if (result === "__FLUXIQ_MISSING_PROCESS__") return null;
      if (!result) throw new Error("Windows returned an empty process identity");
      return result;
    }
    try {
      if (process.platform === "linux") {
        const stat = await readFile(`/proc/${pid}/stat`, "utf8");
        const fields = stat.slice(stat.lastIndexOf(")") + 2).trim().split(/\s+/u);
        return fields[19] ?? null;
      }
      const { stdout } = await execFileAsync("ps", ["-o", "lstart=", "-p", String(pid)]);
      return stdout.trim() || null;
    } catch (error) {
      if (errorCode(error) === "ENOENT" || errorCode(error) === "ESRCH" || errorCode(error) === "1") return null;
      // `ps` communicates a missing PID with exit 1. Other probe failures are
      // not proof that an owner died and therefore remain hard failures.
      if (process.platform !== "linux" && error !== null && typeof error === "object" && "code" in error && error.code === 1) return null;
      throw error;
    }
  },
};
