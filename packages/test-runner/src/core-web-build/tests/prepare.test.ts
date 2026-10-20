// The Lab's side of Core's keyed web build: Core keys, stages, locks, checks
// and publishes (`<core>/scripts/web-build/`, tested there); the Lab runs the
// commands Core asks for under its supervisor and bounds, keeps their output
// in the run's log, gives the build a scrubbed environment, and turns every
// failure into a closed RunnerFailure.
import assert from "node:assert/strict";
import type { ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import test, { type TestContext } from "node:test";
import { RunnerFailure } from "../../failure.js";
import { ProcessSupervisor, type ProcessSpec } from "../../process-supervisor.js";
import { loadCoreWebBuildSeam } from "../core-seam.js";
import { prepareCoreWebBuild } from "../prepare.js";
import type { CoreWebBuildCommand, CoreWebBuildSeam } from "../types.js";

const BUILD = { key: "0".repeat(24), directory: "attempt", webDirectory: path.join("attempt", "apps", "web"), nextExecutable: "next", buildId: "build-1", reused: false };
const GATEWAY: CoreWebBuildCommand = { name: "gateway-server-build", command: process.execPath, args: ["generator.mjs"], cwd: "core", env: { BASE: "1" }, shell: false };
const NEXT_BUILD: CoreWebBuildCommand = { name: "web-build", command: "next", args: ["build", "--turbopack"], cwd: path.join("attempt", "apps", "web"), env: { BASE: "1", FLUXIQ_ROOT: "attempt-root" }, shell: process.platform === "win32" };

type SeamCall = Parameters<CoreWebBuildSeam["prepareWebBuild"]>[0];

/** A seam that runs the given commands through the Lab's `run`, then answers with `answer`. */
function fakeSeam(commands: CoreWebBuildCommand[], answer: (call: SeamCall) => Promise<typeof BUILD> = async () => BUILD): { seam: CoreWebBuildSeam; calls: SeamCall[] } {
  const calls: SeamCall[] = [];
  return {
    calls,
    seam: {
      prepareWebBuild: async call => {
        calls.push(call);
        call.log("staged and building");
        for (const command of commands) await call.run(command);
        return answer(call);
      },
      inspectWebBuild: async () => ({ key: BUILD.key, cached: false }),
    },
  };
}

async function workspace(t: TestContext): Promise<{ root: string; logPath: string }> {
  const root = await mkdtemp(path.join(os.tmpdir(), "core-web-build-lab-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return { root, logPath: path.join(root, "core-web-build.log") };
}

test("the Lab runs Core's commands under its supervisor with their bounds and logs, and returns the build without Core's extras", async t => {
  const { root, logPath } = await workspace(t);
  const runs: Array<{ spec: ProcessSpec; quietMs: number }> = [];
  const { seam, calls } = fakeSeam([GATEWAY, NEXT_BUILD]);
  const supervisor = new ProcessSupervisor();
  const build = await prepareCoreWebBuild({ fluxiqRepositoryRoot: path.join(root, "core"), cacheRoot: path.join(root, "cache"), supervisor, logPath }, {
    loadSeam: async () => seam,
    runBuild: async (_supervisor, spec, bound) => { runs.push({ spec, quietMs: bound.quietMs }); },
    environment: () => ({ SCRUBBED: "yes" }),
  });
  assert.deepEqual(build, { key: BUILD.key, directory: BUILD.directory, webDirectory: BUILD.webDirectory, nextExecutable: BUILD.nextExecutable, buildId: BUILD.buildId });
  const [call] = calls;
  assert.equal(call!.repoRoot, path.join(root, "core"));
  assert.equal(call!.cacheRoot, path.join(root, "cache"));
  assert.deepEqual(call!.env, { SCRUBBED: "yes" }, "Core keys and builds over the Lab's scrubbed environment");
  assert.equal(call!.waitTimeoutMs, 30 * 60_000 + 120_000, "a waiter outlasts one whole build");
  assert.deepEqual(runs.map(run => [run.spec.name, run.spec.command, run.spec.args, run.spec.cwd, run.spec.shell, run.spec.logPath, run.quietMs]), [
    ["gateway-server-build", process.execPath, ["generator.mjs"], "core", false, `${logPath}.gateway-server.log`, 5 * 60_000],
    ["core-web-build", "next", ["build", "--turbopack"], NEXT_BUILD.cwd, NEXT_BUILD.shell, logPath, 10 * 60_000],
  ]);
  assert.deepEqual(runs[1]!.spec.env, NEXT_BUILD.env, "the command's environment is Core's, unchanged");
  assert.match(await readFile(logPath, "utf8"), /\[core-web-build\] staged and building/u, "Core's account of the build is in the run's log");
  await supervisor.cleanup();
});

test("a failed next build is a closed failure that carries no process output", async t => {
  const { root, logPath } = await workspace(t);
  const failing = new ProcessSupervisor(() => {
    const child = fakeChild();
    setImmediate(() => {
      child.stderr.write("raw build output stays in the log\n");
      setImmediate(() => exitChild(child, 1));
    });
    return child;
  }, async () => undefined);
  const { seam } = fakeSeam([NEXT_BUILD]);
  await assert.rejects(prepareCoreWebBuild({ fluxiqRepositoryRoot: root, supervisor: failing, logPath }, { loadSeam: async () => seam, buildBound: { quietMs: 1_000, ceilingMs: 1_000 } }), (error: unknown) => {
    assert.ok(error instanceof RunnerFailure);
    assert.equal(error.category, "process.startup");
    assert.equal(error.message, "Core web panel production build did not succeed");
    assert.doesNotMatch(failureText(error), /raw build output/u);
    return true;
  });
  await failing.cleanup();
  assert.match(await readFile(logPath, "utf8"), /\[stderr\] raw build output stays in the log/u);
});

test("a silent, hung next build fails naming the step, the bound it hit, its limit and the elapsed time", async t => {
  const { root, logPath } = await workspace(t);
  const hung = new ProcessSupervisor(() => fakeChild(), async () => undefined);
  const { seam } = fakeSeam([NEXT_BUILD]);
  await assert.rejects(prepareCoreWebBuild({ fluxiqRepositoryRoot: root, supervisor: hung, logPath }, { loadSeam: async () => seam, buildBound: { quietMs: 50, ceilingMs: 5_000 } }), (error: unknown) => {
    assert.ok(error instanceof RunnerFailure);
    assert.match(error.message, /^Core web panel production build did not succeed\. Lab startup failure: build step core-web-build printed nothing for 0 s/u);
    assert.deepEqual([error.details?.step, error.details?.bound, error.details?.limitMs], ["core-web-build", "quiet", 50]);
    return true;
  });
  await hung.cleanup().catch(() => undefined);
});

test("Core's refusals keep their sentence: an environment fault is environment.missing, a refused build is process.startup", async t => {
  const { root, logPath } = await workspace(t);
  const refusal = (kind: "environment" | "build", message: string) => Object.assign(new Error(message), { kind, details: { cacheRoot: "x" } });
  const cases: Array<[Error, string]> = [
    [refusal("environment", "The web build cache x is inside a node_modules directory"), "environment.missing"],
    [refusal("build", "The web panel build embeds Core's unstamped runtime build identity"), "process.startup"],
  ];
  for (const [error, category] of cases) {
    const { seam } = fakeSeam([], async () => { throw error; });
    await assert.rejects(prepareCoreWebBuild({ fluxiqRepositoryRoot: root, supervisor: new ProcessSupervisor(), logPath }, { loadSeam: async () => seam }), (failure: unknown) => {
      assert.ok(failure instanceof RunnerFailure);
      assert.equal(failure.category, category);
      assert.equal(failure.message, error.message);
      assert.deepEqual(failure.details, { cacheRoot: "x", process: "core-web-build" });
      return true;
    });
  }
  const { seam } = fakeSeam([], async () => { throw new TypeError("unexpected"); });
  await assert.rejects(prepareCoreWebBuild({ fluxiqRepositoryRoot: root, supervisor: new ProcessSupervisor(), logPath }, { loadSeam: async () => seam }), (failure: unknown) => failure instanceof RunnerFailure && failure.message === "Core web panel production build could not be prepared");
});

test("FLUXIQ_CORE_WEB_BUILD_CACHE reaches Core although the build's environment drops every FLUXIQ_* setting", async t => {
  const { root, logPath } = await workspace(t);
  const { seam, calls } = fakeSeam([]);
  const previous = process.env.FLUXIQ_CORE_WEB_BUILD_CACHE;
  process.env.FLUXIQ_CORE_WEB_BUILD_CACHE = path.join(root, "declared");
  t.after(() => {
    if (previous === undefined) delete process.env.FLUXIQ_CORE_WEB_BUILD_CACHE;
    else process.env.FLUXIQ_CORE_WEB_BUILD_CACHE = previous;
  });
  await prepareCoreWebBuild({ fluxiqRepositoryRoot: root, supervisor: new ProcessSupervisor(), logPath }, { loadSeam: async () => seam });
  assert.equal(calls[0]!.cacheRoot, path.join(root, "declared"));
  assert.equal(calls[0]!.env.FLUXIQ_CORE_WEB_BUILD_CACHE, undefined);
});

test("a Core without the keyed web build is refused as a missing environment, with what to do", async t => {
  const { root } = await workspace(t);
  await assert.rejects(loadCoreWebBuildSeam(root), (error: unknown) => error instanceof RunnerFailure && error.category === "environment.missing" && /has no scripts\/web-build\/index\.mjs/u.test(error.message) && /Merge Core's dev/u.test(error.message));
});

function failureText(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current instanceof Error; depth += 1) {
    parts.push(current.message, JSON.stringify((current as { details?: unknown }).details ?? null));
    current = current.cause;
  }
  return parts.join("\n");
}

type FakeChild = ChildProcess & { stdout: PassThrough; stderr: PassThrough };

function fakeChild(): FakeChild {
  const child = new EventEmitter() as unknown as FakeChild;
  Object.defineProperties(child, {
    stdout: { value: new PassThrough() },
    stderr: { value: new PassThrough() },
    pid: { value: 4_242 },
    exitCode: { value: null, writable: true, configurable: true },
    signalCode: { value: null, writable: true, configurable: true },
  });
  return child;
}

function exitChild(child: FakeChild, code: number): void {
  Object.defineProperty(child, "exitCode", { value: code, writable: true, configurable: true });
  child.emit("exit", code, null);
}
