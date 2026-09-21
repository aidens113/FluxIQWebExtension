// The demo session's cleanup. A failed lane keeps its own error when the
// cleanup after it fails too; a removal Windows refuses while the stopped Core
// tree releases its handles is retried; and a junction inside the session,
// which points into the pinned Core, is removed without touching its target.

import assert from "node:assert/strict";
import { lstat, mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createServer } from "node:net";
import { RunnerFailure } from "../../failure.js";
import { resolveDemoWorkspaceConfiguration } from "../configuration.js";
import { removeDemoSession, runThenCleanUp, startPersistentDemoCore } from "../core-process.js";

function codedError(code: string): Error & { code: string } {
  return Object.assign(new Error(`${code}: resource busy or locked, rmdir 'session'`), { code });
}

test("a removal that throws EBUSY is retried and then succeeds", async () => {
  const calls: string[] = [];
  await removeDemoSession(path.join("workspace", ".s"), "916ff5549d31", {
    retryDelayMs: 1,
    remove: async target => {
      calls.push(target);
      if (calls.length === 1) throw codedError("EBUSY");
    },
  });
  assert.deepEqual(calls, [path.resolve("workspace", ".s", "916ff5549d31"), path.resolve("workspace", ".s", "916ff5549d31")]);
});

test("EPERM and ENOTEMPTY are retried too, until the attempts run out", async () => {
  for (const code of ["EPERM", "ENOTEMPTY"]) {
    let calls = 0;
    await assert.rejects(removeDemoSession("sessions", "abc", { attempts: 3, retryDelayMs: 1, remove: async () => { calls += 1; throw codedError(code); } }), { code });
    assert.equal(calls, 3, code);
  }
});

test("any other removal error fails at once", async () => {
  let calls = 0;
  await assert.rejects(removeDemoSession("sessions", "abc", { retryDelayMs: 1, remove: async () => { calls += 1; throw codedError("EACCES"); } }), { code: "EACCES" });
  assert.equal(calls, 1);
});

test("a session outside its sessions directory is never removed", async () => {
  for (const name of ["..", ".", "", path.join("..", "elsewhere"), path.join("nested", "deeper")]) {
    let calls = 0;
    await assert.rejects(removeDemoSession("sessions", name, { remove: async () => { calls += 1; } }), /outside its workspace/u);
    assert.equal(calls, 0, name);
  }
});

test("a failed lane keeps its error when the session cleanup then fails", async () => {
  const laneError = new RunnerFailure("gateway.connection", "No new recording appeared after Stop");
  let cleanedUp = false;
  await assert.rejects(
    runThenCleanUp(async () => { throw laneError; }, async () => { cleanedUp = true; throw codedError("EBUSY"); }),
    (error: unknown) => error === laneError,
  );
  assert.equal(cleanedUp, true);
  assert.equal(laneError.category, "gateway.connection");
  assert.deepEqual(laneError.message.split("\n"), [
    "No new recording appeared after Stop",
    "Demo session cleanup also failed: EBUSY: resource busy or locked, rmdir 'session'",
  ]);
  assert.match(laneError.stack ?? "", /No new recording appeared after Stop\nDemo session cleanup also failed: EBUSY/u);
});

test("every later cleanup failure is appended under its own label", async () => {
  const laneError = new Error("lane failed");
  const processError = new RunnerFailure("process.startup", "Process cleanup failed: demo-fluxiq-web: process remained active");
  const cleanUp = () => runThenCleanUp(async () => { throw processError; }, async () => { throw codedError("EBUSY"); }, "Demo session removal also failed");
  await assert.rejects(runThenCleanUp(async () => { throw laneError; }, cleanUp), (error: unknown) => error === laneError);
  assert.deepEqual(laneError.message.split("\n"), [
    "lane failed",
    "Demo session cleanup also failed: Process cleanup failed: demo-fluxiq-web: process remained active",
    "Demo session removal also failed: EBUSY: resource busy or locked, rmdir 'session'",
  ]);
});

test("a lane that throws a non-Error value still reports both failures", async () => {
  await assert.rejects(
    runThenCleanUp(async () => { throw "lane string"; }, async () => { throw codedError("EPERM"); }),
    (error: unknown) => error instanceof Error && error.message === "lane string\nDemo session cleanup also failed: EPERM: resource busy or locked, rmdir 'session'" && error.cause === "lane string",
  );
});

test("when only the cleanup fails, the cleanup error is the failure", async () => {
  const cleanupError = codedError("EBUSY");
  await assert.rejects(runThenCleanUp(async () => "recorded", async () => { throw cleanupError; }), (error: unknown) => error === cleanupError);
  assert.equal(cleanupError.message, "EBUSY: resource busy or locked, rmdir 'session'");
});

