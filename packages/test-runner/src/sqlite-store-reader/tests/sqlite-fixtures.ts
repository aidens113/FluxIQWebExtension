import { spawnSync } from "node:child_process";

/** A value bound into a row: text, a number, NULL, or a blob holding `blob` in one text encoding. */
export type SqliteFixtureCell = string | number | null | { blob: string; encoding: "utf8" | "utf16le" | "utf16be" };

/**
 * One database a test creates with Node's built-in SQLite, the SQLite the reader
 * uses, so a fixture is laid out exactly as SQLite lays out a real store.
 *
 * - `statements` run first, in order.
 * - `virtualTables` are written into `sqlite_schema` directly, because this
 *   SQLite has no FTS5 or R*Tree module to create them with.
 * - `rows` are inserted last, with their cells bound.
 * - `journal: "wal"` leaves the rows in an uncheckpointed `-wal` beside the
 *   database, as a store Core holds open leaves them: the database and its log
 *   are copied while the connection is still open.
 */
export type SqliteFixture = {
  file: string;
  encoding?: "UTF-8" | "UTF-16le" | "UTF-16be";
  pageSize?: number;
  statements: readonly string[];
  virtualTables?: readonly { name: string; sql: string }[];
  rows?: readonly { sql: string; cells: readonly SqliteFixtureCell[] }[];
  journal?: "wal";
};

const FIXTURE_WRITER = String.raw`"use strict";
const { copyFileSync, readFileSync, rmSync } = require("node:fs");
const { DatabaseSync } = require("node:sqlite");
const bind = cell => cell !== null && typeof cell === "object"
  ? (cell.encoding === "utf16be" ? Buffer.from(cell.blob, "utf16le").swap16() : Buffer.from(cell.blob, cell.encoding))
  : cell;
for (const fixture of JSON.parse(readFileSync(0, "utf8"))) {
  const wal = fixture.journal === "wal";
  const target = wal ? fixture.file + ".building" : fixture.file;
  const database = new DatabaseSync(target);
  database.exec("PRAGMA page_size = " + Number(fixture.pageSize ?? 4096));
  database.exec("PRAGMA encoding = '" + (fixture.encoding ?? "UTF-8") + "'");
  database.exec("PRAGMA synchronous = OFF");
  for (const statement of fixture.statements) database.exec(statement);
  for (const table of fixture.virtualTables ?? []) {
    database.exec("PRAGMA writable_schema = ON");
    database.prepare("INSERT INTO sqlite_schema(type, name, tbl_name, rootpage, sql) VALUES ('table', ?, ?, 0, ?)").run(table.name, table.name, table.sql);
    database.exec("PRAGMA writable_schema = OFF");
  }
  if (wal) {
    database.prepare("PRAGMA journal_mode = WAL").get();
    database.exec("PRAGMA wal_autocheckpoint = 0");
  }
  for (const row of fixture.rows ?? []) database.prepare(row.sql).run(...row.cells.map(bind));
  if (wal) {
    copyFileSync(target, fixture.file);
    copyFileSync(target + "-wal", fixture.file + "-wal");
  }
  database.close();
  if (wal) for (const part of ["", "-wal", "-shm"]) rmSync(target + part, { force: true });
}
`;

/** Creates every fixture in one `node --experimental-sqlite` process, and throws if any could not be created. */
export function createSqliteDatabases(fixtures: readonly SqliteFixture[]): void {
  const result = spawnSync(process.execPath, ["--experimental-sqlite", "--disable-warning=ExperimentalWarning", "-e", FIXTURE_WRITER], {
    input: JSON.stringify(fixtures), encoding: "utf8", windowsHide: true, maxBuffer: 1_048_576,
    env: { SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP, TMP: process.env.TMP, TMPDIR: process.env.TMPDIR },
  });
  if (result.status !== 0) throw new Error(`Creating ${fixtures.length} SQLite fixture(s) exited ${String(result.status)}: ${result.stderr}`);
}
