import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { attestRunRedaction, runRedactionScopes, runRedactionState } from "../index.js";

const password = "synthetic-redaction-password-0001";
const card = "4000000000000000";

/**
 * A temporary run laid out the way `runScenario` leaves one before cleanup: the
 * bundle's staging directory beside the isolated run's FluxIQ storage, holding
 * one persisted recording.
 */
async function runLayout(t: test.TestContext) {
  const runsDirectory = await mkdtemp(path.join(os.tmpdir(), "fluxiq-redaction-attestation-"));
  t.after(() => rm(runsDirectory, { recursive: true, force: true }));
  const bundleStagingPath = path.join(runsDirectory, ".staging-run-test");
  const workspaceStorageDir = path.join(runsDirectory, ".work", "run-test", "fluxiq-root", ".fluxiq");
  const recordingDirectory = path.join(workspaceStorageDir, "artifacts", "automation-studio", "projects", "project_one", "recordings", "recording_one");
  await mkdir(path.join(bundleStagingPath, "snapshots"), { recursive: true });
  await mkdir(path.join(bundleStagingPath, "logs"), { recursive: true });
  await mkdir(recordingDirectory, { recursive: true });
  await writeFile(path.join(bundleStagingPath, "events.ndjson"), JSON.stringify({ trigger: "final", summary: "Scenario completed" }) + "\n");
  await writeFile(path.join(recordingDirectory, "recording.json"), JSON.stringify({ recordingId: "recording_one", entryCount: 2 }));
  await writeFile(path.join(recordingDirectory, "timeline.jsonl"), JSON.stringify({ type: "web.element.input_changed", valueWithheld: true }) + "\n");
  return { bundleStagingPath, workspaceStorageDir, recordingDirectory, scopes: runRedactionScopes({ bundleStagingPath, workspaceStorageDir }) };
}

test("a declared literal persisted in the workspace's recording is a finding, named by scope and path only", async t => {
  const run = await runLayout(t);
  await writeFile(path.join(run.recordingDirectory, "timeline.jsonl"), JSON.stringify({ type: "web.element.input_changed", value: password }) + "\n");

  const attestation = await attestRunRedaction({ literals: [password, card], scopes: run.scopes });

  assert.equal(attestation.status, "failed");
  assert.equal(attestation.findingCount, 1);
  assert.deepEqual(attestation.findings, [{
    scope: "workspace",
    path: ".fluxiq/artifacts/automation-studio/projects/project_one/recordings/recording_one/timeline.jsonl",
    categories: ["secret-literal"],
  }]);
  assert.equal(runRedactionState(attestation), "failed");
  assert.equal(JSON.stringify(attestation).includes(password), false);
});

/**
 * A one-table SQLite database laid out byte for byte as the file format
 * specifies (sqlite.org/fileformat2.html), because the test-runner has no SQLite
 * dependency: page 1 holds the schema row for `t(v TEXT)`, page 2 the one row
 * whose `v` is `text`, and both store text in the database's `encoding`.
 */
