import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";
import { acquireCoreBuildLease } from "../index.mjs";
import { fixture, until } from "./fixture.mjs";

const STEPS = ["contracts:build", "fluxiq:build", "client-gateway-websocket:build", "ui-components:build"];

test("a real forced Core build waits for the lease, and heartbeat defeats stale takeover", async (t) => {
  const f = await fixture(t);
  const lease = f.start("lease");
  await until(() => lease.messages.includes("held"));
  const [entry] = await f.readerPaths();
  const before = (await stat(entry)).mtimeMs;
  const build = f.start("build", { FLUXIQ_BUILD_FORCE: "1", TEST_STALE_MS: "100" });
  await until(() => build.messages.includes("attempting"));
  await delay(350);
  assert.equal(existsSync(path.join(f.root, "state/started")), false);
  assert.ok((await stat(entry)).mtimeMs > before);
  lease.send("release");
  assert.equal(await lease.done, 0, lease.errors);
  assert.equal(await build.done, 0, build.errors);
  assert.equal(await f.read("packages/fluxiq/dist/out.txt"), "built output");
});

test("two leases on one Core are held at once, and a build waits for both", async (t) => {
  const f = await fixture(t);
  const first = f.start("lease");
  const second = f.start("lease");
  await until(() => first.messages.includes("held") && second.messages.includes("held"));
  for (const step of STEPS) assert.equal((await f.readerPaths(step)).length, 2, `${step} has both readers`);
  const build = f.start("build", { FLUXIQ_BUILD_FORCE: "1" });
  await until(() => build.messages.includes("attempting"));
  first.send("release");
  assert.equal(await first.done, 0, first.errors);
  await delay(250);
  assert.equal(existsSync(path.join(f.root, "state/started")), false, "the second lease still holds the build");
  second.send("release");
  assert.equal(await second.done, 0, second.errors);
  assert.equal(await build.done, 0, build.errors);
  assert.equal(await f.read("packages/fluxiq/dist/out.txt"), "built output");
});

test("a prior real Core build blocks lease acquisition until its command finishes", async (t) => {
  const f = await fixture(t);
  const build = f.start("build", { TEST_GATE: path.join(f.root, "state/gate"), FLUXIQ_BUILD_FORCE: "1" });
  await until(() => existsSync(path.join(f.root, "state/started")));
  const lease = f.start("lease");
  // The lease takes contracts first, then waits for the running fluxiq build.
  await until(async () => (await f.readerPaths("contracts:build")).length === 1);
  assert.equal(lease.messages.includes("held"), false);
  assert.deepEqual(await f.readerPaths("fluxiq:build"), [], "no read hold beside a running build");
  await f.put("state/gate");
  assert.equal(await build.done, 0, build.errors);
  await until(() => lease.messages.includes("held"));
  lease.send("release");
  assert.equal(await lease.done, 0, lease.errors);
});

test("the real Core shared-store restore cannot replace output until the lease ends", async (t) => {
  const f = await fixture(t);
  const store = path.join(f.root, "state/store");
  const first = f.start("build", { FLUXIQ_BUILD_CACHE_DIR: store });
  assert.equal(await first.done, 0, first.errors);
  assert.equal(first.messages.at(-1).source, "command");
  await f.put("packages/fluxiq/dist/out.txt", "damaged output");
  const lease = f.start("lease");
  await until(() => lease.messages.includes("held"));
  const restore = f.start("build", { FLUXIQ_BUILD_CACHE_DIR: store });
  await until(() => restore.messages.includes("attempting"));
  await delay(150);
  assert.equal(await f.read("packages/fluxiq/dist/out.txt"), "damaged output");
  assert.equal(restore.messages.length, 1);
  lease.send("release");
  assert.equal(await lease.done, 0, lease.errors);
  assert.equal(await restore.done, 0, restore.errors);
  assert.equal(restore.messages.at(-1).source, "store");
  assert.equal(await f.read("packages/fluxiq/dist/out.txt"), "built output");
});

test("distinct Core roots run independently while one is leased", async (t) => {
  const first = await fixture(t);
  const second = await fixture(t);
  const lease = first.start("lease");
  await until(() => lease.messages.includes("held"));
  const build = second.start("build", { FLUXIQ_BUILD_FORCE: "1" });
  assert.equal(await build.done, 0, build.errors);
  lease.send("release");
  assert.equal(await lease.done, 0, lease.errors);
});

test("dead owners recover and acquisition exceptions release every acquired lock", async (t) => {
  const f = await fixture(t);
  const lease = await acquireCoreBuildLease(f.root);
  await lease.release();
  await writeFile(f.lockPath(), JSON.stringify({ pid: 0, token: "dead", startedAt: "2000-01-01" }));
  const recovered = await acquireCoreBuildLease(f.root);
  assert.equal(existsSync(f.lockPath()), false, "the dead build's lock was broken");
  const [entry] = await f.readerPaths();
  assert.equal(JSON.parse(await readFile(entry, "utf8")).pid, process.pid);
  await recovered.release();
  await assert.rejects(acquireCoreBuildLease(f.root, { onAcquired() { throw new Error("probe failure"); } }), /probe failure/u);
  for (const step of STEPS) {
    assert.equal(existsSync(f.lockPath(step)), false);
    assert.deepEqual(await f.readerPaths(step), []);
  }
});

test("explicit process exit cleans up owned locks synchronously", async (t) => {
  const f = await fixture(t);
  const lease = f.start("exit");
  await until(() => lease.messages.includes("held"));
  for (const step of STEPS) assert.equal((await f.readerPaths(step)).length, 1);
  lease.send("exit");
  assert.equal(await lease.done, 7, lease.errors);
  for (const step of STEPS) {
    assert.equal(existsSync(f.lockPath(step)), false);
    assert.deepEqual(await f.readerPaths(step), []);
  }
});

test("heartbeat loss is reported, and release never deletes another owner's lock", async (t) => {
  const f = await fixture(t);
  let lost = null;
  const lease = await acquireCoreBuildLease(f.root, { heartbeatMs: 20, onLost: (error) => { lost = error; } });
  for (const step of STEPS) {
    const entries = await f.readerPaths(step);
    assert.equal(entries.length, 1);
    assert.equal(JSON.parse(await readFile(entries[0], "utf8")).pid, process.pid);
  }
  const [entry] = await f.readerPaths();
  await writeFile(entry, JSON.stringify({ pid: process.pid, token: "replacement" }));
  await until(() => lost !== null);
  assert.throws(() => lease.assertHeld(), /heartbeat failed/u);
  await lease.release();
  assert.equal(JSON.parse(await readFile(entry, "utf8")).token, "replacement");
});

test("an unsupported package cache fails before acquiring any locks", async (t) => {
  const f = await fixture(t);
  await f.put("packages/fluxiq/package.json", JSON.stringify({ name: "fluxiq", scripts: { build: "tsc" } }));
  await assert.rejects(acquireCoreBuildLease(f.root), /unsupported.*fluxiq/u);
  assert.equal(existsSync(f.lockPath("contracts:build")), false);
  assert.deepEqual(await f.readerPaths("contracts:build"), []);
});
