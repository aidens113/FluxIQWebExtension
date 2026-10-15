// A Lab startup build ends when it is hung, never because a slower machine
// took longer than a fixed minute: silence is bounded, progress is not, and a
// generous ceiling backs both (t620).
import assert from "node:assert/strict";
import type { ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import test, { type TestContext } from "node:test";
import { RunnerFailure } from "../../failure.js";
import { ProcessSupervisor, type ProcessSpec } from "../../process-supervisor.js";
import { runBoundedBuildStep } from "../build-step.js";

const bound = { quietMs: 60_000, ceilingMs: 300_000 };

async function withStep(t: TestContext, run: (start: () => { done: Promise<void>; child: FakeChild }) => Promise<void>): Promise<void> {
  const root = await mkdtemp(path.join(os.tmpdir(), "build-step-"));
  let child: FakeChild | undefined;
  const supervisor = new ProcessSupervisor(() => (child = fakeChild()), async () => undefined);
  const spec: ProcessSpec = { name: "core-web-build", command: "next", args: ["build"], cwd: root, env: {}, logPath: path.join(root, "step.log") };
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 0 });
  try {
    await run(() => {
      const done = runBoundedBuildStep(supervisor, spec, bound);
      return { done, child: child! };
    });
  } finally {
    t.mock.timers.reset();
    await supervisor.cleanup().catch(() => undefined);
    await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

test("output restarts the quiet bound, so a build working past it succeeds", async t => {
  await withStep(t, async start => {
    const { done, child } = start();
    for (let step = 0; step < 4; step += 1) {
      child.stderr.write("compiling\n");
      await flush();
      t.mock.timers.tick(45_000);
    }
    exitChild(child, 0);
    await done;
  });
});

test("a build that keeps printing but never finishes ends at its ceiling, named as such", async t => {
  await withStep(t, async start => {
    const { done, child } = start();
    for (let elapsed = 0; elapsed < bound.ceilingMs; elapsed += 50_000) {
      child.stdout.write("still going\n");
      await flush();
      t.mock.timers.tick(50_000);
    }
    await assert.rejects(done, (error: unknown) => {
      assert.ok(error instanceof RunnerFailure);
      assert.equal(error.category, "process.startup");
      assert.match(error.message, /^Lab startup failure: build step core-web-build was still running at its 300 s ceiling, after 300 s in all/u);
      assert.deepEqual(error.details, { process: "core-web-build", step: "core-web-build", bound: "ceiling", limitMs: 300_000, elapsedMs: 300_000 });
      return true;
    });
  });
});

test("a build that exits non-zero fails at once, without waiting for a bound", async t => {
  await withStep(t, async start => {
    const { done, child } = start();
    exitChild(child, 2);
    await assert.rejects(done, (error: unknown) => error instanceof RunnerFailure && error.message === "core-web-build exited unsuccessfully" && error.details?.code === 2);
  });
});

function flush(): Promise<void> {
  return new Promise(resolve => setImmediate(resolve));
}

type FakeChild = ChildProcess & { stdout: PassThrough; stderr: PassThrough };

function fakeChild(): FakeChild {
  const child = new EventEmitter() as unknown as FakeChild;
  Object.defineProperties(child, {
    stdout: { value: new PassThrough() },
    stderr: { value: new PassThrough() },
    pid: { value: 4_244 },
    exitCode: { value: null, writable: true, configurable: true },
    signalCode: { value: null, writable: true, configurable: true },
  });
  return child;
}

function exitChild(child: FakeChild, code: number): void {
  Object.defineProperty(child, "exitCode", { value: code, writable: true, configurable: true });
  child.emit("exit", code, null);
}
