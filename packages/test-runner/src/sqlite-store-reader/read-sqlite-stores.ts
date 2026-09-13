import { spawn } from "node:child_process";

/**
 * What reading every stored cell of one SQLite database found.
 *
 * - `clean`: every table was read, and no text or blob cell holds the literal.
 * - `holds-literal`: a text cell, or a blob cell in UTF-8, UTF-16LE or UTF-16BE,
 *   holds it.
 * - `unreadable`: the database could not be opened, a table could not be read,
 *   or the reader process failed, so nothing is known about it.
 */
export type SqliteStoreReadOutcome = "clean" | "holds-literal" | "unreadable";

/** Database files to read, each with its `-wal` or `-journal` beside it when it has one, and the one literal to look for. */
export type SqliteStoreReadInput = { databaseFiles: readonly string[]; literal: string };

/**
 * How long one reader process may run before it is killed and every database it
 * was given counts as unreadable. At the scanner's absolute ceilings it is given
 * at most 64 MB of stores.
 */
const READER_TIMEOUT_MS = 120_000;

/** The reader prints one short outcome per database. Anything longer is not its output. */
const READER_OUTPUT_LIMIT_BYTES = 1_048_576;

/**
 * The reader, run by `node --experimental-sqlite`. It reads the literal and the
 * files from stdin and prints only one outcome per file, never a cell, a
 * message or the literal.
 *
 * Every ordinary table is read with `SELECT *`, `sqlite_schema` included. A
 * virtual table (`rootpage` 0) has no b-tree in the file: what it stores is in
 * its shadow tables, which are ordinary tables and read like any other. It is
 * not read itself, because this Node's SQLite has no FTS5 or R*Tree module and
 * Core's project database declares both. Integers are read as `bigint`, so a
 * value past 2^53 does not fail the read.
 */
const CELL_READER = String.raw`"use strict";
const { readFileSync, statSync } = require("node:fs");
const { DatabaseSync } = require("node:sqlite");
const request = JSON.parse(readFileSync(0, "utf8"));
const utf16le = Buffer.from(request.literal, "utf16le");
const encodings = [Buffer.from(request.literal, "utf8"), utf16le, Buffer.from(utf16le).swap16()];
const holdsLiteral = value => typeof value === "string"
  ? value.includes(request.literal)
  : value instanceof Uint8Array && encodings.some(encoded => Buffer.from(value.buffer, value.byteOffset, value.byteLength).includes(encoded));
const outcomes = request.databaseFiles.map(file => {
  let database;
  try {
    if (!statSync(file).isFile()) return "unreadable";
    database = new DatabaseSync(file);
    const tables = database.prepare("SELECT name FROM sqlite_schema WHERE type = 'table' AND rootpage <> 0").all().map(row => row.name);
    let found = false;
    for (const table of ["sqlite_schema", ...tables]) {
      const statement = database.prepare('SELECT * FROM "' + String(table).replaceAll('"', '""') + '"');
      statement.setReadBigInts(true);
      for (const row of statement.all()) if (Object.values(row).some(holdsLiteral)) found = true;
    }
    return found ? "holds-literal" : "clean";
  } catch {
    return "unreadable";
  } finally {
    try { database?.close(); } catch {}
  }
});
process.stdout.write(JSON.stringify(outcomes));
`;

/**
 * Reads every text and blob cell of every table in each database, in one Node
 * process with the built-in SQLite, and says for each whether the literal is
 * there. A byte search cannot say this: SQLite continues a long value on
 * overflow pages that begin with a page pointer and need not be adjacent, so a
 * literal split across them is never contiguous in the file.
 *
 * The files are opened read-write, so SQLite applies each one's `-wal` or rolls
 * back its hot `-journal`: pass copies, never a live store. A file that does not
 * exist is `unreadable`, never created.
 *
 * The literal goes to the reader on stdin, not its command line. The reader is
 * given only the environment a Node process needs, so no token, `NODE_OPTIONS`
 * preload or test-runner context reaches it, and its stderr is discarded. Any
 * failure of the process makes every database `unreadable`.
 */
export async function readSqliteStores(input: SqliteStoreReadInput): Promise<SqliteStoreReadOutcome[]> {
  if (input.databaseFiles.length === 0) return [];
  const unreadable = (): SqliteStoreReadOutcome[] => input.databaseFiles.map(() => "unreadable");
  const output = await runCellReader(JSON.stringify({ literal: input.literal, databaseFiles: input.databaseFiles }));
  if (output === undefined) return unreadable();
  let outcomes: unknown;
  try { outcomes = JSON.parse(output); } catch { return unreadable(); }
  if (!Array.isArray(outcomes) || outcomes.length !== input.databaseFiles.length) return unreadable();
  return outcomes.map((outcome): SqliteStoreReadOutcome => outcome === "clean" || outcome === "holds-literal" ? outcome : "unreadable");
}

function runCellReader(request: string): Promise<string | undefined> {
  return new Promise(resolve => {
    const child = spawn(process.execPath, ["--experimental-sqlite", "--disable-warning=ExperimentalWarning", "-e", CELL_READER], {
      env: readerEnvironment(), stdio: ["pipe", "pipe", "ignore"], windowsHide: true,
    });
    const chunks: Buffer[] = [];
    let outputBytes = 0;
    let failed = false;
    let settled = false;
    const timer = setTimeout(() => { failed = true; child.kill(); }, READER_TIMEOUT_MS);
    const settle = (output: string | undefined): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(output);
    };
    child.stdout.on("data", (chunk: Buffer) => {
      outputBytes += chunk.byteLength;
      if (outputBytes > READER_OUTPUT_LIMIT_BYTES) { failed = true; child.kill(); } else chunks.push(chunk);
    });
    child.on("error", () => settle(undefined));
    child.on("close", code => settle(failed || code !== 0 ? undefined : Buffer.concat(chunks).toString("utf8")));
    child.stdin.on("error", () => { failed = true; });
    child.stdin.end(request);
  });
}

/** What a Node process needs to start on Windows and find a temporary directory, and nothing else. */
function readerEnvironment(): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {};
  for (const name of ["SystemRoot", "TEMP", "TMP", "TMPDIR"]) {
    const value = process.env[name];
    if (value !== undefined) environment[name] = value;
  }
  return environment;
}
