import assert from "node:assert/strict";
import { mkdtemp, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { allocateLoopbackPort, allocatePersistentRun, allocateRun, validatePersistentWorkspaceName } from "../allocation.js";

test("allocates distinct loopback ports and isolated run directories", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-runner-allocation-"));
  try {
    const allocation = await allocateRun(path.join(root, "runs"), "run-one");
    assert.equal(new Set([allocation.scenarioPort, allocation.webPort, allocation.gatewayPort]).size, 3);
    assert.match(allocation.controllerToken, /^[A-Za-z0-9_-]{40,}$/);
    for (const directory of [allocation.runRoot, allocation.fluxiqRoot, allocation.storageDir, allocation.browserProfileDir, allocation.coreWorkspaceDir, allocation.webWorkspaceDir, allocation.logsDir]) {
      assert.equal((await stat(directory)).isDirectory(), true);
    }
    const port = await allocateLoopbackPort();
    assert.ok(port > 0 && port <= 65_535);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("rejects run IDs that can escape the runs directory", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-runner-allocation-"));
  try { await assert.rejects(allocateRun(root, "../outside"), /Run ID/); }
  finally { await rm(root, { recursive: true, force: true }); }
});

test("persistent allocations reuse stable private state and allocate distinct sessions", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-runner-persistent-allocation-"));
  try {
    const runs = path.join(root, "runs");
    const first = await allocatePersistentRun(runs, "regression-main", "run-one");
    const second = await allocatePersistentRun(runs, "regression-main", "run-two");

    assert.equal(first.workspaceRoot, second.workspaceRoot);
    assert.equal(first.fluxiqRoot, second.fluxiqRoot);
    assert.equal(first.storageDir, second.storageDir);
    assert.equal(first.browserProfileDir, second.browserProfileDir);
    assert.notEqual(first.sessionRoot, second.sessionRoot);
    assert.equal(first.runRoot, first.sessionRoot);
    assert.equal(second.runRoot, second.sessionRoot);
    assert.notEqual(first.coreWorkspaceDir, second.coreWorkspaceDir);
    assert.notEqual(first.logsDir, second.logsDir);
    assert.equal(path.relative(runs, first.workspaceRoot), path.join("persistent-isolated", "regression-main"));
    assert.equal(path.relative(first.workspaceRoot, first.sessionRoot), path.join(".sessions", "run-one"));
    assert.equal(new Set([first.scenarioPort, first.webPort, first.gatewayPort]).size, 3);
    assert.equal(new Set([second.scenarioPort, second.webPort, second.gatewayPort]).size, 3);

    for (const directory of [
      first.workspaceRoot, first.fluxiqRoot, first.storageDir, first.browserProfileDir,
      first.sessionRoot, first.coreWorkspaceDir, first.webWorkspaceDir, first.logsDir,
      second.sessionRoot, second.coreWorkspaceDir, second.webWorkspaceDir, second.logsDir,
    ]) assert.equal((await stat(directory)).isDirectory(), true);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("persistent workspace names reject reserved, path-like, and device names", () => {
  validatePersistentWorkspaceName("safe-workspace_01");
  for (const invalid of ["", "Uppercase", ".hidden", ".", "..", "../escape", "a/b", "a\\b", "C:drive", "persistent-isolated", "sessions", "CON", "nul.txt", "clock$", "trailing.", "a".repeat(65)]) {
    assert.throws(() => validatePersistentWorkspaceName(invalid), /safe, non-reserved/);
  }
});
