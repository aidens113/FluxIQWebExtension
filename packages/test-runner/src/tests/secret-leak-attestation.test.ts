import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { attestWorkspaceSecretAbsence, SECRET_LEAK_ATTESTATION_RUN_LIMITS } from "../secret-leak-attestation.js";
import { createSqliteDatabases, type SqliteFixture } from "../sqlite-store-reader/tests/sqlite-fixtures.js";

const sentinel = "synthetic-deepseek-sentinel-123456789";

async function workspace(t: test.TestContext): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-secret-attestation-"));
  t.after(() => rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));
  return root;
}

test("scans only approved text and skips bounded binary artifacts", async t => {
  const root = await workspace(t);
  await mkdir(path.join(root, "approved"), { recursive: true });
  await mkdir(path.join(root, "outside"), { recursive: true });
  await writeFile(path.join(root, "approved", "run.json"), JSON.stringify({ provider: "deepseek", status: "passed" }));
  await writeFile(path.join(root, "approved", "capture.png"), Buffer.concat([Buffer.from([0, 1, 2]), Buffer.from(sentinel)]));
  await writeFile(path.join(root, "outside", "not-scanned.log"), sentinel);

  const report = await attestWorkspaceSecretAbsence({
    workspaceRoot: root, secretLiteral: sentinel, approvedRelativePaths: ["approved"],
  });
  assert.deepEqual(report, {
    status: "passed", scannedFiles: 1,
    scannedBytes: Buffer.byteLength(JSON.stringify({ provider: "deepseek", status: "passed" })),
    skippedBinaryFiles: 1, findingCount: 0, findings: [],
  });
});

test("finds a synthetic literal and credential syntax without returning content or the literal", async t => {
  const root = await workspace(t);
  await mkdir(path.join(root, "logs"), { recursive: true });
  const name = "event-" + sentinel + ".log";
  const matchingContent = [
    "prefix " + sentinel + " suffix",
    JSON.stringify({ password: "synthetic-password" }),
    "OPENAI_API_KEY=synthetic-value",
    "Authorization: Bearer synthetic-value",
  ].join("\n");
  await writeFile(path.join(root, "logs", name), matchingContent);

  const report = await attestWorkspaceSecretAbsence({
    workspaceRoot: root, secretLiteral: sentinel, approvedRelativePaths: ["logs"],
  });
  assert.equal(report.status, "failed");
  assert.equal(report.findingCount, 1);
  assert.deepEqual(report.findings[0]?.categories, [
    "authorization-material", "credential-assignment", "credential-field", "secret-literal",
  ]);
  assert.match(report.findings[0]?.path ?? "", /\[redacted\]/i);
  const serialized = JSON.stringify(report);
  assert.equal(serialized.includes(sentinel), false);
  assert.equal(serialized.includes(matchingContent), false);
  assert.equal("content" in (report.findings[0] ?? {}), false);
});

const notesTable = "CREATE TABLE notes(id INTEGER PRIMARY KEY, body TEXT)";
const note = (body: string) => ({ sql: "INSERT INTO notes(body) VALUES (?)", cells: [body] });