function sqliteDatabase(text: string, encoding: "utf8" | "utf16le"): Buffer {
  const pageSize = 4096;
  const file = Buffer.alloc(pageSize * 2);
  file.write("SQLite format 3\0", 0, "latin1");
  file.writeUInt16BE(pageSize, 16);
  file.set([1, 1, 0, 64, 32, 32], 18); // legacy file format, no reserved bytes, fixed payload fractions
  file.writeUInt32BE(1, 24); // change counter, matched at 92 so the page count at 28 is trusted
  file.writeUInt32BE(2, 28);
  file.writeUInt32BE(1, 40); // schema cookie
  file.writeUInt32BE(4, 44); // schema format
  file.writeUInt32BE(encoding === "utf8" ? 1 : 2, 56);
  file.writeUInt32BE(1, 92);
  file.writeUInt32BE(3_046_001, 96);
  const encoded = (value: string) => Buffer.from(value, encoding);
  const varint = (value: number) => Buffer.from(value < 0x80 ? [value] : [0x80 | (value >> 7), value & 0x7f]);
  const leafTablePage = (pageStart: number, values: ReadonlyArray<Buffer | number>) => {
    const types = Buffer.concat(values.map(value => varint(typeof value === "number" ? 1 : 13 + 2 * value.length)));
    const payload = Buffer.concat([varint(types.length + 1), types, ...values.map(value => typeof value === "number" ? Buffer.from([value]) : value)]);
    const cell = Buffer.concat([varint(payload.length), varint(1), payload]);
    const cellOffset = pageSize - cell.length;
    const header = pageStart === 0 ? 100 : pageStart;
    cell.copy(file, pageStart + cellOffset);
    file.writeUInt8(0x0d, header); // leaf table b-tree page, no freeblock, one cell
    file.writeUInt16BE(1, header + 3);
    file.writeUInt16BE(cellOffset, header + 5);
    file.writeUInt16BE(cellOffset, header + 8);
  };
  leafTablePage(0, [encoded("table"), encoded("t"), encoded("t"), 2, encoded("CREATE TABLE t(v TEXT)")]);
  leafTablePage(pageSize, [encoded(text)]);
  return file;
}

/** A write-ahead log holding `page` as page 2 in one frame. Checksums and salts are zero: the scan reads bytes, not frames. */
function writeAheadLog(page: Buffer): Buffer {
  const log = Buffer.alloc(32 + 24 + page.length);
  log.writeUInt32BE(0x377f0682, 0);
  log.writeUInt32BE(3_007_000, 4);
  log.writeUInt32BE(page.length, 8);
  log.writeUInt32BE(2, 32);
  log.writeUInt32BE(2, 36);
  page.copy(log, 56);
  return log;
}

test("a declared literal a workspace's SQLite store holds is a finding, in the database or its write-ahead log, in either text encoding", async t => {
  const run = await runLayout(t);
  const projectDirectory = path.join(run.recordingDirectory, "..", "..");
  await writeFile(path.join(run.workspaceStorageDir, "global.sqlite"), sqliteDatabase(JSON.stringify({ visibleText: password }), "utf8"));
  await writeFile(path.join(projectDirectory, "project.sqlite"), sqliteDatabase(JSON.stringify({ valueWithheld: true }), "utf16le"));
  await writeFile(path.join(projectDirectory, "project.sqlite-wal"), writeAheadLog(sqliteDatabase(card, "utf16le").subarray(4096)));
  await writeFile(path.join(projectDirectory, "project.sqlite-shm"), Buffer.alloc(32_768));

  const attestation = await attestRunRedaction({ literals: [password, card], scopes: run.scopes });

  assert.equal(attestation.status, "failed");
  assert.deepEqual(attestation.findings, [
    { scope: "workspace", path: ".fluxiq/artifacts/automation-studio/projects/project_one/project.sqlite-wal", categories: ["secret-literal"] },
    { scope: "workspace", path: ".fluxiq/global.sqlite", categories: ["secret-literal"] },
  ]);
  // Four stores read, beside the recording's two files, and none passed over as binary.
  assert.deepEqual(attestation.scopes.map(scope => [scope.name, scope.scannedFiles, scope.skippedBinaryFiles]), [["bundle", 1, 0], ["workspace", 6, 0]]);
  assert.equal(runRedactionState(attestation), "failed");
  const serialized = JSON.stringify(attestation);
  assert.equal(serialized.includes(password), false);
  assert.equal(serialized.includes(card), false);
});

