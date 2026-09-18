// The cached Core web build: built once per key under a create-only lock,
// published only after a build that succeeded, and never reused from a
// failed, interrupted or half-written attempt.
import assert from "node:assert/strict";
import type { ChildProcess, SpawnOptions } from "node:child_process";
import { EventEmitter } from "node:events";
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import test from "node:test";
import { RunnerFailure } from "../../failure.js";
import { ProcessSupervisor, type ProcessSpec } from "../../process-supervisor.js";
import { coreWebBuildKey } from "../key.js";
import { prepareCoreWebBuild, type CoreWebBuildDependencies } from "../prepare.js";
import { markBuildComplete, publishBuildAttempt } from "../publication.js";
import type { CoreWebBuildInputs } from "../types.js";

const inputs: CoreWebBuildInputs = {
  coreHead: "a".repeat(40),
  webSourceHash: "b".repeat(64),
  packageDistHashes: { fluxiq: "c".repeat(64) },
  nextConfig: "export default {};\n",
  nextVersion: "15.5.23",
};
const key = coreWebBuildKey(inputs);

type Prepare = (overrides?: Partial<CoreWebBuildDependencies>, supervisor?: ProcessSupervisor) => ReturnType<typeof prepareCoreWebBuild>;
type Harness = {
  keyDirectory: string;
  lockPath: string;
  nextExecutable: string;
  logPath: string;
  builds: ProcessSpec[];
  /** Prepares with a fake build that records its spec and writes a BUILD_ID. */
  prepare: Prepare;
  /** Prepares with the real default build step, which runs `next build` through the supervisor. */
  prepareWithDefaultBuild: Prepare;
};

