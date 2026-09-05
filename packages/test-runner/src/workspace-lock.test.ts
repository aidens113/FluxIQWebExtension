import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { acquireWorkspaceOperationLock } from "./workspace-lock.js";

test("workspace lock rejects a concurrent live owner and is reusable after release", async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "fluxiq-workspace-lock-"));
  try {
    const first = await acquireWorkspaceOperationLock(workspace, { isProcessAlive: () => true });
    await assert.rejects(
      acquireWorkspaceOperationLock(workspace, { isProcessAlive: pid => pid === first.ownerPid }),
      new RegExp(`already locked by live process ${first.ownerPid}`),
    );
    await first.release();
    await first.release();
    const next = await acquireWorkspaceOperationLock(workspace);
    await next.release();
  } finally { await rm(workspace, { recursive: true, force: true }); }
});

test("workspace lock reclaims only a valid lock whose PID is verified absent", async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "fluxiq-workspace-lock-"));
  try {
    const abandoned = await acquireWorkspaceOperationLock(workspace, { pid: 78123 });
    const replacement = await acquireWorkspaceOperationLock(workspace, {
      pid: 78124,
      isProcessAlive: pid => {
        assert.equal(pid, 78123);
        return false;
      },
    });
    assert.notEqual(replacement.ownerToken, abandoned.ownerToken);
    await assert.rejects(abandoned.release(), /ownership changed/);
    assert.match(await readFile(replacement.path, "utf8"), new RegExp(replacement.ownerToken));
    await replacement.release();
  } finally { await rm(workspace, { recursive: true, force: true }); }
});

test("workspace lock fails closed for malformed owner state", async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "fluxiq-workspace-lock-"));
  try {
    await writeFile(path.join(workspace, ".operation.lock"), "not-json\n", "utf8");
    await assert.rejects(
      acquireWorkspaceOperationLock(workspace, { isProcessAlive: () => false }),
      /malformed; refusing stale-lock reclamation/,
    );
  } finally { await rm(workspace, { recursive: true, force: true }); }
});
