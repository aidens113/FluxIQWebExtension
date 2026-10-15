// The host build and the demo's domain setup run before Core starts. Each is
// bounded by progress: a slow step that keeps printing is never failed for
// passing the old fixed 120 s, and a silent, hung one fails as a named Lab
// startup failure (t620).
import assert from "node:assert/strict";
import type { ChildProcess, SpawnOptions } from "node:child_process";
import { EventEmitter } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import test, { type TestContext } from "node:test";
import { RunnerFailure } from "../../failure.js";
import { ProcessSupervisor } from "../../process-supervisor.js";
import { domainSetupStep, hostBuildStep } from "../index.js";

type Step = {
  title: string;
  name: string;
  script: string;
  bound: { quietMs: number; ceilingMs: number };
  run: (supervisor: ProcessSupervisor, root: string) => Promise<void>;
};

const steps: Step[] = [
  { title: "the Lab host build", name: "host-build", script: "build-web-panel-host.mjs", bound: hostBuildStep.bound,
    run: (supervisor, root) => hostBuildStep.run(supervisor, { name: "host-build", repositoryRoot: root, logPath: path.join(root, "host-build.log") }) },
  { title: "the demo host build", name: "demo-host-build", script: "build-web-panel-host.mjs", bound: hostBuildStep.bound,
    run: (supervisor, root) => hostBuildStep.run(supervisor, { name: "demo-host-build", repositoryRoot: root, logPath: path.join(root, "demo-host-build.log") }) },
  { title: "the demo domain setup", name: "demo-domain-setup", script: "setup-fluxiq.mjs", bound: domainSetupStep.bound,
    run: (supervisor, root) => domainSetupStep.run(supervisor, { name: "demo-domain-setup", repositoryRoot: root, fluxiqRoot: path.join(root, "fluxiq-root"), logPath: path.join(root, "domain-setup.log") }) },
];

type Spawned = { args: readonly string[]; options: SpawnOptions; child: FakeChild };

async function withStep(t: TestContext, step: Step, body: (started: { done: Promise<void>; spawned: Spawned; root: string }) => Promise<void>): Promise<void> {
  const root = await mkdtemp(path.join(os.tmpdir(), "startup-build-"));
  let spawned: Spawned | undefined;
  const supervisor = new ProcessSupervisor((_command, args, options) => {
    spawned = { args, options, child: fakeChild() };
    return spawned.child;
  }, async () => undefined);
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 0 });
  try {
    const done = step.run(supervisor, root);
    await body({ done, spawned: spawned!, root });
  } finally {
    t.mock.timers.reset();
    await supervisor.cleanup().catch(() => undefined);
    await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

for (const step of steps) {
  test(`${step.title} keeps working past the old 120 s while it prints, and succeeds`, async t => {
    await withStep(t, step, async ({ done, spawned, root }) => {
      assert.deepEqual(spawned.args, [path.join(root, "domain", "scripts", step.script)]);
      assert.equal(spawned.options.cwd, root);
      // Output inside every quiet window, for longer than the quiet bound itself.
      const interval = step.bound.quietMs / 2;
      for (let elapsed = 0; elapsed <= step.bound.quietMs + 120_000; elapsed += interval) {
        spawned.child.stdout.write("working\n");
        await flush();
        t.mock.timers.tick(interval);
      }
      assert.ok(Date.now() > 120_000 && Date.now() > step.bound.quietMs);
      exitChild(spawned.child, 0);
      await done;
    });
  });

  test(`${step.title}, silent and hung, fails as a Lab startup failure naming ${step.name}, its bound, limit and elapsed time`, async t => {
    await withStep(t, step, async ({ done }) => {
      t.mock.timers.tick(step.bound.quietMs);
      await assert.rejects(done, (error: unknown) => {
        assert.ok(error instanceof RunnerFailure);
        assert.equal(error.category, "process.startup");
        assert.match(error.message, new RegExp(`^Lab startup failure: build step ${step.name} printed nothing for ${step.bound.quietMs / 1_000} s`, "u"));
        assert.deepEqual(error.details, { process: step.name, step: step.name, bound: "quiet", limitMs: step.bound.quietMs, elapsedMs: step.bound.quietMs });
        return true;
      });
    });
  });
}

test("the domain setup runs against the FluxIQ root it is given", async t => {
  await withStep(t, steps[2]!, async ({ done, spawned, root }) => {
    assert.equal(spawned.options.env?.FLUXIQ_WEB_AUTOMATION_ROOT, path.join(root, "fluxiq-root"));
    exitChild(spawned.child, 0);
    await done;
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
    pid: { value: 4_245 },
    exitCode: { value: null, writable: true, configurable: true },
    signalCode: { value: null, writable: true, configurable: true },
  });
  return child;
}

function exitChild(child: FakeChild, code: number): void {
  Object.defineProperty(child, "exitCode", { value: code, writable: true, configurable: true });
  child.emit("exit", code, null);
}
