import assert from "node:assert/strict";
import test from "node:test";
import type { FluxIQSession } from "../../../../shared/protocol";
import { SessionWrites } from "../writes";

test("a later session write cannot finish before an earlier pending write and be overwritten by it", async () => {
  let session = { clientId: "test-client", projectId: "old-project" } as FluxIQSession;
  let stored: FluxIQSession | undefined;
  let release = (): void => undefined;
  const slowOldWrite = new Promise<void>((resolve) => { release = resolve; });
  const started: string[] = [];
  const writes = new SessionWrites(() => session, async (snapshot) => {
    started.push(snapshot.projectId!);
    if (snapshot.projectId === "old-project") await slowOldWrite;
    stored = snapshot;
  });
  const oldWrite = writes.save();
  await Promise.resolve();
  session = { ...session, projectId: "new-project" };
  const newWrite = writes.save();
  await Promise.resolve();
  assert.deepEqual(started, ["old-project"]);
  assert.equal(session.projectId, "new-project");
  release();
  await Promise.all([oldWrite, newWrite]);
  assert.equal(stored?.projectId, "new-project");
  assert.deepEqual(started, ["old-project", "new-project"]);
});

test("a failed persistent write is returned to its caller and does not prevent the newest session from being stored", async () => {
  let session = { clientId: "test-client", projectId: "old-project" } as FluxIQSession;
  let stored: FluxIQSession | undefined;
  const writes = new SessionWrites(() => session, async (snapshot) => {
    if (snapshot.projectId === "old-project") throw new Error("fixture storage failure");
    stored = snapshot;
  });
  await assert.rejects(writes.save(), /fixture storage failure/u);
  session = { ...session, projectId: "new-project" };
  await writes.save();
  assert.equal(stored?.projectId, "new-project");
});