test("a failed lane with a clean cleanup keeps its error unchanged, and a passing lane returns after cleanup", async () => {
  const laneError = new Error("lane failed");
  await assert.rejects(runThenCleanUp(async () => { throw laneError; }, async () => undefined), (error: unknown) => error === laneError);
  assert.equal(laneError.message, "lane failed");
  const order: string[] = [];
  const value = await runThenCleanUp(async () => { order.push("lane"); return 7; }, async () => { order.push("cleanup"); });
  assert.equal(value, 7);
  assert.deepEqual(order, ["lane", "cleanup"]);
});

test("removing a session deletes a junction inside it without touching the junction's target", async () => {
  const scratch = await mkdtemp(path.join(os.tmpdir(), "demo-session-junction-"));
  try {
    const pinnedCore = path.join(scratch, "pinned-core");
    await mkdir(pinnedCore, { recursive: true });
    const kept = path.join(pinnedCore, "kept.txt");
    await writeFile(kept, "pinned core file");
    const sessions = path.join(scratch, ".s");
    const session = path.join(sessions, "916ff5549d31");
    await mkdir(path.join(session, "c"), { recursive: true });
    const junction = path.join(session, "c", "packages");
    await symlink(pinnedCore, junction, "junction");
    assert.equal((await lstat(junction)).isSymbolicLink(), true);
    assert.equal(await readFile(path.join(junction, "kept.txt"), "utf8"), "pinned core file");

    await removeDemoSession(sessions, "916ff5549d31");

    await assert.rejects(stat(session), { code: "ENOENT" });
    assert.equal(await readFile(kept, "utf8"), "pinned core file");
  } finally {
    await rm(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});

test("the demo Core serves the cached production build, shared with every run of that Core, never a development server", async () => {
  const source = await readFile(path.resolve(import.meta.dirname, "..", "..", "..", "src", "demo-workspace", "core-process.ts"), "utf8");
  assert.match(source, /await prepareCoreWebBuild\(\{[^}]*fluxiqRepositoryRoot: config\.fluxiqRepositoryRoot,/u);
  // The cache is the Core's, not this session's runs directory: the demo and
  // every Lab run against the same Core share one build and one lock.
  assert.doesNotMatch(source, /prepareCoreWebBuild\(\{[^}]*runsDirectory/u);
  assert.match(source, /supervisor\.start\(coreWebServerProcessSpec\(\{\s*name: "demo-fluxiq-web",\s*build: coreWebBuild,\s*port: webPort,/u);
  assert.doesNotMatch(source, /"dev"|--turbopack|prepareWebWorkspace/u);
});

function topologyConfiguration(webPort: number, gatewayPort: number) {
  const repository = path.resolve(import.meta.dirname, "..", "..", "..", "..", "..");
  return resolveDemoWorkspaceConfiguration(repository, { FLUXIQ_TEST_USERNAME: "runner", FLUXIQ_TEST_PASSWORD: "secret-password", FLUXIQ_TEST_PIN: "123456" }, {
    origin: `http://127.0.0.1:${webPort}`,
    gatewayUrl: `ws://127.0.0.1:${gatewayPort}/client`,
  });
}

test("a start whose panel and gateway share a port is refused before anything is launched", async () => {
  const config = { ...topologyConfiguration(52001, 52002), gatewayUrl: "ws://127.0.0.1:52001/client" };
  await assert.rejects(startPersistentDemoCore(config), /must use different ports/u);
});

test("a start on a port another process holds is refused before anything is launched", async () => {
  const holder = createServer();
  await new Promise<void>(resolve => holder.listen(0, "127.0.0.1", () => resolve()));
  try {
    const address = holder.address();
    assert.ok(address && typeof address === "object");
    await assert.rejects(startPersistentDemoCore(topologyConfiguration(address.port, 52002)), /cannot be bound/u);
  } finally {
    await new Promise<void>(resolve => holder.close(() => resolve()));
  }
});

test("a restart start skips the host build, domain setup and identity check, and still launches the cached production build", async () => {
  const source = await readFile(path.resolve(import.meta.dirname, "..", "..", "..", "src", "demo-workspace", "core-process.ts"), "utf8");
  const prepared = /if \(!options\.reusePreparedWorkspace\) \{([\s\S]*?)\n    \}\n    const coreWebBuild = await prepareCoreWebBuild/u.exec(source);
  assert.ok(prepared, "the one-time preparation is guarded by reusePreparedWorkspace and precedes the Core web build");
  for (const step of ['name: "demo-host-build"', 'name: "demo-domain-setup"', "await ensureDemoIdentity(config);"]) assert.ok(prepared[1]!.includes(step), step);
  assert.match(source, /export async function withPersistentDemoCore[\s\S]*?const core = await startPersistentDemoCore\(config\);\s*return runThenCleanUp\(operation, \(\) => core\.stop\(\)\);/u);
});
