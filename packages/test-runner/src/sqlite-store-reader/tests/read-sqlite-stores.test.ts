import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { readSqliteStores } from "../index.js";
import { createSqliteDatabases } from "./sqlite-fixtures.js";

const literal = "synthetic-sqlite-reader-literal-0123456789";

async function directory(t: test.TestContext): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-sqlite-reader-"));
  t.after(() => rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));
  return root;
}

test("finds the literal in a text cell in each database encoding, and in a blob cell in each text encoding", async t => {
  const root = await directory(t);
  const text = (["UTF-8", "UTF-16le", "UTF-16be"] as const).map(encoding => ({
    file: path.join(root, `text-${encoding}.sqlite`), encoding,
    statements: ["CREATE TABLE notes(id INTEGER PRIMARY KEY, body TEXT)"],
    rows: [{ sql: "INSERT INTO notes(body) VALUES (?)", cells: ["before " + literal + " after"] }],
  }));
  const blobs = (["utf8", "utf16le", "utf16be"] as const).map(encoding => ({
    file: path.join(root, `blob-${encoding}.sqlite`),
    statements: ["CREATE TABLE payloads(id INTEGER PRIMARY KEY, data BLOB)"],
    rows: [{ sql: "INSERT INTO payloads(data) VALUES (?)", cells: [{ blob: literal, encoding }] }],
  }));
  // Clean, and holding an integer past 2^53 that a read as `number` would fail on.
  const clean = { file: path.join(root, "clean.sqlite"), statements: ["CREATE TABLE counters(name TEXT, total INTEGER)", "INSERT INTO counters VALUES ('visits', 9223372036854775807)"] };
  const fixtures = [...text, ...blobs, clean];
  createSqliteDatabases(fixtures);

  const outcomes = await readSqliteStores({ databaseFiles: fixtures.map(fixture => fixture.file), literal });

  assert.deepEqual(outcomes, ["holds-literal", "holds-literal", "holds-literal", "holds-literal", "holds-literal", "holds-literal", "clean"]);
});

test("passes over a virtual table this SQLite has no module for, and reads the shadow table that stores its rows", async t => {
  const root = await directory(t);
  // The shapes Core's project database declares: FTS5 full-text and R*Tree tables.
  const virtualTables = [
    { name: "notes_fts", sql: "CREATE VIRTUAL TABLE notes_fts USING fts5(note_id UNINDEXED, body)" },
    { name: "bounds", sql: "CREATE VIRTUAL TABLE bounds USING rtree(id, min_x, max_x)" },
  ];
  const withShadowRow = (name: string, body: string) => ({
    file: path.join(root, name), virtualTables,
    statements: ["CREATE TABLE notes_fts_content(id INTEGER PRIMARY KEY, c0, c1)"],
    rows: [{ sql: "INSERT INTO notes_fts_content(c0, c1) VALUES (?, ?)", cells: ["note-1", body] }],
  });
  const holding = withShadowRow("holding.sqlite", "before " + literal + " after");
  const clean = withShadowRow("clean.sqlite", "nothing declared here");
  createSqliteDatabases([holding, clean]);

  assert.deepEqual(await readSqliteStores({ databaseFiles: [holding.file, clean.file], literal }), ["holds-literal", "clean"]);
});

test("reads rows that only an uncheckpointed write-ahead log beside the database holds", async t => {
  const root = await directory(t);
  const live = { file: path.join(root, "live.sqlite"), journal: "wal" as const, statements: ["CREATE TABLE notes(body TEXT)"], rows: [{ sql: "INSERT INTO notes VALUES (?)", cells: [literal] }] };
  createSqliteDatabases([live]);
  assert.equal((await readFile(live.file)).includes(literal), false);
  assert.equal(existsSync(live.file + "-wal"), true);

  assert.deepEqual(await readSqliteStores({ databaseFiles: [live.file], literal }), ["holds-literal"]);
});

test("a file that is not a database, or does not exist, is unreadable, and a missing one is never created", async t => {
  const root = await directory(t);
  const notADatabase = path.join(root, "not-a-database.sqlite");
  const missing = path.join(root, "missing.sqlite");
  await writeFile(notADatabase, Buffer.alloc(600, 1));

  assert.deepEqual(await readSqliteStores({ databaseFiles: [notADatabase, missing], literal }), ["unreadable", "unreadable"]);
  assert.equal(existsSync(missing), false);
  assert.deepEqual(await readSqliteStores({ databaseFiles: [], literal }), []);
});