test("a clean run scans both trees for every literal and yields no finding", async t => {
  const run = await runLayout(t);

  const attestation = await attestRunRedaction({ literals: [password, card, password], scopes: run.scopes });

  assert.equal(attestation.status, "passed");
  assert.equal(attestation.literalCount, 2);
  assert.equal(attestation.findingCount, 0);
  assert.deepEqual(attestation.findings, []);
  assert.deepEqual(attestation.advisories, []);
  // Files were read, so "no finding" is an observation and not a scan that never ran.
  assert.deepEqual(attestation.scopes.map(scope => [scope.name, scope.scannedFiles]), [["bundle", 1], ["workspace", 2]]);
  assert.equal(runRedactionState(attestation), "verified");
});

test("a literal in the bundle is found too, and a path spelling another literal is redacted against all of them", async t => {
  const run = await runLayout(t);
  await writeFile(path.join(run.bundleStagingPath, "snapshots", `field-${card}.json`), JSON.stringify({ typed: password }));

  const attestation = await attestRunRedaction({ literals: [password, card], scopes: run.scopes });

  assert.equal(attestation.status, "failed");
  assert.deepEqual(attestation.findings, [{ scope: "bundle", path: ".staging-run-test/snapshots/field-[redacted].json", categories: ["secret-literal"] }]);
  const serialized = JSON.stringify(attestation);
  assert.equal(serialized.includes(card), false);
  assert.equal(serialized.includes(password), false);
});

test("credential syntax without a declared literal is an advisory, not a failure", async t => {
  const run = await runLayout(t);
  await writeFile(path.join(run.bundleStagingPath, "logs", "core.log"), "Authorization: Bearer synthetic-header-value\n");

  const attestation = await attestRunRedaction({ literals: [password], scopes: run.scopes });

  assert.equal(attestation.status, "passed");
  assert.deepEqual(attestation.advisories, [{ scope: "bundle", path: ".staging-run-test/logs/core.log", categories: ["authorization-material"] }]);
  assert.equal(runRedactionState(attestation), "verified");
});

test("a scope the scan cannot read fails closed", async t => {
  const run = await runLayout(t);
  await rm(run.workspaceStorageDir, { recursive: true, force: true });

  const attestation = await attestRunRedaction({ literals: [password], scopes: run.scopes });

  assert.equal(attestation.status, "failed");
  assert.deepEqual(attestation.findings, [{ scope: "workspace", path: ".fluxiq", categories: ["unreadable-text"] }]);
});

test("a scenario that declares no literal is not applicable, scans nothing, and verifies nothing", async t => {
  const run = await runLayout(t);

  const attestation = await attestRunRedaction({ literals: [], scopes: run.scopes });

  assert.deepEqual(attestation, { status: "not-applicable", literalCount: 0, scopes: [], findingCount: 0, findings: [], advisories: [] });
  assert.equal(runRedactionState(attestation), "not_applicable");
  assert.equal(runRedactionState(undefined), "pending");
});

/**
 * A run on a workspace that outlives it: every file `runLayout` wrote, and a
 * literal an earlier run left in its own recording, predate the run. A test's
 * files are all created now, so this run starts a minute from now, and each
 * file it writes through `write` is dated after that.
 */
async function persistentRun(t: test.TestContext) {
  const run = await runLayout(t);
  const startedAt = Date.now() + 60_000;
  const earlierRecording = path.join(run.recordingDirectory, "..", "recording_earlier");
  await mkdir(earlierRecording);
  await writeFile(path.join(earlierRecording, "timeline.jsonl"), JSON.stringify({ type: "web.element.input_changed", value: password }) + "\n");
  const write = async (relative: string, contents: string | Uint8Array) => {
    const file = path.join(run.workspaceStorageDir, ...relative.split("/"));
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, contents);
    const writtenAt = new Date(startedAt + 1_000);
    await utimes(file, writtenAt, writtenAt);
  };
  return { ...run, write, scopes: runRedactionScopes({ bundleStagingPath: run.bundleStagingPath, workspaceStorageDir: run.workspaceStorageDir, workspaceWrittenSince: startedAt }) };
}