test("searches a SQLite store and its sidecars for the literal in each text encoding, and reads the rows its write-ahead log holds", async t => {
  const root = await workspace(t);
  const store = path.join(root, "store");
  await mkdir(store, { recursive: true });
  createSqliteDatabases([
    { file: path.join(store, "global.sqlite"), statements: [notesTable], rows: [note(sentinel)] },
    // Clean in the database file: the literal is only in the uncheckpointed log beside it.
    { file: path.join(store, "project.sqlite"), encoding: "UTF-16le", journal: "wal", statements: [notesTable, `INSERT INTO notes(body) VALUES ('${JSON.stringify({ password: "withheld" })}')`], rows: [note(sentinel)] },
    { file: path.join(store, "legacy.sqlite3"), encoding: "UTF-16be", statements: [notesTable], rows: [note(sentinel)] },
    // A store with no store name is known by its database header.
    { file: path.join(store, "cache.dat"), encoding: "UTF-16le", statements: [notesTable], rows: [note(sentinel)] },
  ]);
  await writeFile(path.join(store, "project.sqlite-shm"), Buffer.alloc(128));
  assert.equal((await readFile(path.join(store, "project.sqlite"))).includes(Buffer.from(sentinel, "utf16le")), false);

  const report = await attestWorkspaceSecretAbsence({ workspaceRoot: root, secretLiteral: sentinel, approvedRelativePaths: ["store"] });

  // Only the literal is searched for in a store: credential syntax in page bytes is not a finding.
  assert.deepEqual(report.findings, [
    { path: "store/cache.dat", categories: ["secret-literal"] },
    { path: "store/global.sqlite", categories: ["secret-literal"] },
    { path: "store/legacy.sqlite3", categories: ["secret-literal"] },
    { path: "store/project.sqlite", categories: ["secret-literal"] },
    { path: "store/project.sqlite-wal", categories: ["secret-literal"] },
  ]);
  assert.equal(report.status, "failed");
  assert.equal(report.scannedFiles, 6);
  assert.equal(report.skippedBinaryFiles, 0);
  assert.equal(JSON.stringify(report).includes(sentinel), false);
});

test("a store the scan cannot read in full, or whose rows cannot be read, is an unscanned-store finding, not only a count", async t => {
  // `maxFileBytes` is deliberately far below every store here: a store is bounded
  // by `maxStoreBytes`, so `a-read.sqlite` is read although the text ceiling is 8
  // bytes, and only `b-oversize.sqlite` is over the ceiling that governs it.
  const root = await workspace(t);
  const store = path.join(root, "store");
  await mkdir(store, { recursive: true });
  createSqliteDatabases([{ file: path.join(store, "a-read.sqlite"), pageSize: 512, statements: ["CREATE TABLE notes(body TEXT)", "INSERT INTO notes VALUES ('clean')"] }]);
  const readable = (await stat(path.join(store, "a-read.sqlite"))).size;
  const notADatabase = Buffer.from("not a database, only text", "utf8");
  const orphanLog = Buffer.alloc(64, 1);
  await writeFile(path.join(store, "b-oversize.sqlite"), Buffer.alloc(readable + 176));
  await writeFile(path.join(store, "c-over-budget.sqlite-wal"), Buffer.alloc(300));
  await writeFile(path.join(store, "d-not-a-database.sqlite"), notADatabase);
  // A write-ahead log whose database is gone holds bytes no reader can turn into rows.
  await writeFile(path.join(store, "e-orphan.sqlite-wal"), orphanLog);

  const report = await attestWorkspaceSecretAbsence({
    workspaceRoot: root, secretLiteral: sentinel, approvedRelativePaths: ["store"], limits: { maxFileBytes: 8, maxStoreBytes: readable + 76, maxTotalBytes: readable + 276 },
  });

  assert.deepEqual(report, {
    status: "failed", scannedFiles: 3, scannedBytes: readable + notADatabase.byteLength + orphanLog.byteLength, skippedBinaryFiles: 0, findingCount: 4,
    findings: [
      { path: "store/b-oversize.sqlite", categories: ["unscanned-store"] },
      { path: "store/c-over-budget.sqlite-wal", categories: ["unscanned-store"] },
      { path: "store/d-not-a-database.sqlite", categories: ["unscanned-store"] },
      { path: "store/e-orphan.sqlite-wal", categories: ["unscanned-store"] },
    ],
  });
});

