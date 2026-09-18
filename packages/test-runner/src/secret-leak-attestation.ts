import { createHash } from "node:crypto";
import { copyFile, lstat, mkdtemp, open, readdir, readFile, realpath, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { readSqliteStores } from "./sqlite-store-reader/index.js";

/**
 * The scan's ceilings. Every byte ceiling here bounds text: `maxFileBytes` is the
 * most one text file may hold, since it is decoded whole as UTF-8 and run through
 * the credential regexes, and `maxTotalBytes` is the most text one scan decodes.
 * A SQLite store has no byte ceiling at all, because it is never held in memory:
 * its bytes are searched in fixed-size chunks, it is staged with `copyFile`, and
 * its cells are searched inside SQLite (`sqlite-store-reader/`). A size ceiling on
 * a store bounded nothing but the answer, and each one set from an observed size
 * failed the next larger healthy run: 8 MiB failed a 10.02 MiB read-only run, and
 * the 32 MiB that replaced it failed an 85.5 MiB state-changing one. A store the
 * scan cannot actually read still fails closed, as `unscanned-store`.
 */
export const SECRET_LEAK_ATTESTATION_DEFAULT_LIMITS = Object.freeze({
  maxFiles: 2_000, maxFileBytes: 1_048_576, maxTotalBytes: 16_777_216, maxDepth: 16, maxApprovedPaths: 32,
});
export type SecretLeakAttestationLimits = { maxFiles: number; maxFileBytes: number; maxTotalBytes: number; maxDepth: number; maxApprovedPaths: number };
/**
 * The ceilings a Lab run's scans use, and the demo setup scan with them. A run
 * bundle and an isolated workspace carry more text than the defaults, which are
 * sized for one result file. `maxApprovedPaths` stays at its default.
 */
export const SECRET_LEAK_ATTESTATION_RUN_LIMITS = Object.freeze({
  maxFiles: 10_000, maxFileBytes: 8_388_608, maxTotalBytes: 67_108_864, maxDepth: 32,
}) satisfies Partial<SecretLeakAttestationLimits>;
const ABSOLUTE_LIMITS: Readonly<SecretLeakAttestationLimits> = Object.freeze({ ...SECRET_LEAK_ATTESTATION_RUN_LIMITS, maxApprovedPaths: 128 });

export type SecretLeakFindingCategory =
  | "secret-literal" | "credential-field" | "credential-assignment" | "authorization-material"
  | "unreadable-text" | "oversize-text" | "unsafe-reparse" | "path-escape"
  | "file-limit" | "byte-limit" | "depth-limit" | "unscanned-store";
export type SecretLeakFinding = { path: string; categories: SecretLeakFindingCategory[] };
export type SecretLeakAttestationReport = {
  status: "passed" | "failed"; scannedFiles: number; scannedBytes: number;
  skippedBinaryFiles: number; findingCount: number; findings: SecretLeakFinding[];
};
export type SecretLeakAttestationInput = {
  workspaceRoot: string; secretLiteral: string; approvedRelativePaths: readonly string[];
  limits?: Partial<SecretLeakAttestationLimits>;
};

const binaryExtensions = new Set([
  ".7z", ".avi", ".bin", ".bmp", ".br", ".dll", ".exe", ".gif", ".gz",
  ".ico", ".jpeg", ".jpg", ".mp3", ".mp4", ".pdf", ".png",
  ".tar", ".webm", ".webp", ".woff", ".woff2", ".zip",
]);
// A SQLite store keeps TEXT as raw UTF-8 or UTF-16 bytes in its pages, its
// write-ahead log and its rollback journal, so it is searched for the literal
// byte for byte, never skipped as binary; that search also covers freed pages
// and log frames no query returns. It cannot see a literal SQLite has split
// across overflow pages, which are not adjacent in the file, so the database
// each store file belongs to is also read cell by cell (`stageDatabase`). A store
// the scan cannot read in full, or a database the reader cannot read, is an
// `unscanned-store` finding. Known by name, or by the header of a database, WAL
// or journal file, which is read before any text ceiling is applied, so a store
// under any name is streamed rather than refused as oversize text.
//
// A store is searched `STORE_SEARCH_CHUNK_BYTES` at a time (`searchStoreFile`),
// so memory stays the same whatever its size, and none of `maxFileBytes` or
// `maxTotalBytes` applies to it: they budget the text the scan decodes, and a
// store is never decoded.
const STORE_SEARCH_CHUNK_BYTES = 1_048_576;
const sqliteStoreName = /\.(?:db|sqlite3?)(?:-(?:wal|shm|journal))?$/iu;
const sqliteSidecar = /-(?:wal|shm|journal)$/iu;
const sqliteHeaders = [
  Buffer.from("SQLite format 3\0", "latin1"), Buffer.from([0x37, 0x7f, 0x06, 0x82]), Buffer.from([0x37, 0x7f, 0x06, 0x83]),
  Buffer.from([0xd9, 0xd5, 0x05, 0xf9, 0x20, 0xa1, 0x63, 0xd7]),
];
const textExtensions = new Set([
  "", ".csv", ".env", ".html", ".ini", ".json", ".jsonl", ".log", ".md",
  ".ndjson", ".toml", ".txt", ".xml", ".yaml", ".yml",
]);
const credentialField = /["'](?:access[_-]?token|api[_-]?key|authorization|bearer|cookie|credential|password|pin|private[_-]?key|refresh[_-]?token|secret|session[_-]?key|token)["']\s*:/giu;
const credentialAssignment = /(?:^|\n)\s*[A-Z0-9_]*(?:API_KEY|ACCESS_TOKEN|AUTHORIZATION|BEARER|COOKIE|CREDENTIAL|PASSWORD|PIN|PRIVATE_KEY|REFRESH_TOKEN|SECRET)\s*=\s*\S+/giu;
const authorizationMaterial = /(?:^|\n)\s*(?:authorization|cookie|set-cookie)\s*:\s*\S+/giu;

export async function attestWorkspaceSecretAbsence(input: SecretLeakAttestationInput): Promise<SecretLeakAttestationReport> {
  validateInput(input);
  const limits = resolveLimits(input.limits);
  const storedLiteral = storeEncodings(input.secretLiteral);
  const root = path.resolve(input.workspaceRoot);
  const findings = new Map<string, Set<SecretLeakFindingCategory>>();
  // `scannedBytes` is every byte searched, stores included; `textBytes` is the
  // share decoded as text, which alone counts against `maxTotalBytes`.
  let scannedFiles = 0; let scannedBytes = 0; let textBytes = 0; let skippedBinaryFiles = 0; let visitedEntries = 0;
  const databases: Array<{ relative: string; copy: string }> = [];
  const judgedDatabases = new Set<string>();
  let stagingDirectory: string | undefined;

  const addFinding = (relativePath: string, category: SecretLeakFindingCategory): void => {
    const safePath = sanitizePath(relativePath, input.secretLiteral);
    const categories = findings.get(safePath) ?? new Set<SecretLeakFindingCategory>();
    categories.add(category); findings.set(safePath, categories);
  };

  let canonicalRoot: string;
  try {
    const rootStat = await lstat(root);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) { addFinding(".", "unsafe-reparse"); return report(); }
    canonicalRoot = await realpath(root);
    if (!samePath(root, canonicalRoot)) { addFinding(".", "unsafe-reparse"); return report(); }
  } catch {
    addFinding(".", "unreadable-text"); return report();
  }

  const approved = [...new Set(input.approvedRelativePaths)].sort();
  if (approved.length > limits.maxApprovedPaths) addFinding(".", "file-limit");
  try {
    for (const relative of approved.slice(0, limits.maxApprovedPaths)) {
      const normalized = normalizeApprovedPath(relative);
      if (normalized === undefined) { addFinding(".", "path-escape"); continue; }
      const absolute = path.resolve(canonicalRoot, ...normalized.split("/"));
      if (!isInside(canonicalRoot, absolute)) { addFinding(normalized, "path-escape"); continue; }
      await visit(absolute, normalized, 0);
    }
    await readDatabases();
  } finally {
    if (stagingDirectory !== undefined) await rm(stagingDirectory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
  return report();

  async function visit(absolute: string, relative: string, depth: number): Promise<void> {
    if (++visitedEntries > limits.maxFiles + limits.maxApprovedPaths + 2_000) { addFinding(relative, "file-limit"); return; }
    if (depth > limits.maxDepth) { addFinding(relative, "depth-limit"); return; }

    let metadata;
    try { metadata = await lstat(absolute); }
    catch { addFinding(relative, "unreadable-text"); return; }
    if (metadata.isSymbolicLink()) { addFinding(relative, "unsafe-reparse"); return; }

    try {
      const canonical = await realpath(absolute);
      if (!isInside(canonicalRoot, canonical)) { addFinding(relative, "path-escape"); return; }
    } catch { addFinding(relative, "unreadable-text"); return; }

    if (metadata.isDirectory()) {
      let entries;
      try { entries = await readdir(absolute, { withFileTypes: true }); }
      catch { addFinding(relative, "unreadable-text"); return; }
      entries.sort((left, right) => left.name.localeCompare(right.name));
      for (const entry of entries) {
        const childRelative = joinRelative(relative, entry.name);
        if (entry.isSymbolicLink()) { addFinding(childRelative, "unsafe-reparse"); continue; }
        await visit(path.join(absolute, entry.name), childRelative, depth + 1);
      }
      return;
    }
    if (!metadata.isFile()) return;

    const extension = path.extname(absolute).toLowerCase();
    if (binaryExtensions.has(extension)) { skippedBinaryFiles += 1; return; }
    const namedStore = sqliteStoreName.test(path.basename(absolute));
    if (scannedFiles >= limits.maxFiles) { addFinding(relative, namedStore ? "unscanned-store" : "file-limit"); return; }
    let store = namedStore;
    if (!store) {
      try { store = await hasSqliteHeader(absolute); }
      catch { addFinding(relative, "unreadable-text"); return; }
    }
    if (store) { await scanStore(absolute, relative); return; }
    if (metadata.size > limits.maxFileBytes) { addFinding(relative, "oversize-text"); return; }
    if (textBytes + metadata.size > limits.maxTotalBytes) { addFinding(relative, "byte-limit"); return; }

    let bytes: Buffer;
    try { bytes = await readFile(absolute); }
    catch { addFinding(relative, "unreadable-text"); return; }
    if (bytes.includes(0)) {
      if (textExtensions.has(extension)) addFinding(relative, "unreadable-text"); else skippedBinaryFiles += 1;
      return;
    }

    let contents: string;
    try { contents = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
    catch {
      if (textExtensions.has(extension)) addFinding(relative, "unreadable-text"); else skippedBinaryFiles += 1;
      return;
    }

    scannedFiles += 1; scannedBytes += bytes.byteLength; textBytes += bytes.byteLength;
    for (const category of detectViolations(contents, input.secretLiteral)) addFinding(relative, category);
  }

  /**
   * Searches one store file for the literal and stages its database for the cell
   * read. A file the search cannot read to its end is `unscanned-store`: absence
   * is attested only for bytes that were actually searched.
   */
  async function scanStore(absolute: string, relative: string): Promise<void> {
    let searched: { found: boolean; bytes: number };
    try { searched = await searchStoreFile(absolute, storedLiteral); }
    catch { addFinding(relative, "unscanned-store"); return; }
    scannedFiles += 1; scannedBytes += searched.bytes;
    if (searched.found) addFinding(relative, "secret-literal");
    await stageDatabase(absolute, relative, searched.bytes);
  }

  /**
   * Copies the database a store file belongs to, with its `-wal` and `-journal`,
   * into one private directory under the OS temporary directory, once per
   * database, for `readDatabases`. The reader applies the log it opens, so it is
   * given a copy: a live store is never opened, and the scanned tree is left as
   * it was. The staging directory is removed before the scan returns.
   *
   * The database is the file itself, or the one a `-wal`, `-shm` or `-journal`
   * suffix names, even when that one is not among the approved paths: a bounded
   * scan given only the log a run wrote still reads the rows in it. A `-wal` or
   * `-journal` holding bytes with no database beside it cannot be read as rows.
   * That, and a database with a file that is a link, not a regular file, or one
   * the copy cannot read, is an `unscanned-store` finding. There is no size
   * ceiling: `copyFile` never holds the file in this process's memory.
   */
  async function stageDatabase(absolute: string, relative: string, size: number): Promise<void> {
    const suffix = sqliteSidecar.exec(path.basename(absolute))?.[0] ?? "";
    const database = absolute.slice(0, absolute.length - suffix.length);
    const databaseRelative = relative.slice(0, relative.length - suffix.length);
    const key = process.platform === "win32" ? database.toLowerCase() : database;
    if (judgedDatabases.has(key)) return;
    const parts: string[] = [];
    for (const part of ["", "-wal", "-journal"]) {
      let metadata;
      try { metadata = await lstat(database + part); }
      catch (error) {
        const missing = (error as NodeJS.ErrnoException).code === "ENOENT";
        if (missing && part !== "") continue;
        if (missing && suffix !== "") {
          if (size > 0 && suffix.toLowerCase() !== "-shm") addFinding(relative, "unscanned-store");
          return;
        }
        judgedDatabases.add(key); addFinding(databaseRelative, "unscanned-store"); return;
      }
      if (metadata.isSymbolicLink() || !metadata.isFile()) {
        judgedDatabases.add(key); addFinding(databaseRelative, "unscanned-store"); return;
      }
      parts.push(part);
    }
    judgedDatabases.add(key);
    try {
      stagingDirectory ??= await mkdtemp(path.join(os.tmpdir(), "fluxiq-store-read-"));
      const copy = path.join(stagingDirectory, `${databases.length}.sqlite`);
      for (const part of parts) await copyFile(database + part, copy + part);
      databases.push({ relative: databaseRelative, copy });
    } catch { addFinding(databaseRelative, "unscanned-store"); }
  }

  /** Reads every staged database's cells: one holding the literal is a `secret-literal` finding, and one the reader could not read is `unscanned-store`. */
  async function readDatabases(): Promise<void> {
    const outcomes = await readSqliteStores({ databaseFiles: databases.map(database => database.copy), literal: input.secretLiteral });
    databases.forEach((database, index) => {
      const outcome = outcomes[index] ?? "unreadable";
      if (outcome !== "clean") addFinding(database.relative, outcome === "holds-literal" ? "secret-literal" : "unscanned-store");
    });
  }

  function report(): SecretLeakAttestationReport {
    const resultFindings = [...findings.entries()]
      .map(([findingPath, categories]) => ({ path: findingPath, categories: [...categories].sort() }))
      .sort((left, right) => left.path.localeCompare(right.path));
    return Object.freeze({
      status: resultFindings.length === 0 ? "passed" as const : "failed" as const,
      scannedFiles, scannedBytes, skippedBinaryFiles, findingCount: resultFindings.length, findings: resultFindings,
    });
  }
}

function detectViolations(contents: string, secret: string): SecretLeakFindingCategory[] {
  const categories = new Set<SecretLeakFindingCategory>();
  if (contents.includes(secret)) categories.add("secret-literal");
  if (credentialField.test(contents)) categories.add("credential-field");
  credentialField.lastIndex = 0;
  if (credentialAssignment.test(contents)) categories.add("credential-assignment");
  credentialAssignment.lastIndex = 0;
  if (authorizationMaterial.test(contents)) categories.add("authorization-material");
  authorizationMaterial.lastIndex = 0;
  return [...categories];
}
/** The literal as a SQLite store can hold it: in each of its text encodings, UTF-8, UTF-16LE and UTF-16BE. */
function storeEncodings(secret: string): Buffer[] {
  const utf16le = Buffer.from(secret, "utf16le");
  return [Buffer.from(secret, "utf8"), utf16le, Buffer.from(utf16le).swap16()];
}
function validateInput(input: SecretLeakAttestationInput): void {
  if (!path.isAbsolute(input.workspaceRoot)) throw new Error("Secret attestation requires an absolute workspace root");
  if (typeof input.secretLiteral !== "string" || input.secretLiteral.length < 8 || input.secretLiteral.length > 16_384) throw new Error("Secret attestation requires one bounded in-memory secret");
  if (!Array.isArray(input.approvedRelativePaths) || input.approvedRelativePaths.length === 0) throw new Error("Secret attestation requires approved relative paths");
}
function resolveLimits(overrides: SecretLeakAttestationInput["limits"]): SecretLeakAttestationLimits {
  const limits = { ...SECRET_LEAK_ATTESTATION_DEFAULT_LIMITS, ...overrides };
  for (const key of Object.keys(SECRET_LEAK_ATTESTATION_DEFAULT_LIMITS) as Array<keyof SecretLeakAttestationLimits>) {
    const value = limits[key];
    if (!Number.isSafeInteger(value) || value < 1 || value > ABSOLUTE_LIMITS[key]) throw new Error("Secret attestation limits are invalid");
  }
  if (limits.maxTotalBytes < limits.maxFileBytes) throw new Error("Secret attestation total bytes must cover one file");
  return limits;
}
/** Whether a file begins with a SQLite database, write-ahead log or journal header. Reads only those first bytes. */
async function hasSqliteHeader(file: string): Promise<boolean> {
  const longest = Math.max(...sqliteHeaders.map(header => header.length));
  const handle = await open(file, "r");
  try {
    const head = Buffer.alloc(longest);
    const { bytesRead } = await handle.read(head, 0, longest, 0);
    return sqliteHeaders.some(header => bytesRead >= header.length && head.subarray(0, header.length).equals(header));
  } finally {
    await handle.close();
  }
}
/**
 * Searches a file for any of `needles`, `STORE_SEARCH_CHUNK_BYTES` at a time, and
 * says how many bytes it read. Each chunk is searched together with the last
 * `longest needle - 1` bytes of the one before, so a needle a chunk boundary cuts
 * is still found, and memory is one chunk whatever the file's size. It reads to
 * the end even after a match, so `bytes` is the file's whole length.
 */
async function searchStoreFile(file: string, needles: readonly Buffer[]): Promise<{ found: boolean; bytes: number }> {
  const overlap = Math.max(...needles.map(needle => needle.length)) - 1;
  const buffer = Buffer.alloc(overlap + STORE_SEARCH_CHUNK_BYTES);
  const handle = await open(file, "r");
  try {
    let carried = 0; let bytes = 0; let found = false;
    for (;;) {
      const { bytesRead } = await handle.read(buffer, carried, STORE_SEARCH_CHUNK_BYTES, null);
      if (bytesRead === 0) return { found, bytes };
      bytes += bytesRead;
      const filled = carried + bytesRead;
      if (!found) found = needles.some(needle => buffer.subarray(0, filled).includes(needle));
      carried = Math.min(overlap, filled);
      buffer.copyWithin(0, filled - carried, filled);
    }
  } finally {
    await handle.close();
  }
}
function normalizeApprovedPath(value: string): string | undefined {
  if (typeof value !== "string" || value.length === 0 || value.length > 512 || value.includes("\\") || value.includes("\0") || path.isAbsolute(value)) return undefined;
  const parts = value.split("/");
  if (parts.some(part => !part || part === "." || part === "..")) return undefined;
  return parts.join("/");
}
function joinRelative(parent: string, child: string): string { return parent ? parent + "/" + child : child; }
function isInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}
function samePath(left: string, right: string): boolean {
  const normalize = (value: string): string => process.platform === "win32" ? value.toLowerCase() : value;
  return normalize(path.normalize(left)) === normalize(path.normalize(right));
}
function sanitizePath(relativePath: string, secret: string): string {
  const escaped = secret.replace(/[.*+?^$(){}|[\]\\]/gu, "\\$&");
  const redacted = relativePath.replace(new RegExp(escaped, "giu"), "[redacted]").replace(/[\u0000-\u001f\u007f]/gu, "?");
  if (redacted.length <= 240) return redacted;
  return "[long-path-sha256:" + createHash("sha256").update(redacted).digest("hex") + "]";
}
