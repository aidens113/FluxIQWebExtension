import { createHash, randomUUID } from "node:crypto";
import { chmod, mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { assertClonePackage, canonicalClonePackageJson, type ClonePackage } from "@fluxiq-web-extension/test-contracts";
import { hashCanonicalJson } from "./clone-policy.js";
import { hardenWindowsPrivatePath } from "./windows-acl.js";

const CACHE_SCHEMA_VERSION = "0.1" as const;
const DEFAULT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1_000;
const DEFAULT_MAX_ENTRY_BYTES = 5 * 1024 * 1024;
const DEFAULT_MAX_ENTRIES = 32;
const LOCK_WAIT_MS = 25;
const LOCK_TIMEOUT_MS = 10_000;
const STALE_LOCK_MS = 30_000;

export type CloneCacheScope = { origin: string; username: string; projectId: string; flowId: string };
export type CloneSourceRevision = { updatedAt: number; version?: string; fingerprint: string };
export type CloneCacheStatus = { state: "missing" | "valid" | "stale" | "corrupt"; origin: string; username: string; projectId: string; flowId: string; createdAt?: string; expiresAt?: string; packageHash?: string };
type CloneCacheEntry = {
  schemaVersion: typeof CACHE_SCHEMA_VERSION;
  scope: CloneCacheScope;
  revision: CloneSourceRevision;
  packageHash: string;
  clonePackage: ClonePackage;
  createdAt: string;
  expiresAt: string;
};

export class ClonePackageCache {
  readonly directory: string;
  private readonly now: () => Date;
  private readonly maxAgeMs: number;
  private readonly maxEntryBytes: number;
  private readonly maxEntries: number;

  constructor(runsDirectory: string, options: { now?: () => Date; maxAgeMs?: number; maxEntryBytes?: number; maxEntries?: number } = {}) {
    this.directory = path.join(path.resolve(runsDirectory), ".clone-cache");
    this.now = options.now ?? (() => new Date());
    this.maxAgeMs = positive(options.maxAgeMs ?? DEFAULT_MAX_AGE_MS, "clone cache maximum age");
    this.maxEntryBytes = positive(options.maxEntryBytes ?? DEFAULT_MAX_ENTRY_BYTES, "clone cache entry size");
    this.maxEntries = positive(options.maxEntries ?? DEFAULT_MAX_ENTRIES, "clone cache entry count");
  }

  pathFor(scope: CloneCacheScope): string { return path.join(this.directory, `${scopeDigest(normalizeScope(scope))}.json`); }

  async load(scope: CloneCacheScope, revision: CloneSourceRevision): Promise<{ clonePackage?: ClonePackage; status: CloneCacheStatus }> {
    const normalized = normalizeScope(scope);
    const result = await this.withEntryLock(normalized, () => this.read(normalized, revision));
    return result.entry ? { clonePackage: result.entry.clonePackage, status: result.status } : { status: result.status };
  }

  async status(scope: CloneCacheScope): Promise<CloneCacheStatus> { const normalized = normalizeScope(scope); return this.withEntryLock(normalized, async () => (await this.read(normalized)).status); }

  async save(scope: CloneCacheScope, revision: CloneSourceRevision, clonePackage: ClonePackage): Promise<CloneCacheStatus> {
    const normalized = normalizeScope(scope);
    const normalizedRevision = normalizeRevision(revision);
    assertClonePackage(clonePackage);
    if (!samePackageScope(normalized, clonePackage)) throw new Error("Clone cache package does not match its source scope");
    const canonical = canonicalClonePackageJson(clonePackage);
    const now = this.now();
    const entry: CloneCacheEntry = { schemaVersion: CACHE_SCHEMA_VERSION, scope: normalized, revision: normalizedRevision, packageHash: hashCanonicalJson(JSON.parse(canonical)), clonePackage, createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + this.maxAgeMs).toISOString() };
    const serialized = `${JSON.stringify(entry)}\n`;
    if (Buffer.byteLength(serialized) > this.maxEntryBytes) throw new Error("Clone cache entry exceeds the configured size bound");
    await this.withEntryLock(normalized, async () => {
      const target = this.pathFor(normalized);
      const temporary = path.join(this.directory, `.${path.basename(target)}.${randomUUID()}.tmp`);
      try {
        await writeFile(temporary, serialized, { encoding: "utf8", flag: "wx", mode: 0o600 }); await secure(temporary, "file");
        await rename(temporary, target); await secure(target, "file");
        await this.prune();
      } catch (error) { await rm(temporary, { force: true }).catch(() => undefined); throw error; }
    });
    return publicStatus(entry, "valid");
  }

  async clear(scope: CloneCacheScope): Promise<CloneCacheStatus> {
    const normalized = normalizeScope(scope); return this.withEntryLock(normalized, async () => { await rm(this.pathFor(normalized), { force: true }); return { state: "missing", ...normalized }; });
  }

  private async withEntryLock<T>(scope: CloneCacheScope, operation: () => Promise<T>): Promise<T> {
    await mkdir(this.directory, { recursive: true, mode: 0o700 }); await secure(this.directory, "directory");
    const lock = `${this.pathFor(scope)}.lock`;
    const deadline = Date.now() + LOCK_TIMEOUT_MS;
    while (true) {
      try { await mkdir(lock, { mode: 0o700 }); await secure(lock, "directory"); break; }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        try { if (Date.now() - (await stat(lock)).mtimeMs > STALE_LOCK_MS) { await rm(lock, { recursive: true, force: true }); continue; } } catch { continue; }
        if (Date.now() >= deadline) throw new Error("Timed out waiting for the scoped clone cache lock");
        await new Promise(resolve => setTimeout(resolve, LOCK_WAIT_MS));
      }
    }
    try { return await operation(); }
    finally { await rm(lock, { recursive: true, force: true }); }
  }

  private async read(scope: CloneCacheScope, revision?: CloneSourceRevision): Promise<{ entry?: CloneCacheEntry; status: CloneCacheStatus }> {
    const target = this.pathFor(scope);
    try {
      if ((await stat(target)).size > this.maxEntryBytes) return { status: await this.quarantine(scope, target, "corrupt") };
      const value: unknown = JSON.parse(await readFile(target, "utf8"));
      const entry = parseEntry(value);
      if (!entry || !sameScope(scope, entry.scope) || !samePackageScope(scope, entry.clonePackage) || entry.packageHash !== hashCanonicalJson(JSON.parse(canonicalClonePackageJson(entry.clonePackage)))) return { status: await this.quarantine(scope, target, "corrupt") };
      if (Date.parse(entry.expiresAt) <= this.now().getTime() || (revision && !sameRevision(entry.revision, normalizeRevision(revision)))) return { status: await this.quarantine(scope, target, "stale", entry) };
      return { entry, status: publicStatus(entry, "valid") };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { status: { state: "missing", ...scope } };
      return { status: await this.quarantine(scope, target, "corrupt") };
    }
  }

  private async quarantine(scope: CloneCacheScope, target: string, state: "stale" | "corrupt", entry?: CloneCacheEntry): Promise<CloneCacheStatus> {
    const quarantine = path.join(this.directory, ".quarantine");
    try { await mkdir(quarantine, { recursive: true, mode: 0o700 }); await secure(quarantine, "directory"); const destination = path.join(quarantine, `${path.basename(target, ".json")}.${randomUUID()}.json`); await rename(target, destination); await secure(destination, "file"); }
    catch { await rm(target, { force: true }).catch(() => undefined); }
    return entry ? publicStatus(entry, state) : { state, ...scope };
  }

  private async prune(): Promise<void> {
    const entries = (await readdir(this.directory, { withFileTypes: true })).filter(item => item.isFile() && item.name.endsWith(".json"));
    const ordered = (await Promise.all(entries.map(async item => ({ path: path.join(this.directory, item.name), mtime: (await stat(path.join(this.directory, item.name))).mtimeMs })))).sort((a, b) => b.mtime - a.mtime);
    await Promise.all(ordered.slice(this.maxEntries).map(item => rm(item.path, { force: true })));
  }
}

