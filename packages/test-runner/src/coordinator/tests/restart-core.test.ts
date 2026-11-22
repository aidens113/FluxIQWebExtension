import assert from "node:assert/strict";
import test from "node:test";
import { restartCoreAtStoppedBoundary } from "../index.js";

test("owned restart captures only while stopped and restores the host after preparation failure", async () => {
  const events: string[] = [];
  const failure = new Error("snapshot failed");
  await assert.rejects(() => restartCoreAtStoppedBoundary({ stop: async () => { events.push("stop"); }, start: () => { events.push("start"); }, ready: async () => { events.push("ready"); }, cancelled: () => false, whileStopped: async () => {
    events.push("capture");
    throw failure;
  } }), error => error === failure);
  assert.deepEqual(events, ["stop", "capture", "start", "ready"]);
});

test("stop failure prevents capture/restart and combined preparation/restart errors remain visible", async () => {
  const failure = new Error("stop failed");
  await assert.rejects(() => restartCoreAtStoppedBoundary({ stop: async () => { throw failure; }, start: () => assert.fail("restarted"), ready: async () => assert.fail("ready"), cancelled: () => false, whileStopped: async () => assert.fail("captured") }), error => error === failure);
  const preparation = new Error("snapshot failed"), restart = new Error("restart failed");
  await assert.rejects(() => restartCoreAtStoppedBoundary({ stop: async () => undefined, start: () => { throw restart; }, ready: async () => undefined, cancelled: () => false, whileStopped: async () => { throw preparation; } }), error => error instanceof AggregateError && error.errors[0] === preparation && error.errors[1] === restart);
});

test("teardown/cancellation during capture never restarts the isolated child", async () => {
  let cancelled = false;
  await assert.rejects(() => restartCoreAtStoppedBoundary({ stop: async () => undefined, start: () => assert.fail("restarted after teardown"), ready: async () => assert.fail("ready"), cancelled: () => cancelled, whileStopped: async () => { cancelled = true; } }), { name: "AbortError" });
});

test("rejection with undefined is preserved while restoring the owned host", async () => {
  let restarted = false;
  let caught = false;
  try {
    await restartCoreAtStoppedBoundary({ stop: async () => undefined, start: () => { restarted = true; }, ready: async () => undefined, cancelled: () => false, whileStopped: async () => { throw undefined; } });
  } catch (error) {
    caught = true;
    assert.equal(error, undefined);
  }
  assert.equal(caught, true);
  assert.equal(restarted, true);
});