/**
 * The false failure of 2026-09-18. One live `social-scheduler-week-ahead` run
 * left a 10.02 MiB `.fluxiq/global.sqlite`, over the scan's 8 MiB `maxFileBytes`,
 * and the run failed as `security.redaction` with a single `unscanned-store`
 * finding on a store nothing was wrong with: the scan refused to read it on its
 * text budget alone. Every run in that corpus carried the same finding, and every
 * agent reading them was told to ignore it.
 *
 * A store that size is now bounded by `maxStoreBytes`, so it is read. What this
 * test holds is the other half: reading it must still catch a leak. The store is
 * built past `maxFileBytes` at the ceilings a Lab run actually uses, with a
 * synthetic secret in an uncheckpointed log that never reached the database file,
 * so finding it in the database takes both changed ceilings -- `visit` admitting
 * the oversize store, and `stageDatabase` copying it with its log for the cell
 * read.
 */
test("a synthetic secret in a store past the text ceiling is still found, at the ceilings a Lab run uses", async t => {
  const root = await workspace(t);
  const store = path.join(root, "store");
  await mkdir(store, { recursive: true });
  const database = path.join(store, "global.sqlite");
  // Nine rows of a megabyte of hex each, generated inside the fixture writer, carry
  // the database past `maxFileBytes` without sending nine megabytes to it.
  const megabyte = "INSERT INTO notes(body) VALUES (hex(randomblob(524288)))";
  createSqliteDatabases([{
    file: database, journal: "wal",
    statements: [notesTable, ...Array.from({ length: 9 }, () => megabyte)],
    rows: [note("planted " + sentinel + " leak")],
  }]);
  const size = (await stat(database)).size;
  const logSize = (await stat(database + "-wal")).size;
  assert.equal(size > SECRET_LEAK_ATTESTATION_RUN_LIMITS.maxFileBytes, true, `the store must pass the text ceiling, was ${size}`);
  assert.equal(size <= SECRET_LEAK_ATTESTATION_RUN_LIMITS.maxStoreBytes, true, `the store must fit the store ceiling, was ${size}`);
  // The secret never reached the database file, so only the cell read can find it there.
  assert.equal((await readFile(database)).includes(sentinel), false);

  const report = await attestWorkspaceSecretAbsence({
    workspaceRoot: root, secretLiteral: sentinel, approvedRelativePaths: ["store"], limits: SECRET_LEAK_ATTESTATION_RUN_LIMITS,
  });

  assert.deepEqual(report.findings, [
    { path: "store/global.sqlite", categories: ["secret-literal"] },
    { path: "store/global.sqlite-wal", categories: ["secret-literal"] },
  ]);
  assert.equal(report.status, "failed");
  // Both files were read, not passed over: the store's own bytes are in the total.
  assert.equal(report.scannedFiles, 2);
  assert.equal(report.scannedBytes, size + logSize);
  assert.equal(report.skippedBinaryFiles, 0);
  assert.equal(JSON.stringify(report).includes(sentinel), false);
});

test("a literal SQLite has split across overflow pages, which no byte search can see, is found by reading the store's cells", async t => {
  const root = await workspace(t);
  await mkdir(path.join(root, "split"), { recursive: true });
  // A 10,000-character row keeps its first 1,816 characters on its b-tree page and continues on overflow pages,
  // in each encoding at 4,096-byte pages. Starts 1,760 to 1,860 put the literal across that first boundary.
  const offsets = Array.from({ length: 101 }, (_, index) => 1_760 + index);
  const encodings = [["UTF-8", Buffer.from(sentinel, "utf8")], ["UTF-16le", Buffer.from(sentinel, "utf16le")], ["UTF-16be", Buffer.from(sentinel, "utf16le").swap16()]] as const;
  const fixtures: SqliteFixture[] = encodings.flatMap(([encoding]) => offsets.map(offset => ({
    file: path.join(root, "split", `${encoding}-${offset}.sqlite`), encoding, statements: [notesTable],
    rows: [note("x".repeat(offset) + sentinel + "y".repeat(10_000 - offset - sentinel.length))],
  })));
  createSqliteDatabases(fixtures);

  // The sweep really crosses a page boundary: at every start where the literal straddles it, no byte search finds it.
  for (const [encoding, encoded] of encodings) {
    const missedByBytes: number[] = [];
    for (const offset of offsets) {
      if (!(await readFile(path.join(root, "split", `${encoding}-${offset}.sqlite`))).includes(encoded)) missedByBytes.push(offset);
    }
    assert.equal(missedByBytes.length, sentinel.length - 1, `${encoding} starts a byte search misses`);
  }

  const report = await attestWorkspaceSecretAbsence({ workspaceRoot: root, secretLiteral: sentinel, approvedRelativePaths: ["split"] });

  const found = new Set(report.findings.filter(finding => finding.categories.includes("secret-literal")).map(finding => finding.path));
  assert.deepEqual(fixtures.map(fixture => "split/" + path.basename(fixture.file)).filter(relative => !found.has(relative)), []);
  assert.equal(report.findingCount, fixtures.length);
  assert.equal(report.findings.every(finding => finding.categories.length === 1), true);
  assert.equal(report.scannedFiles, fixtures.length);
  assert.equal(JSON.stringify(report).includes(sentinel), false);
});

