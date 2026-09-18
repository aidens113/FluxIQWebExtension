import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { RunnerFailure } from "../failure.js";
import { certifyDemoLlmSetupArtifacts } from "../demo-llm-attestation.js";
import { SECRET_LEAK_ATTESTATION_RUN_LIMITS } from "../secret-leak-attestation.js";
import { createSqliteDatabases } from "../sqlite-store-reader/tests/sqlite-fixtures.js";

const sentinel = "synthetic-deepseek-setup-sentinel-123456";

async function demoWorkspace(t: test.TestContext): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-demo-llm-attestation-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const relative of ["evidence", "logs", "fluxiq-root/.fluxiq"]) {
    await mkdir(path.join(root, ...relative.split("/")), { recursive: true });
  }
  await writeFile(path.join(root, "latest-evidence.json"), JSON.stringify({ runId: "safe-run", path: "evidence/safe-run" }));
  await writeFile(path.join(root, "evidence", "summary.json"), JSON.stringify({ status: "passed" }));
  await writeFile(path.join(root, "logs", "core.log"), "setup completed\n");
  await writeFile(path.join(root, "fluxiq-root", ".fluxiq", "metadata.json"), JSON.stringify({ provider: "deepseek" }));
  return root;
}

test("returns only sanitized aggregate attestation for the reviewed setup scope", async t => {
  const root = await demoWorkspace(t);
  const result = await certifyDemoLlmSetupArtifacts({ workspaceRoot: root, secretLiteral: sentinel });
  assert.equal(result.findingCount, 0);
  assert.deepEqual(result.categories, []);
  assert.ok(result.scannedFiles >= 4);
  assert.equal(JSON.stringify(result).includes(root), false);
  assert.equal(JSON.stringify(result).includes(sentinel), false);
});

test("blocks setup success when an approved persistent artifact contains the secret", async t => {
  const root = await demoWorkspace(t);
  await writeFile(path.join(root, "logs", "provider.log"), "unexpected=" + sentinel);
  await assert.rejects(
    certifyDemoLlmSetupArtifacts({ workspaceRoot: root, secretLiteral: sentinel }),
    error => error instanceof RunnerFailure
      && error.message === "DeepSeek setup artifact attestation failed"
      && !error.message.includes(sentinel)
      && !error.message.includes(root),
  );
});

const MIB = 1_048_576;
const BLOB_TABLE = "CREATE TABLE blobs(body BLOB)";

test("scans Core databases and a -wal over the default 1 MiB, and over the default 16 MiB together, up to the Lab run's ceilings", async t => {
  const root = await demoWorkspace(t);
  const store = path.join(root, "fluxiq-root", ".fluxiq");
  createSqliteDatabases([
    { file: path.join(store, "project.sqlite"), statements: [BLOB_TABLE, "INSERT INTO blobs VALUES (zeroblob(7500000))"], rows: [{ sql: "INSERT INTO blobs VALUES (zeroblob(2000000))", cells: [] }], journal: "wal" },
    { file: path.join(store, "global.sqlite"), statements: [BLOB_TABLE, "INSERT INTO blobs VALUES (zeroblob(7500000))"] },
  ]);
  const sizes = await Promise.all(["project.sqlite", "project.sqlite-wal", "global.sqlite"].map(async name => (await stat(path.join(store, name))).size));
  const storeBytes = sizes.reduce((sum, size) => sum + size, 0);
  assert.ok(sizes.every(size => size > MIB && size < 8 * MIB), `each store file is over 1 MiB and under 8 MiB: ${sizes.join(", ")}`);
  assert.ok(storeBytes > 16 * MIB && storeBytes < 64 * MIB, `the store files together are over 16 MiB and under 64 MiB: ${storeBytes}`);

  const result = await certifyDemoLlmSetupArtifacts({ workspaceRoot: root, secretLiteral: sentinel });
  assert.equal(result.findingCount, 0);
  assert.ok(result.scannedBytes >= storeBytes, `every store byte was searched: ${result.scannedBytes} of at least ${storeBytes}`);
  assert.ok(result.scannedFiles >= 7);
  assert.equal(JSON.stringify(result).includes(root), false);
  assert.equal(JSON.stringify(result).includes(sentinel), false);
});

/**
 * The size a live run really produces. On 2026-09-18 one
 * `social-scheduler-week-ahead` run left a 10.02 MiB `.fluxiq/global.sqlite`, and
 * charging it to the 8 MiB text ceiling failed that run, and every run like it, as
 * `unscanned-store` on a store nothing was wrong with, and a completed
 * state-changing run has since left 85.5 MiB. A store has no size ceiling, so one
 * past the 64 MiB text total is read rather than refused.
 */
test("scans a Core database past both text ceilings, the size a completed run leaves behind", async t => {
  const root = await demoWorkspace(t);
  const database = path.join(root, "fluxiq-root", ".fluxiq", "global.sqlite");
  createSqliteDatabases([{ file: database, statements: [BLOB_TABLE, "INSERT INTO blobs VALUES (zeroblob(70000000))"] }]);
  const size = (await stat(database)).size;
  assert.ok(size > SECRET_LEAK_ATTESTATION_RUN_LIMITS.maxTotalBytes, `the store is past the text total: ${size}`);

  const result = await certifyDemoLlmSetupArtifacts({ workspaceRoot: root, secretLiteral: sentinel });

  assert.equal(result.findingCount, 0);
  assert.ok(result.scannedBytes >= size, `every store byte was searched: ${result.scannedBytes} of at least ${size}`);
});

test("still fails setup on a Core database the scan cannot read", async t => {
  const root = await demoWorkspace(t);
  const database = path.join(root, "fluxiq-root", ".fluxiq", "project.sqlite");
  // Named as a store, but no reader can open it: absence cannot be attested.
  await writeFile(database, Buffer.alloc(2 * MIB));
  await assert.rejects(
    certifyDemoLlmSetupArtifacts({ workspaceRoot: root, secretLiteral: sentinel }),
    error => error instanceof RunnerFailure
      && error.message === "DeepSeek setup artifact attestation failed"
      && !error.message.includes(root),
  );
});
