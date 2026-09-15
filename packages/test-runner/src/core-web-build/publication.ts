// How a finished build becomes reusable. A build attempt runs in its own
// directory and is never moved. After `next build` exits 0 and has written
// `.next/BUILD_ID`, the attempt receives a completion marker; only then does
// the key directory receive `published.json`, naming that attempt. Both
// records are written to a temporary file and renamed into place, so a reader
// sees no record or a whole one. A reader accepts a build only when the
// publication, the marker and `BUILD_ID` all agree, so a failed, interrupted
// or half-written attempt is never reused.
import { randomBytes } from "node:crypto";
import { open, readFile, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import type { CoreWebBuild } from "./types.js";

const PUBLICATION_FILE = "published.json";
const COMPLETION_FILE = "build-complete.json";
const SCHEMA_VERSION = 1;
const MAX_RECORD_BYTES = 4_096;
const ATTEMPT_NAME = /^b-[0-9a-f]{12}$/u;
const BUILD_ID = /^[A-Za-z0-9_-]{1,128}$/u;

/** A fresh attempt directory name, short enough to keep Windows build paths well inside their limits. */
export function newBuildAttemptName(): string {
  return `b-${randomBytes(6).toString("hex")}`;
}

/** The attempt's `.next/BUILD_ID`, or undefined unless it holds one well-formed id. */
export async function readBuildId(webDirectory: string): Promise<string | undefined> {
  const text = await readSmallFile(path.join(webDirectory, ".next", "BUILD_ID"));
  const buildId = text?.trim();
  return buildId && BUILD_ID.test(buildId) ? buildId : undefined;
}

/** Records that the attempt's build finished with `buildId`. Called only after `next build` exited 0. */
export async function markBuildComplete(directory: string, key: string, buildId: string): Promise<void> {
  await writeRecordAtomically(path.join(directory, COMPLETION_FILE), { schemaVersion: SCHEMA_VERSION, key, buildId });
}

/** Points the key at one completed attempt. The rename is the publication. */
export async function publishBuildAttempt(keyDirectory: string, key: string, attempt: string): Promise<void> {
  if (!ATTEMPT_NAME.test(attempt)) throw new Error("Refused to publish a malformed Core web build attempt name");
  await writeRecordAtomically(path.join(keyDirectory, PUBLICATION_FILE), { schemaVersion: SCHEMA_VERSION, key, attempt });
}

/** The published build for `key`, or undefined when no complete build is published for it. */
export async function readPublishedCoreWebBuild(keyDirectory: string, key: string, nextExecutable: string): Promise<CoreWebBuild | undefined> {
  const publication = await readRecord(path.join(keyDirectory, PUBLICATION_FILE), ["attempt", "key", "schemaVersion"]);
  if (!publication || publication.key !== key || typeof publication.attempt !== "string" || !ATTEMPT_NAME.test(publication.attempt)) return undefined;
  const directory = path.join(keyDirectory, publication.attempt);
  const webDirectory = path.join(directory, "apps", "web");
  const marker = await readRecord(path.join(directory, COMPLETION_FILE), ["buildId", "key", "schemaVersion"]);
  if (!marker || marker.key !== key) return undefined;
  const buildId = await readBuildId(webDirectory);
  if (!buildId || marker.buildId !== buildId) return undefined;
  return { key, directory, webDirectory, nextExecutable, buildId };
}

async function readRecord(file: string, keys: readonly string[]): Promise<Record<string, unknown> | undefined> {
  const text = await readSmallFile(file);
  if (text === undefined) return undefined;
  let value: unknown;
  try { value = JSON.parse(text); } catch { return undefined; }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).sort().join(",") !== [...keys].sort().join(",") || record.schemaVersion !== SCHEMA_VERSION) return undefined;
  return record;
}

async function readSmallFile(file: string): Promise<string | undefined> {
  try {
    const details = await stat(file);
    if (!details.isFile() || details.size <= 0 || details.size > MAX_RECORD_BYTES) return undefined;
    return await readFile(file, "utf8");
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && (error.code === "ENOENT" || error.code === "ENOTDIR")) return undefined;
    throw error;
  }
}

async function writeRecordAtomically(target: string, record: Record<string, unknown>): Promise<void> {
  const temporary = `${target}.${randomBytes(8).toString("hex")}.tmp`;
  try {
    const handle = await open(temporary, "wx", 0o600);
    try {
      await handle.writeFile(`${JSON.stringify(record)}\n`, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temporary, target);
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
}