test("fails closed on missing, escaping, oversized, and excessive approved paths", async t => {
  const root = await workspace(t);
  await mkdir(path.join(root, "evidence"), { recursive: true });
  await writeFile(path.join(root, "evidence", "oversize.log"), "x".repeat(32));
  await writeFile(path.join(root, "evidence", "nul.log"), Buffer.from([65, 0, 66]));

  const report = await attestWorkspaceSecretAbsence({
    workspaceRoot: root,
    secretLiteral: sentinel,
    approvedRelativePaths: ["missing.log", "../outside.log", "evidence/oversize.log", "evidence/nul.log", "extra.log"],
    limits: { maxFileBytes: 8, maxStoreBytes: 8, maxTotalBytes: 8, maxApprovedPaths: 4 },
  });
  assert.equal(report.status, "failed");
  const categories = new Set(report.findings.flatMap(finding => finding.categories));
  assert.equal(categories.has("path-escape"), true);
  assert.equal(categories.has("unreadable-text"), true);
  assert.equal(categories.has("oversize-text"), true);
  assert.equal(categories.has("file-limit"), true);
  assert.equal(JSON.stringify(report).includes(sentinel), false);
});

test("rejects a reparse-point scope without following it", async t => {
  const root = await workspace(t);
  const outside = await mkdtemp(path.join(os.tmpdir(), "fluxiq-secret-outside-"));
  t.after(() => rm(outside, { recursive: true, force: true }));
  await writeFile(path.join(outside, "leak.log"), sentinel);
  const link = path.join(root, "linked");
  try {
    await symlink(outside, link, process.platform === "win32" ? "junction" : "dir");
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && (error.code === "EPERM" || error.code === "EACCES")) {
      t.skip("symlink creation is unavailable");
      return;
    }
    throw error;
  }

  const report = await attestWorkspaceSecretAbsence({
    workspaceRoot: root, secretLiteral: sentinel, approvedRelativePaths: ["linked"],
  });
  assert.equal(report.status, "failed");
  assert.deepEqual(report.findings, [{ path: "linked", categories: ["unsafe-reparse"] }]);
  assert.equal(report.scannedFiles, 0);
});

test("rejects invalid inputs with fixed messages that contain no caller data", async () => {
  await assert.rejects(
    attestWorkspaceSecretAbsence({ workspaceRoot: "relative", secretLiteral: sentinel, approvedRelativePaths: ["logs"] }),
    error => error instanceof Error && error.message === "Secret attestation requires an absolute workspace root",
  );
  await assert.rejects(
    attestWorkspaceSecretAbsence({ workspaceRoot: path.resolve("."), secretLiteral: "short", approvedRelativePaths: ["logs"] }),
    error => error instanceof Error && error.message === "Secret attestation requires one bounded in-memory secret",
  );
});
