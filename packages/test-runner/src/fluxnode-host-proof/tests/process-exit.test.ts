import assert from "node:assert/strict";
import { ChildProcess } from "node:child_process";
import { setImmediate } from "node:timers/promises";
import test from "node:test";
import { hostProofProcessExit } from "../process-exit.js";

test("exit completes observation even when the IPC close count can never complete", async () => {
  const child = new ChildProcess();
  let status: Awaited<ReturnType<typeof hostProofProcessExit>> | undefined;
  const observed = hostProofProcessExit(child).then((value) => { status = value; });
  try {
    child.emit("exit", 1, null);
    await setImmediate();
    assert.deepEqual(status, { code: 1, signal: null });
  } finally {
    child.emit("close", 1, null);
    await observed;
  }
});

test("a child that exited before observation is already complete", async () => {
  const child = new ChildProcess();
  Object.defineProperty(child, "exitCode", { value: 7, configurable: true });
  let status: Awaited<ReturnType<typeof hostProofProcessExit>> | undefined;
  const observed = hostProofProcessExit(child).then((value) => { status = value; });
  try {
    await setImmediate();
    assert.deepEqual(status, { code: 7, signal: null });
  } finally {
    child.emit("close", 7, null);
    await observed;
  }
});