function parseEntry(value: unknown): CloneCacheEntry | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const item = value as Record<string, unknown>;
  if (Object.keys(item).some(key => !["schemaVersion", "scope", "revision", "packageHash", "clonePackage", "createdAt", "expiresAt"].includes(key)) || item.schemaVersion !== CACHE_SCHEMA_VERSION || typeof item.packageHash !== "string" || !/^[a-f0-9]{64}$/u.test(item.packageHash) || typeof item.createdAt !== "string" || typeof item.expiresAt !== "string" || !Number.isFinite(Date.parse(item.createdAt)) || !Number.isFinite(Date.parse(item.expiresAt))) return undefined;
  try { const scope = normalizeScope(item.scope as CloneCacheScope); const revision = normalizeRevision(item.revision as CloneSourceRevision); assertClonePackage(item.clonePackage); return { schemaVersion: CACHE_SCHEMA_VERSION, scope, revision, packageHash: item.packageHash, clonePackage: item.clonePackage, createdAt: new Date(item.createdAt).toISOString(), expiresAt: new Date(item.expiresAt).toISOString() }; } catch { return undefined; }
}
function normalizeScope(scope: CloneCacheScope): CloneCacheScope { let url: URL; try { url = new URL(scope.origin); } catch { throw new Error("Clone cache origin must be exact HTTP(S)"); } if (!["http:", "https:"].includes(url.protocol) || url.origin !== scope.origin || url.username || url.password) throw new Error("Clone cache origin must be exact HTTP(S)"); return { origin: url.origin, username: id(scope.username, "username"), projectId: id(scope.projectId, "project ID"), flowId: id(scope.flowId, "Flow ID") }; }
function normalizeRevision(value: CloneSourceRevision): CloneSourceRevision { if (!Number.isFinite(value.updatedAt) || value.updatedAt < 0 || !/^[a-f0-9]{64}$/u.test(value.fingerprint)) throw new Error("Clone source revision is malformed"); return { updatedAt: value.updatedAt, ...(value.version ? { version: id(value.version, "version") } : {}), fingerprint: value.fingerprint }; }
function sameScope(a: CloneCacheScope, b: CloneCacheScope): boolean { return a.origin === b.origin && a.username === b.username && a.projectId === b.projectId && a.flowId === b.flowId; }
function sameRevision(a: CloneSourceRevision, b: CloneSourceRevision): boolean { return a.updatedAt === b.updatedAt && a.version === b.version && a.fingerprint === b.fingerprint; }
function samePackageScope(scope: CloneCacheScope, value: ClonePackage): boolean { return value.source.origin === scope.origin && value.source.projectId === scope.projectId && value.source.flowId === scope.flowId; }
function publicStatus(entry: CloneCacheEntry, state: CloneCacheStatus["state"]): CloneCacheStatus { return { state, ...entry.scope, createdAt: entry.createdAt, expiresAt: entry.expiresAt, packageHash: entry.packageHash }; }
function scopeDigest(scope: CloneCacheScope): string { return createHash("sha256").update(scope.origin).update("\0").update(scope.username).update("\0").update(scope.projectId).update("\0").update(scope.flowId).digest("hex"); }
function id(value: string, label: string): string { const result = value?.trim(); if (!result || /[\r\n]/u.test(result)) throw new Error(`Clone cache ${label} must be non-empty single-line text`); return result; }
function positive(value: number, label: string): number { if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${label} must be a positive integer`); return value; }
async function secure(target: string, kind: "directory" | "file"): Promise<void> { if (process.platform === "win32") await hardenWindowsPrivatePath(target, kind); else await chmod(target, kind === "directory" ? 0o700 : 0o600); }