async function withHarness(run: (harness: Harness) => Promise<void>): Promise<void> {
  const root = await mkdtemp(path.join(os.tmpdir(), "core-web-build-prepare-"));
  const cacheRoot = path.join(root, "runs", ".core-web-build");
  const keyDirectory = path.join(cacheRoot, key);
  const nextExecutable = path.join(root, "core", "next");
  const logPath = path.join(root, "build.log");
  const builds: ProcessSpec[] = [];
  const defaultSupervisor = new ProcessSupervisor();
  const withoutBuild: Partial<CoreWebBuildDependencies> = {
    collectInputs: async () => ({ inputs, nextExecutable }),
    stageWorkspace: async (_core, webDirectory) => writeText(path.join(webDirectory, "package.json"), "{}\n"),
    // These exercise the lock and the publication below os.tmpdir(); the real
    // path budget is tested in path-budget.test.ts and would refuse that root.
    pathBudget: (cacheRoot: string) => ({ fits: true, root: cacheRoot.length, allowed: Number.MAX_SAFE_INTEGER, longest: cacheRoot.length }),
    pollIntervalMs: 5,
    waitTimeoutMs: 10_000,
    lockSettleMs: 2_000,
    buildTimeoutMs: 1_000,
  };
  const fakeBuild: CoreWebBuildDependencies["runBuild"] = async (_supervisor, spec) => {
    builds.push(spec);
    await delay(25);
    await writeText(path.join(spec.cwd, ".next", "BUILD_ID"), `build-${builds.length}\n`);
  };
  const options = (supervisor: ProcessSupervisor) => ({ fluxiqRepositoryRoot: path.join(root, "core"), cacheRoot, supervisor, logPath });
  try {
    await run({
      keyDirectory, lockPath: path.join(keyDirectory, ".operation.lock"), nextExecutable, logPath, builds,
      prepare: (overrides = {}, supervisor = defaultSupervisor) => prepareCoreWebBuild(options(supervisor), { ...withoutBuild, runBuild: fakeBuild, ...overrides }),
      prepareWithDefaultBuild: (overrides = {}, supervisor = defaultSupervisor) => prepareCoreWebBuild(options(supervisor), { ...withoutBuild, ...overrides }),
    });
  } finally {
    await defaultSupervisor.cleanup().catch(() => undefined);
    await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

test("concurrent preparations in one runs directory build once, publish only after the build, and share the publication", async () => {
  await withHarness(async ({ keyDirectory, lockPath, builds, prepare }) => {
    let publishedDuringBuild: boolean | undefined;
    const results = await Promise.all([1, 2, 3].map(() => prepare({
      runBuild: async (_supervisor, spec) => {
        builds.push(spec);
        await delay(40);
        publishedDuringBuild = await exists(path.join(keyDirectory, "published.json"));
        await writeText(path.join(spec.cwd, ".next", "BUILD_ID"), "build-1\n");
      },
    })));
    assert.equal(builds.length, 1, "three concurrent callers, one build");
    assert.equal(publishedDuringBuild, false, "nothing is published while the build runs");
    assert.equal(new Set(results.map(build => build.directory)).size, 1, "every caller gets the same build");
    const build = results[0]!;
    assert.equal(build.buildId, "build-1");
    assert.equal(build.webDirectory, path.join(build.directory, "apps", "web"));
    assert.deepEqual(JSON.parse(await readFile(path.join(keyDirectory, "published.json"), "utf8")), { schemaVersion: 1, key, attempt: path.basename(build.directory) });
    assert.deepEqual(JSON.parse(await readFile(path.join(build.directory, "build-complete.json"), "utf8")), { schemaVersion: 1, key, buildId: "build-1" });
    assert.equal(await exists(lockPath), false, "the lock is released");
    assert.deepEqual((await readdir(keyDirectory)).filter(name => name.endsWith(".tmp")), [], "no temporary record is left behind");

    const later = await prepare();
    assert.equal(later.directory, build.directory, "a later run reuses the publication");
    assert.equal(builds.length, 1);
  });
});

test("a failed build is not published, releases the lock, and the next preparation builds a fresh attempt", async () => {
  await withHarness(async ({ keyDirectory, lockPath, builds, prepare }) => {
    await assert.rejects(prepare({
      runBuild: async (_supervisor, spec) => {
        builds.push(spec);
        // A build that fails late can still leave a BUILD_ID behind.
        await writeText(path.join(spec.cwd, ".next", "BUILD_ID"), "failed-build\n");
        throw new RunnerFailure("process.startup", "core-web-build exited unsuccessfully", { details: { process: "core-web-build", code: 1 } });
      },
    }), closedFailure("Core web panel production build did not succeed"));
    assert.equal(await exists(path.join(keyDirectory, "published.json")), false, "a failed build is never published");
    assert.equal(await exists(lockPath), false, "the lock is released after a failure");
    const failedAttempt = path.dirname(path.dirname(builds[0]!.cwd));

    const build = await prepare();
    assert.equal(builds.length, 2, "the next preparation builds again");
    assert.notEqual(build.directory, failedAttempt, "in an attempt of its own");
  });
});

test("a build that exits cleanly without a build id is rejected and not published", async () => {
  await withHarness(async ({ keyDirectory, builds, prepare }) => {
    await assert.rejects(prepare({ runBuild: async (_supervisor, spec) => { builds.push(spec); } }), closedFailure("Core web panel production build left no build id"));
    assert.equal(await exists(path.join(keyDirectory, "published.json")), false);
  });
});

test("an attempt is reused only when its publication, completion marker and BUILD_ID all agree", async () => {
  const otherKey = "f".repeat(24);
  const partial: Array<[string, AttemptSeed]> = [
    ["a completed attempt that was never published", { marker: { key, buildId: "seeded" } }],
    ["a published attempt with no completion marker", { publishedKey: key }],
    ["a published attempt whose marker names another key", { marker: { key: otherKey, buildId: "seeded" }, publishedKey: key }],
    ["a published attempt whose marker disagrees with BUILD_ID", { marker: { key, buildId: "another-build" }, publishedKey: key }],
    ["an attempt published under another key", { marker: { key, buildId: "seeded" }, publishedKey: otherKey }],
  ];
  for (const [name, seed] of partial) {
    await withHarness(async ({ keyDirectory, builds, prepare }) => {
      const seeded = await seedAttempt(keyDirectory, seed);
      const build = await prepare();
      assert.equal(builds.length, 1, `${name} is not reused`);
      assert.notEqual(build.directory, seeded, name);
    });
  }
  await withHarness(async ({ keyDirectory, builds, prepare }) => {
    const seeded = await seedAttempt(keyDirectory, { marker: { key, buildId: "seeded" }, publishedKey: key });
    const build = await prepare();
    assert.equal(builds.length, 0, "a fully published attempt is reused without building");
    assert.equal(build.directory, seeded);
    assert.equal(build.buildId, "seeded");
  });
});

test("a build lock left by a dead process is reclaimed", async () => {
  await withHarness(async ({ keyDirectory, lockPath, builds, prepare }) => {
    await writeText(lockPath, lockRecord(424_242));
    const build = await prepare({ lock: { isProcessAlive: pid => pid !== 424_242 }, waitTimeoutMs: 300 });
    assert.equal(builds.length, 1);
    assert.equal(await exists(lockPath), false);
    assert.deepEqual(await attemptNames(keyDirectory), [path.basename(build.directory)]);
  });
});

test("waiting on a live builder is bounded and fails closed without building", { timeout: 5_000 }, async () => {
  await withHarness(async ({ lockPath, builds, prepare }) => {
    await writeText(lockPath, lockRecord(434_343));
    // The owner outlives the 60 ms wait many times over. An unbounded wait would
    // outlast it, reclaim the lock and build, instead of hanging the test.
    let livenessChecks = 0;
    const isProcessAlive = () => (livenessChecks += 1) < 100;
    await assert.rejects(prepare({ lock: { isProcessAlive }, waitTimeoutMs: 60 }), closedFailure("Timed out waiting for another Lab process to build the Core web panel"));
    assert.equal(builds.length, 0);
    assert.equal(await readFile(lockPath, "utf8"), lockRecord(434_343), "a live owner's lock is left alone");
  });
});

test("a lock caught before its owner record is written is waited out", async () => {
  await withHarness(async ({ lockPath, builds, prepare }) => {
    await writeText(lockPath, "");
    const released = delay(40).then(() => rm(lockPath, { force: true }));
    const build = await prepare({ lockSettleMs: 2_000 });
    await released;
    assert.equal(builds.length, 1);
    assert.equal(build.buildId, "build-1");
  });
});

test("a lock that stays unreadable fails closed and is never reclaimed", async () => {
  await withHarness(async ({ lockPath, builds, prepare }) => {
    await writeText(lockPath, "not a lock record\n");
    await assert.rejects(prepare({ lockSettleMs: 40 }), closedFailure("Core web build lock could not be taken, and is never reclaimed automatically"));
    assert.equal(builds.length, 0);
    assert.equal(await readFile(lockPath, "utf8"), "not a lock record\n");
  });
});

test("the build runs `next build --turbopack` in its attempt with a build-only FluxIQ root, and its output stays in the log", async () => {
  await withHarness(async ({ keyDirectory, nextExecutable, logPath, prepareWithDefaultBuild }) => {
    const spawned: Array<{ command: string; args: readonly string[]; options: SpawnOptions }> = [];
    const failing = new ProcessSupervisor((command, args, options) => {
      spawned.push({ command, args, options });
      const child = fakeChild();
      setImmediate(() => {
        child.stderr.write("raw build output stays in the log\n");
        setImmediate(() => exitChild(child, 1));
      });
      return child;
    }, async () => undefined);
    await assert.rejects(prepareWithDefaultBuild({}, failing), (error: unknown) => {
      closedFailure("Core web panel production build did not succeed")(error);
      assert.doesNotMatch(failureText(error), /raw build output/u, "the failure carries no process output");
      return true;
    });
    await failing.cleanup();
    assert.match(await readFile(logPath, "utf8"), /\[stderr\] raw build output stays in the log/u);

    const [attempt] = await attemptNames(keyDirectory);
    const directory = path.join(keyDirectory, attempt!);
    assert.equal(spawned.length, 1);
    const build = spawned[0]!;
    assert.equal(build.command, nextExecutable);
    assert.deepEqual(build.args, ["build", "--turbopack"]);
    assert.equal(build.options.cwd, path.join(directory, "apps", "web"));
    assert.equal(build.options.shell, process.platform === "win32");
    assert.equal(build.options.env?.FLUXIQ_ROOT, path.join(directory, "fluxiq-root"));
    assert.equal(build.options.env?.FLUXIQ_CLIENT_GATEWAY_ENABLED, "false");
    assert.equal(await exists(path.join(keyDirectory, "published.json")), false);

    const succeeding = new ProcessSupervisor((_command, _args, options) => {
      const child = fakeChild();
      setImmediate(() => void writeText(path.join(String(options.cwd), ".next", "BUILD_ID"), "fake-build\n").then(() => exitChild(child, 0)));
      return child;
    }, async () => undefined);
    const published = await prepareWithDefaultBuild({}, succeeding);
    await succeeding.cleanup();
    assert.equal(published.buildId, "fake-build");
    assert.deepEqual(JSON.parse(await readFile(path.join(keyDirectory, "published.json"), "utf8")), { schemaVersion: 1, key, attempt: path.basename(published.directory) });
  });
});

type AttemptSeed = { marker?: { key: string; buildId: string }; publishedKey?: string };

async function seedAttempt(keyDirectory: string, seed: AttemptSeed): Promise<string> {
  const attempt = "b-0123456789ab";
  const directory = path.join(keyDirectory, attempt);
  await writeText(path.join(directory, "apps", "web", ".next", "BUILD_ID"), "seeded\n");
  if (seed.marker) await markBuildComplete(directory, seed.marker.key, seed.marker.buildId);
  if (seed.publishedKey) await publishBuildAttempt(keyDirectory, seed.publishedKey, attempt);
  return directory;
}

function closedFailure(message: string): (error: unknown) => true {
  return (error: unknown) => {
    assert.ok(error instanceof RunnerFailure, `expected a RunnerFailure: ${String(error)}`);
    assert.equal(error.category, "process.startup");
    assert.equal(error.message, message);
    return true;
  };
}

function failureText(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current instanceof Error; depth += 1) {
    parts.push(current.message, JSON.stringify((current as { details?: unknown }).details ?? null));
    current = current.cause;
  }
  return parts.join("\n");
}

function lockRecord(pid: number): string {
  return `${JSON.stringify({ schemaVersion: 1, pid, ownerToken: "A".repeat(32), acquiredAt: new Date(0).toISOString() })}\n`;
}

async function attemptNames(keyDirectory: string): Promise<string[]> {
  return (await readdir(keyDirectory)).filter(name => /^b-[0-9a-f]{12}$/u.test(name)).sort();
}

async function writeText(file: string, text: string): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, text, "utf8");
}

