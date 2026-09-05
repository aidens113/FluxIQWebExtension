import { randomUUID } from "node:crypto";
import { chmod, lstat, mkdir, open, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { hardenWindowsPrivatePath } from "./windows-acl.js";

const SCHEMA_VERSION = "0.1" as const;
const MAX_CREDENTIAL_FILE_BYTES = 4 * 1024;
const IDENTITY_DIRECTORY = ".identity";
const CREDENTIAL_FILE = "credentials.json";

export type PersistentIsolatedCredentials = {
  username: string;
  password: string;
  pin: string;
};

type StoredPersistentIdentity = {
  schemaVersion: typeof SCHEMA_VERSION;
  credentials: PersistentIsolatedCredentials;
};

export type PersistentIdentityGenerator = () => PersistentIsolatedCredentials | Promise<PersistentIsolatedCredentials>;

/**
 * Returns the workspace identity, creating it once when the protected store is
 * absent. Callers deliberately receive no status object that could be logged
 * with credential values by generic reporting code.
 */
export async function loadOrCreatePersistentIdentity(
  workspaceRoot: string,
  generate: PersistentIdentityGenerator,
): Promise<{ credentials: PersistentIsolatedCredentials; created: boolean }> {
  const root = path.resolve(workspaceRoot);
  const directory = path.join(root, IDENTITY_DIRECTORY);
  const target = path.join(directory, CREDENTIAL_FILE);
  if (path.dirname(directory) !== root || path.dirname(target) !== directory) throw new Error("Persistent identity path escaped its workspace");

  await mkdir(directory, { recursive: true, mode: 0o700 });
  await secureMode(directory, 0o700);
  const existing = await readStoredIdentity(target);
  if (existing) {
    await secureMode(target, 0o600);
    return { credentials: existing.credentials, created: false };
  }

  const credentials = validateCredentials(await generate());
  const stored: StoredPersistentIdentity = { schemaVersion: SCHEMA_VERSION, credentials };
  const serialized = `${JSON.stringify(stored)}\n`;
  if (Buffer.byteLength(serialized, "utf8") > MAX_CREDENTIAL_FILE_BYTES) throw new Error("Generated persistent identity exceeds the credential file size limit");
  const temporary = path.join(directory, `.${CREDENTIAL_FILE}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, serialized, { encoding: "utf8", flag: "wx", mode: 0o600 });
    await secureMode(temporary, 0o600);
    await rename(temporary, target);
    await secureMode(target, 0o600);
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
  return { credentials, created: true };
}

async function readStoredIdentity(target: string): Promise<StoredPersistentIdentity | undefined> {
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    const metadata = await lstat(target);
    if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error("Persistent identity store must be a regular file");
    if (metadata.size > MAX_CREDENTIAL_FILE_BYTES) throw new Error("Persistent identity store exceeds the credential file size limit");
    handle = await open(target, "r");
    const contents = await handle.readFile();
    if (contents.byteLength > MAX_CREDENTIAL_FILE_BYTES) throw new Error("Persistent identity store exceeds the credential file size limit");
    let parsed: unknown;
    try { parsed = JSON.parse(contents.toString("utf8")) as unknown; }
    catch { throw new Error("Persistent identity store is malformed"); }
    return parseStoredIdentity(parsed);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  } finally {
    await handle?.close();
  }
}

function parseStoredIdentity(value: unknown): StoredPersistentIdentity {
  if (!isRecord(value) || !hasExactKeys(value, ["schemaVersion", "credentials"]) || value.schemaVersion !== SCHEMA_VERSION) {
    throw new Error("Persistent identity store has an unsupported or malformed schema");
  }
  return { schemaVersion: SCHEMA_VERSION, credentials: validateCredentials(value.credentials) };
}

function validateCredentials(value: unknown): PersistentIsolatedCredentials {
  if (!isRecord(value) || !hasExactKeys(value, ["username", "password", "pin"])) throw new Error("Persistent identity credentials are malformed");
  const username = boundedSingleLine(value.username, "username", 1, 128);
  const password = boundedSingleLine(value.password, "password", 12, 512);
  const pin = boundedSingleLine(value.pin, "PIN", 4, 12);
  if (!/^\d+$/u.test(pin)) throw new Error("Persistent identity PIN must contain only digits");
  return { username, password, pin };
}

function boundedSingleLine(value: unknown, name: string, minimum: number, maximum: number): string {
  if (typeof value !== "string" || value.length < minimum || value.length > maximum || value.trim() !== value || /[\r\n\0]/u.test(value)) {
    throw new Error(`Persistent identity ${name} must be a ${minimum}-${maximum} character single-line value`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

async function secureMode(target: string, mode: 0o600 | 0o700): Promise<void> {
  if (process.platform === "win32") {
    await hardenWindowsPrivatePath(target, mode === 0o700 ? "directory" : "file");
    return;
  }
  await chmod(target, mode);
}