test("a workspace that outlives the run is scanned only for what this run wrote, and fails closed on what it wrote and cannot read", async t => {
  const run = await persistentRun(t);
  const runTimeline = "artifacts/automation-studio/projects/project_one/recordings/recording_run/timeline.jsonl";
  await run.write(runTimeline, JSON.stringify({ type: "web.element.input_changed", valueWithheld: true }) + "\n");

  const clean = await attestRunRedaction({ literals: [password], scopes: run.scopes });

  // The earlier run's leak is outside the bound; this run's recording is read.
  assert.equal(clean.status, "passed");
  assert.deepEqual(clean.findings, []);
  assert.deepEqual(clean.scopes.map(scope => [scope.name, scope.scannedFiles]), [["bundle", 1], ["workspace", 1]]);

  await run.write(runTimeline, JSON.stringify({ type: "web.element.input_changed", value: password }) + "\n");
  await run.write("artifacts/automation-studio/projects/project_one/flows/flow_run.json", new Uint8Array([0x7b, 0x00, 0x7d]));
  const leaked = await attestRunRedaction({ literals: [password], scopes: run.scopes });

  assert.equal(leaked.status, "failed");
  assert.deepEqual(leaked.findings, [
    { scope: "workspace", path: ".fluxiq/artifacts/automation-studio/projects/project_one/flows/flow_run.json", categories: ["unreadable-text"] },
    { scope: "workspace", path: `.fluxiq/${runTimeline}`, categories: ["secret-literal"] },
  ]);
  assert.equal(JSON.stringify(leaked).includes(password), false);
});

test("a bounded scope reads every file the run wrote however many there are, and hands the scan every link whatever its age", async t => {
  const run = await persistentRun(t);
  for (let index = 0; index < 40; index += 1) await run.write(`flows/flow-${String(index).padStart(2, "0")}.json`, index === 39 ? JSON.stringify({ typed: password }) : "{}");
  // A link that predates the run. The walk does not follow it, so it cannot say
  // what lies behind it; the scan must be given it, and refuses it.
  await symlink(run.recordingDirectory, path.join(run.workspaceStorageDir, "linked-recordings"), "junction");

  const attestation = await attestRunRedaction({ literals: [password], scopes: run.scopes });

  assert.deepEqual(attestation.findings, [
    { scope: "workspace", path: ".fluxiq/flows/flow-39.json", categories: ["secret-literal"] },
    { scope: "workspace", path: ".fluxiq/linked-recordings", categories: ["unsafe-reparse"] },
  ]);
  // Forty files, more than one scan's 32 approved paths, all read.
  assert.deepEqual(attestation.scopes.map(scope => [scope.name, scope.scannedFiles]), [["bundle", 1], ["workspace", 40]]);
});

test("only the workspace's own storage directory and the staging bundle are scoped", () => {
  const bundleStagingPath = path.resolve("runs", ".staging-run-x");
  const workspaceStorageDir = path.resolve("runs", ".work", "run-x", "fluxiq-root", ".fluxiq");
  assert.deepEqual(runRedactionScopes({ bundleStagingPath, workspaceStorageDir }), [
    { name: "bundle", root: path.resolve("runs"), paths: [".staging-run-x"] },
    { name: "workspace", root: path.resolve("runs", ".work", "run-x", "fluxiq-root"), paths: [".fluxiq"] },
  ]);
  assert.deepEqual(runRedactionScopes({ bundleStagingPath }), [{ name: "bundle", root: path.resolve("runs"), paths: [".staging-run-x"] }]);
  // Only a workspace that outlives the run carries a bound, and the bundle never does.
  assert.deepEqual(runRedactionScopes({ bundleStagingPath, workspaceStorageDir, workspaceWrittenSince: 1_000 }), [
    { name: "bundle", root: path.resolve("runs"), paths: [".staging-run-x"] },
    { name: "workspace", root: path.resolve("runs", ".work", "run-x", "fluxiq-root"), paths: [".fluxiq"], writtenSince: 1_000 },
  ]);
});
