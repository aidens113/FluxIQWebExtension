import { createHash, randomUUID } from "node:crypto";
import { chmod, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { hardenWindowsPrivatePath } from "./windows-acl.js";

const SCHEMA_VERSION = "0.1" as const;
const DEFAULT_TTL_MS = 8 * 60 * 60 * 1_000;

export type AuthSessionScope = { origin: string; username: string };
export type CachedAuthSession = AuthSessionScope & {
  schemaVersion: typeof SCHEMA_VERSION;
  cookie: string;
  createdAt: string;
  expiresAt: string;
};
export type AuthSessionStatus = {
  state: "missing" | "valid" | "expired" | "malformed" | "wrong-scope" | "invalid-cookie";
  origin: string;
  username: string;
  path: string;
  createdAt?: string;
  expiresAt?: string;
};
export type CookieValidationHook = (session: Readonly<CachedAuthSession>) => boolean | Promise<boolean>;

export class WebPanelAuthSessionCache {
  readonly directory: string;
  private readonly now: () => Date;
  private readonly defaultTtlMs: number;

  constructor(runsDirectory: string, options: { now?: () => Date; defaultTtlMs?: number } = {}) {
    this.directory = path.join(path.resolve(runsDirectory), ".auth");
    this.now = options.now ?? (() => new Date());
    this.defaultTtlMs = options.defaultTtlMs ?? DEFAULT_TTL_MS;
    if (!Number.isSafeInteger(this.defaultTtlMs) || this.defaultTtlMs <= 0) throw new Error("Auth session cache TTL must be a positive integer");
  }

  pathFor(scope: AuthSessionScope): string {
    const normalized = normalizeScope(scope);
    const digest = createHash("sha256").update(normalized.origin).update("\0").update(normalized.username).digest("hex");
    return path.join(this.directory, `${digest}.json`);
  }

  async load(scope: AuthSessionScope, validateCookie: CookieValidationHook): Promise<{ session?: CachedAuthSession; status: AuthSessionStatus }> {
    const normalized = normalizeScope(scope);
    const inspected = await this.read(normalized);
    if (!inspected.session) return { status: inspected.status };
    let accepted = false;
    try { accepted = await validateCookie(inspected.session); } catch { accepted = false; }
    if (!accepted) return { status: { ...publicStatus(inspected.session, this.pathFor(normalized)), state: "invalid-cookie" } };
    return { session: inspected.session, status: publicStatus(inspected.session, this.pathFor(normalized)) };
  }

  async status(scope: AuthSessionScope): Promise<AuthSessionStatus> {
    return (await this.read(normalizeScope(scope))).status;
  }

  async save(scope: AuthSessionScope, input: { cookie: string; expiresAt?: string }): Promise<AuthSessionStatus> {
    const normalized = normalizeScope(scope);
    const cookie = normalizeCookie(input.cookie);
    const now = this.now();
    const expiresAt = input.expiresAt ?? new Date(now.getTime() + this.defaultTtlMs).toISOString();
    if (!validDate(expiresAt) || Date.parse(expiresAt) <= now.getTime()) throw new Error("Auth session expiry must be in the future");
    const session: CachedAuthSession = { schemaVersion: SCHEMA_VERSION, ...normalized, cookie, createdAt: now.toISOString(), expiresAt };
    const target = this.pathFor(normalized);
    const temporary = path.join(this.directory, `.${path.basename(target)}.${randomUUID()}.tmp`);
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    await secureMode(this.directory, 0o700);
    try {
      await writeFile(temporary, `${JSON.stringify(session)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
      await secureMode(temporary, 0o600);
      await rename(temporary, target);
      await secureMode(target, 0o600);
    } catch (error) {
      await rm(temporary, { force: true }).catch(() => undefined);
      throw error;
    }
    return publicStatus(session, target);
  }

  async clear(scope: AuthSessionScope): Promise<AuthSessionStatus> {
    const normalized = normalizeScope(scope);
    await rm(this.pathFor(normalized), { force: true });
    return { state: "missing", ...normalized, path: this.pathFor(normalized) };
  }

  private async read(scope: AuthSessionScope): Promise<{ session?: CachedAuthSession; status: AuthSessionStatus }> {
    const target = this.pathFor(scope);
    let value: unknown;
    try { value = JSON.parse(await readFile(target, "utf8")) as unknown; }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { status: { state: "missing", ...scope, path: target } };
      return { status: { state: "malformed", ...scope, path: target } };
    }
    const session = parseSession(value);
    if (!session) return { status: { state: "malformed", ...scope, path: target } };
    if (session.origin !== scope.origin || session.username !== scope.username) return { status: { state: "wrong-scope", ...scope, path: target, createdAt: session.createdAt, expiresAt: session.expiresAt } };
    if (Date.parse(session.expiresAt) <= this.now().getTime()) return { status: { ...publicStatus(session, target), state: "expired" } };
    return { session, status: publicStatus(session, target) };
  }
}

export function cookieExpiry(setCookie: string, now = new Date(), defaultTtlMs = DEFAULT_TTL_MS): string {
  const maxAge = /(?:^|;)\s*Max-Age=(-?\d+)/i.exec(setCookie)?.[1];
  if (maxAge !== undefined) return new Date(now.getTime() + Number(maxAge) * 1_000).toISOString();
  const expires = /(?:^|;)\s*Expires=([^;]+)/i.exec(setCookie)?.[1];
  if (expires && validDate(expires)) return new Date(expires).toISOString();
  return new Date(now.getTime() + defaultTtlMs).toISOString();
}

function normalizeScope(scope: AuthSessionScope): AuthSessionScope {
  let url: URL;
  try { url = new URL(scope.origin); } catch { throw new Error("Auth session origin must be an absolute HTTP(S) origin"); }
  if (!["http:", "https:"].includes(url.protocol) || url.origin !== scope.origin || url.username || url.password) throw new Error("Auth session origin must be an exact HTTP(S) origin");
  if (!scope.username.trim()) throw new Error("Auth session username must be non-empty");
  return { origin: url.origin, username: scope.username };
}

function normalizeCookie(cookie: string): string {
  const value = cookie.split(";", 1)[0]?.trim();
  if (!value || !/^fluxiq_session=[^;\r\n\s]+$/.test(value)) throw new Error("FluxIQ auth session cookie is malformed");
  return value;
}

function parseSession(value: unknown): CachedAuthSession | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some(key => !["schemaVersion", "origin", "username", "cookie", "createdAt", "expiresAt"].includes(key))) return undefined;
  if (record.schemaVersion !== SCHEMA_VERSION || typeof record.origin !== "string" || typeof record.username !== "string" || typeof record.cookie !== "string" || typeof record.createdAt !== "string" || typeof record.expiresAt !== "string") return undefined;
  if (!validDate(record.createdAt) || !validDate(record.expiresAt)) return undefined;
  try {
    const scope = normalizeScope({ origin: record.origin, username: record.username });
    return { schemaVersion: SCHEMA_VERSION, ...scope, cookie: normalizeCookie(record.cookie), createdAt: new Date(record.createdAt).toISOString(), expiresAt: new Date(record.expiresAt).toISOString() };
  } catch { return undefined; }
}

function publicStatus(session: CachedAuthSession, target: string): AuthSessionStatus {
  return { state: "valid", origin: session.origin, username: session.username, path: target, createdAt: session.createdAt, expiresAt: session.expiresAt };
}
function validDate(value: string): boolean { return Number.isFinite(Date.parse(value)); }
async function secureMode(target: string, mode: number): Promise<void> {
  if (process.platform === "win32") {
    await hardenWindowsPrivatePath(target, mode === 0o700 ? "directory" : "file");
    return;
  }
  await chmod(target, mode);
}
