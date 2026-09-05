import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { allocatePersistentRun } from "./allocation.js";
import { removeRunOwnedTopologyState, startTopology } from "./coordinator.js";
import { ProcessSupervisor } from "./process-supervisor.js";

test("persistent topology cleanup removes only its execution session", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-persistent-cleanup-"));
  try {
    const allocation = await allocatePersistentRun(path.join(root, "runs"), "main", "run-one");
    const coreSentinel = path.join(allocation.storageDir, "persistent.txt");
    const browserSentinel = path.join(allocation.browserProfileDir, "persistent.txt");
    await writeFile(coreSentinel, "core survives", "utf8");
    await writeFile(browserSentinel, "browser survives", "utf8");

    await removeRunOwnedTopologyState({ allocation });

    await assert.rejects(stat(allocation.sessionRoot), missing);
    assert.equal(await readFile(coreSentinel, "utf8"), "core survives");
    assert.equal(await readFile(browserSentinel, "utf8"), "browser survives");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("persistent startup failure retains private state and releases the workspace lock", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-persistent-failure-"));
  const runsDirectory = path.join(root, "runs");
  const workspaceRoot = path.join(runsDirectory, "persistent-isolated", "main");
  const sentinel = path.join(workspaceRoot, "fluxiq-root", ".fluxiq", "keep.txt");
  await mkdir(path.dirname(sentinel), { recursive: true });
  await writeFile(sentinel, "must survive startup failure", "utf8");
  const supervisor = new ProcessSupervisor();
  try {
    await assert.rejects(startTopology({
      repositoryRoot: path.join(root, "missing-repository"),
      fluxiqRepositoryRoot: path.join(root, "missing-core"),
      runsDirectory,
      runId: "failed-run",
      target: { mode: "persistent-isolated", workspace: "main" },
      prepareHost: false,
    }, supervisor, { waitForHttp: async () => new Response("must not be reached") }), /Required test topology path is missing/);

    assert.equal(await readFile(sentinel, "utf8"), "must survive startup failure");
    await assert.rejects(stat(path.join(workspaceRoot, ".sessions", "failed-run")), missing);
    await assert.rejects(stat(path.join(workspaceRoot, ".operation.lock")), missing);
    assert.deepEqual(supervisor.processExitCodes(), {});
  } finally {
    await supervisor.cleanup();
    await rm(root, { recursive: true, force: true });
  }
});

function missing(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
