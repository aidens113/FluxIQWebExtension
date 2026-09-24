import assert from "node:assert/strict";
import path from "node:path";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import test from "node:test";
import { withBuildLock } from "../build-lock.mjs";
import { resolveLabInstancePaths } from "../lab-instance.mjs";

const ROOT = path.resolve("F:/repo");

test("no instance leaves every Lab path where it has always been", () => {
  const paths = resolveLabInstancePaths({}, ROOT);
  assert.equal(paths.instance, null);
  assert.equal(paths.hostModule, null);
  assert.equal(paths.extensionBuildRoot, path.join(ROOT, "apps", "extension"));
  assert.equal(paths.extensionPath, path.join(ROOT, "apps", "extension", "dist", "e2e-chromium"));
  assert.equal(paths.scenarioOutDir, path.join(ROOT, "apps", "scenario-lab", "dist"));
  assert.equal(paths.scenarioEntrypoint, path.join(ROOT, "apps", "scenario-lab", "dist", "server.js"));
});

// Each output stays under the package that produced it: the compiled scenario
// lab and the host bundle import workspace packages by bare specifier, and Node
// resolves those only by walking up into that package's own node_modules.
test("an instance owns its extension, scenario lab and host output, inside each package", () => {
  const paths = resolveLabInstancePaths({ FLUXIQ_LAB_INSTANCE: "lab-a" }, ROOT);
  assert.equal(paths.instance, "lab-a");
  assert.equal(paths.extensionBuildRoot, path.join(ROOT, "apps", "extension", ".lab-instances", "lab-a"));
  assert.equal(paths.extensionPath, path.join(ROOT, "apps", "extension", ".lab-instances", "lab-a", "dist", "e2e-chromium"));
  assert.equal(paths.scenarioEntrypoint, path.join(ROOT, "apps", "scenario-lab", ".lab-instances", "lab-a", "dist", "server.js"));
  assert.equal(paths.hostModule, path.join(ROOT, "domain", ".lab-instances", "lab-a", "host", "web-panel-host.mjs"));
});

test("every instance path lies inside the package whose node_modules it must reach", () => {
  const paths = resolveLabInstancePaths({ FLUXIQ_LAB_INSTANCE: "lab-a" }, ROOT);
  const inside = (child, parent) => !path.relative(path.join(ROOT, parent), child).startsWith("..");
  assert.ok(inside(paths.extensionPath, path.join("apps", "extension")));
  assert.ok(inside(paths.scenarioEntrypoint, path.join("apps", "scenario-lab")));
  assert.ok(inside(paths.hostModule, "domain"));
});

test("two instances share no build path", () => {
  const first = resolveLabInstancePaths({ FLUXIQ_LAB_INSTANCE: "lab-a" }, ROOT);
  const second = resolveLabInstancePaths({ FLUXIQ_LAB_INSTANCE: "lab-b" }, ROOT);
  for (const key of ["extensionBuildRoot", "extensionPath", "scenarioOutDir", "scenarioEntrypoint", "hostModule"]) {
    assert.notEqual(first[key], second[key], `${key} must differ between instances`);
  }
  assert.equal(first.buildLockPath, second.buildLockPath, "both instances must contend for the same build lock");
});

test("an unusable instance name is refused rather than turned into a path", () => {
  for (const name of ["Lab A", "../escape", "lab_a", "-lab", "l".repeat(65)]) {
    assert.throws(() => resolveLabInstancePaths({ FLUXIQ_LAB_INSTANCE: name }, ROOT), /lowercase kebab-case/u);
  }
});

test("the build lock excludes a second holder and is released afterwards", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "lab-lock-"));
  const lockPath = path.join(directory, "build.lock");
  try {
    let observedWait = false;
    await withBuildLock(lockPath, async () => {
      const held = JSON.parse(await readFile(lockPath, "utf8"));
      assert.equal(held.pid, process.pid);
      await assert.rejects(
        withBuildLock(lockPath, async () => undefined, { pid: process.pid + 1, timeoutMs: 40, pollMs: 10, isProcessAlive: () => true, onWait: () => { observedWait = true; } }),
        /Timed out waiting/u,
      );
      assert.equal(observedWait, true);
    });
    await assert.rejects(readFile(lockPath, "utf8"), { code: "ENOENT" });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

// The failure this heartbeat exists for. On 2026-09-24 a campaign died with the
// machine holding the lock at `{"pid":2656}`; the next campaign's own node
// process was handed pid 2656, so `isProcessAlive` said yes and it waited on
// itself -- one line printed, nothing building, and a 45-minute timeout ahead of
// it. A pid is not an identity across a crash, and this is the clause that does
// not care.
test("a lock left by a crash is reclaimed even when its pid has been handed to someone else", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "lab-lock-"));
  const lockPath = path.join(directory, "build.lock");
  try {
    const longAgo = new Date(Date.now() - 10 * 60_000).toISOString();
    await writeFile(lockPath, `${JSON.stringify({ pid: 2656, acquiredAt: longAgo, heartbeatAt: longAgo })}
`, "utf8");
    let ran = false;
    // Every pid is alive, as it was that night: the waiter must free itself on
    // the heartbeat alone.
    await withBuildLock(lockPath, async () => { ran = true; }, { pid: 2656, isProcessAlive: () => true, timeoutMs: 2_000, pollMs: 10 });
    assert.equal(ran, true);
    await assert.rejects(readFile(lockPath, "utf8"), { code: "ENOENT" });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

// A record written before heartbeats existed carries none, so its age is read
// from `acquiredAt`. An old one is reclaimed; a fresh one is still respected.
test("a lock with no heartbeat is judged by its age, not taken for fresh", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "lab-lock-"));
  const lockPath = path.join(directory, "build.lock");
  try {
    await writeFile(lockPath, `${JSON.stringify({ pid: 99, acquiredAt: new Date(Date.now() - 10 * 60_000).toISOString() })}
`, "utf8");
    let ran = false;
    await withBuildLock(lockPath, async () => { ran = true; }, { pid: 100, isProcessAlive: () => true, timeoutMs: 2_000, pollMs: 10 });
    assert.equal(ran, true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

// And a holder that is genuinely building still holds it: the beat keeps the
// record fresh, so a waiter must not walk in and take the lock from under it.
test("a holder that keeps beating is not reclaimed", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "lab-lock-"));
  const lockPath = path.join(directory, "build.lock");
  try {
    await withBuildLock(lockPath, async () => {
      await new Promise(resolve => setTimeout(resolve, 120));
      const held = JSON.parse(await readFile(lockPath, "utf8"));
      assert.equal(held.pid, process.pid);
      await assert.rejects(
        withBuildLock(lockPath, async () => undefined, { pid: process.pid + 1, timeoutMs: 60, pollMs: 10, isProcessAlive: () => true }),
        /Timed out waiting/u,
      );
    }, { heartbeatMs: 20, staleAfterMs: 5_000 });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("a lock whose process is gone is reclaimed instead of waited on", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "lab-lock-"));
  const lockPath = path.join(directory, "build.lock");
  try {
    await writeFile(lockPath, `${JSON.stringify({ pid: 4242, acquiredAt: new Date().toISOString() })}
`, "utf8");
    let ran = false;
    await withBuildLock(lockPath, async () => { ran = true; }, { pid: 4243, isProcessAlive: pid => pid !== 4242, timeoutMs: 2_000, pollMs: 10 });
    assert.equal(ran, true);
    await assert.rejects(readFile(lockPath, "utf8"), { code: "ENOENT" });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
