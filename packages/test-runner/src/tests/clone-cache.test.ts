import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import type { ClonePackage } from "@fluxiq-web-extension/test-contracts";
import { ClonePackageCache } from "../clone-cache.js";

const execFileAsync = promisify(execFile);

const scope = { origin: "https://source.example.test", username: "runner", projectId: "project.source", flowId: "flow.source" };
const revision = { updatedAt: 2, version: "1.0.0", fingerprint: "a".repeat(64) };
const clonePackage: ClonePackage = {
  schemaVersion: "0.1",
  source: { origin: scope.origin, projectId: scope.projectId, flowId: scope.flowId, contentHash: "b".repeat(64), updatedAt: 2 },
  flowDocument: { schemaVersion: "0.1", projectId: scope.projectId, flowId: scope.flowId, name: "Source", nodes: [], edges: [], publication: { status: "draft" } },
  dependencies: [
    { dependencyId: "local:project", kind: "flow-local-reference", referenceId: scope.projectId, decision: "remap", reason: "Project ID is remapped." },
    { dependencyId: "local:flow", kind: "flow-local-reference", referenceId: scope.flowId, decision: "remap", reason: "Flow ID is remapped." },
  ],
  compatibility: { verdict: "compatible", reasons: [] },
  idMap: [{ kind: "project", sourceId: scope.projectId, destinationId: "project.destination" }, { kind: "flow", sourceId: scope.flowId, destinationId: "flow.destination" }],
};

test("atomically reuses a valid source-scoped package and never persists secrets", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-clone-cache-"));
  try {
    const cache = new ClonePackageCache(root);
    assert.equal((await cache.load(scope, revision)).status.state, "missing");
    assert.equal((await cache.save(scope, revision, clonePackage)).state, "valid");
    const loaded = await cache.load(scope, revision);
    assert.deepEqual(loaded.clonePackage, clonePackage);
    const persisted = await readFile(cache.pathFor(scope), "utf8");
    for (const secret of ["password", "cookie", "authorization", "totp"]) assert.equal(persisted.toLowerCase().includes(`\"${secret}\"`), false);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("quarantines changed, corrupt, and mismatched entries instead of returning them", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-clone-cache-"));
  try {
    const cache = new ClonePackageCache(root);
    await cache.save(scope, revision, clonePackage);
    assert.equal((await cache.load(scope, { ...revision, updatedAt: 3 })).status.state, "stale");
    assert.equal((await cache.status(scope)).state, "missing");
    await writeFile(cache.pathFor(scope), "{not-json", "utf8");
    assert.equal((await cache.status(scope)).state, "corrupt");
    const quarantined = await readdir(path.join(cache.directory, ".quarantine"));
    assert.equal(quarantined.length, 2);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("enforces entry size and age bounds", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-clone-cache-"));
  let now = new Date("2026-01-01T00:00:00.000Z");
  try {
    const cache = new ClonePackageCache(root, { now: () => now, maxAgeMs: 1_000, maxEntryBytes: 4_096 });
    await cache.save(scope, revision, clonePackage);
    now = new Date(now.getTime() + 1_001);
    assert.equal((await cache.status(scope)).state, "stale");
    const tiny = new ClonePackageCache(root, { maxEntryBytes: 10 });
    await assert.rejects(() => tiny.save(scope, revision, clonePackage), /size bound/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("serializes simultaneous independent-run writes with one complete valid winner", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-clone-cache-race-"));
  try {
    const cache = new ClonePackageCache(root);
    const alternate: ClonePackage = {
      ...clonePackage,
      idMap: [
        { kind: "project", sourceId: scope.projectId, destinationId: "project.destination.two" },
        { kind: "flow", sourceId: scope.flowId, destinationId: "flow.destination.two" },
      ],
    };
    await cache.save(scope, revision, clonePackage);
    const operations = Array.from({ length: 12 }, (_, index) => index % 3 === 0
      ? cache.load(scope, revision).then(result => result.status)
      : cache.save(scope, revision, index % 2 === 0 ? clonePackage : alternate));
    const results = await Promise.all(operations);
    for (const result of results) assert.notEqual(result.state, "corrupt");
    const final = await cache.load(scope, revision);
    assert.equal(final.status.state, "valid");
    assert.ok(JSON.stringify(final.clonePackage) === JSON.stringify(clonePackage) || JSON.stringify(final.clonePackage) === JSON.stringify(alternate));
    const names = await readdir(cache.directory);
    assert.equal(names.some(name => name.endsWith(".tmp") || name.endsWith(".lock")), false);
    const persisted = await readFile(cache.pathFor(scope), "utf8");
    for (const secret of ["password-value", "cookie-value", "totp-value", "authorization-value"]) assert.equal(persisted.includes(secret), false);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("concurrent status and clear stay scoped and return no cached package content", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-clone-cache-controls-"));
  try {
    const cache = new ClonePackageCache(root);
    await cache.save(scope, revision, clonePackage);
    const results = await Promise.all([cache.status(scope), cache.clear(scope), cache.status(scope)]);
    for (const status of results) {
      assert.equal(status.origin, scope.origin);
      assert.equal(status.username, scope.username);
      assert.equal("clonePackage" in status, false);
      assert.equal(JSON.stringify(status).includes("flowDocument"), false);
    }
    assert.equal((await cache.status(scope)).state, "missing");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("clone-cache refresh reports invalidate-now and refresh-on-next-run semantics", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-clone-cache-cli-"));
  try {
    const cache = new ClonePackageCache(root);
    await cache.save(scope, revision, clonePackage);
    const cliPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "cli.js");
    const env = { ...process.env, FLUXIQ_WEB_EXTENSION_ROOT: root, FLUXIQ_TEST_RUNS_DIR: root, FLUXIQ_TEST_TARGET: "clone", FLUXIQ_TEST_BASE_URL: scope.origin, FLUXIQ_TEST_USERNAME: scope.username, FLUXIQ_TEST_PROJECT_ID: scope.projectId, FLUXIQ_TEST_FLOW_ID: scope.flowId };
    const result = JSON.parse((await execFileAsync(process.execPath, [cliPath, "clone-cache", "refresh"], { env })).stdout) as Record<string, unknown>;
    assert.deepEqual(result, { command: "clone-cache.refresh", state: "missing", ...scope, effect: "invalidated; refresh occurs on the next clone run" });
    assert.equal(JSON.stringify(result).includes("flowDocument"), false);
    assert.equal((await cache.status(scope)).state, "missing");
  } finally { await rm(root, { recursive: true, force: true }); }
});
