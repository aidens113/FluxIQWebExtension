import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import type { ChildProcess } from "node:child_process";
import test from "node:test";
import { createReaperClient } from "../client.js";

class ReaperProcess extends EventEmitter {
  pid = 1;
  connected = true;
  channel = { unref: () => undefined };
  sent: Array<{ requestId: number; type: string }> = [];
  unref(): void {}
  send(message: { requestId: number; type: string }, callback: (error: Error | null) => void): void {
    this.sent.push(message);
    callback(null);
  }
  disconnect(): void {
    this.connected = false;
    this.emit("disconnect");
  }
}

test("registration waits for the child's actual acknowledgment, not successful pipe write", async () => {
  const child = new ReaperProcess();
  const client = createReaperClient({ spawnReaper: () => child as unknown as ChildProcess });
  let acknowledged = false;
  const registration = client.register("owned-profile", true).then(() => { acknowledged = true; });
  await Promise.resolve();
  assert.equal(acknowledged, false);
  child.emit("message", { type: "ack", requestId: child.sent[0]!.requestId });
  await registration;
  assert.equal(acknowledged, true);
  child.disconnect();
  assert.match((await client.failed).message, /reaper.*IPC/iu);
  await assert.rejects(client.register("another-profile", true), /reaper/iu);
});

test("losing the reaper before acknowledgment rejects startup rather than claiming crash protection", async () => {
  const child = new ReaperProcess();
  const client = createReaperClient({ spawnReaper: () => child as unknown as ChildProcess });
  const registration = assert.rejects(client.register("owned-profile", true), /reaper/iu);
  child.disconnect();
  await registration;
});
