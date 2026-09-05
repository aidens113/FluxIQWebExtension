import assert from "node:assert/strict";
import { mkdtemp, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { allocateLoopbackPort, allocateRun } from "./allocation.js";

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
