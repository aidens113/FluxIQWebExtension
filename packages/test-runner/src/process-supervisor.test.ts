import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { ProcessSupervisor } from "./process-supervisor.js";

test("captures output and cleans up a running child exactly once", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-runner-process-"));
  const logPath = path.join(root, "child.log");
  const supervisor = new ProcessSupervisor();
  try {
    const child = supervisor.start({
      name: "long-child", command: process.execPath,
      args: ["-e", "console.log('ready'); setInterval(() => {}, 1000)"], cwd: root, env: process.env, logPath,
    });
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("child output timeout")), 5_000);
      child.stdout?.once("data", () => { clearTimeout(timer); resolve(); });
    });
    await supervisor.cleanup();
    await supervisor.cleanup();
    assert.notEqual(child.exitCode ?? child.signalCode, null);
    assert.match(await readFile(logPath, "utf8"), /ready/);
  } finally { await supervisor.cleanup(); await rm(root, { recursive: true, force: true }); }
});

test("reports a non-zero one-shot process as process.startup", async () => {
  const supervisor = new ProcessSupervisor();
  try {
    await assert.rejects(
      supervisor.run({ name: "failure", command: process.execPath, args: ["-e", "process.exit(7)"], cwd: process.cwd(), env: process.env }, 5_000),
      (error: unknown) => typeof error === "object" && error !== null && "category" in error && error.category === "process.startup",
    );
  } finally { await supervisor.cleanup(); }
});

test("a timed-out one-shot process is terminated during cleanup", async () => {
  const supervisor = new ProcessSupervisor();
  try {
    await assert.rejects(
      supervisor.run({ name: "timeout", command: process.execPath, args: ["-e", "setInterval(() => {}, 1000)"], cwd: process.cwd(), env: process.env }, 20),
      (error: unknown) => typeof error === "object" && error !== null && "category" in error && error.category === "process.startup",
    );
    // The supervisor intentionally centralizes termination, so callers can use
    // the same cleanup path for timeouts, signals, and assertion failures.
    await supervisor.cleanup();
    assert.equal(supervisor.activeProcessCount, 0);
  } finally {
    await supervisor.cleanup();
  }
});
