import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";
import { acquireCoreBuildLease } from "../index.mjs";
import { fixture, until } from "./fixture.mjs";

test("a real forced Core build waits for the lease, and heartbeat defeats stale takeover", async (t) => {
  const f = await fixture(t);
  const lease = f.start("lease");
  await until(() => lease.messages.includes("held"));
  const before = (await stat(f.lockPath())).mtimeMs;
  const build = f.start("build", { FLUXIQ_BUILD_FORCE: "1", TEST_STALE_MS: "100" });
  await until(() => build.messages.includes("attempting"));
  await delay(350);
  assert.equal(existsSync(path.join(f.root, "state/started")), false);
  assert.ok((await stat(f.lockPath())).mtimeMs > before);
  lease.send("release");
  assert.equal(await lease.done, 0, lease.errors);
  assert.equal(await build.done, 0, build.errors);
  assert.equal(await f.read("packages/fluxiq/dist/out.txt"), "built output");
});

test("a prior real Core build blocks lease acquisition until its command finishes", async (t) => {
  const f = await fixture(t);
  const build = f.start("build", { TEST_GATE: path.join(f.root, "state/gate"), FLUXIQ_BUILD_FORCE: "1" });
  await until(() => existsSync(path.join(f.root, "state/started")));
  const lease = f.start("lease");
  // The lease takes contracts first, then waits for the running fluxiq build.
  await until(() => existsSync(f.lockPath("contracts:build")));
  assert.equal(lease.messages.includes("held"), false);
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
  assert.notEqual(JSON.parse(await readFile(f.lockPath(), "utf8")).token, "dead");
  await recovered.release();
  await assert.rejects(acquireCoreBuildLease(f.root, { onAcquired() { throw new Error("probe failure"); } }), /probe failure/u);
  for (const step of ["contracts:build", "fluxiq:build", "client-gateway-websocket:build"]) assert.equal(existsSync(f.lockPath(step)), false);
});

test("explicit process exit cleans up owned locks synchronously", async (t) => {
  const f = await fixture(t);
  const lease = f.start("exit");
  await until(() => lease.messages.includes("held"));
  lease.send("exit");
  assert.equal(await lease.done, 7, lease.errors);
  for (const step of ["contracts:build", "fluxiq:build", "client-gateway-websocket:build"]) assert.equal(existsSync(f.lockPath(step)), false);
});

test("heartbeat loss is reported, and release never deletes another owner's lock", async (t) => {
  const f = await fixture(t);
  let lost = null;
  const lease = await acquireCoreBuildLease(f.root, { heartbeatMs: 20, onLost: (error) => { lost = error; } });
  for (const step of ["contracts:build", "fluxiq:build", "client-gateway-websocket:build"]) {
    assert.equal(JSON.parse(await readFile(f.lockPath(step), "utf8")).pid, process.pid);
  }
  await writeFile(f.lockPath(), JSON.stringify({ pid: process.pid, token: "replacement" }));
  await until(() => lost !== null);
  assert.throws(() => lease.assertHeld(), /heartbeat failed/u);
  await lease.release();
  assert.equal(JSON.parse(await readFile(f.lockPath(), "utf8")).token, "replacement");
});

test("an unsupported package cache fails before acquiring any locks", async (t) => {
  const f = await fixture(t);
  await f.put("packages/fluxiq/package.json", JSON.stringify({ name: "fluxiq", scripts: { build: "tsc" } }));
  await assert.rejects(acquireCoreBuildLease(f.root), /unsupported.*fluxiq/u);
  assert.equal(existsSync(f.lockPath("contracts:build")), false);
});