async function exists(target: string): Promise<boolean> {
  try { await stat(target); return true; } catch { return false; }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
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

test("a cache root inside node_modules is refused before Core is read, staged or built, and the refusal says why", async () => {
  // The first default for the Core-scoped cache was <core>/node_modules/.core-web-build.
  // Every Turbopack build there died with exit 3221225501 and nothing else in
  // its log, and a campaign reported it four times as this machine's RAM fault.
  const touched: string[] = [];
  const root = await mkdtemp(path.join(os.tmpdir(), "core-web-build-nm-"));
  try {
    await assert.rejects(prepareCoreWebBuild(
      { fluxiqRepositoryRoot: path.join(root, "core"), cacheRoot: path.join(root, "node_modules", "cwb"), supervisor: new ProcessSupervisor(), logPath: path.join(root, "build.log") },
      {
        collectInputs: async () => { touched.push("inputs"); return { inputs, nextExecutable: "next" }; },
        stageWorkspace: async () => { touched.push("stage"); },
        runBuild: async () => { touched.push("build"); },
        pathBudget: cacheRoot => ({ fits: true, root: cacheRoot.length, allowed: Number.MAX_SAFE_INTEGER, longest: cacheRoot.length }),
      },
    ), (error: unknown) => error instanceof RunnerFailure && error.category === "environment.missing" && /inside a node_modules directory/u.test(error.message) && /exit 3221225501/u.test(error.message));
    assert.deepEqual(touched, []);
    await assert.rejects(stat(path.join(root, "node_modules")), { code: "ENOENT" });
  } finally {
    await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
