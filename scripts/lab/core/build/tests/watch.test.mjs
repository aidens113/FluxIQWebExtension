import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { coreOutputChange, coreRepositoryRoot, scanCoreOutput, waitForQuietCoreOutput } from "../index.mjs";

const REPO = path.resolve("F:/repo");

/** A Core-shaped checkout: `<root>/packages/<name>/dist/<file>`, with mtimes we choose. */
async function fakeCore(files) {
  const root = await mkdtemp(path.join(tmpdir(), "fluxiq-core-watch-"));
  await emit(root, files);
  return root;
}

async function emit(root, files) {
  for (const [relative, mtimeMs] of Object.entries(files)) {
    const file = path.join(root, "packages", relative);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, "x");
    if (mtimeMs !== undefined) await utimes(file, new Date(mtimeMs), new Date(mtimeMs));
  }
}

test("Core is resolved exactly where the runner CLI resolves it", () => {
  assert.equal(coreRepositoryRoot({}, REPO), path.resolve(REPO, "..", "!FluxIQ"));
  assert.equal(coreRepositoryRoot({ FLUXIQ_CORE_ROOT: "F:/elsewhere/core" }, REPO), path.resolve("F:/elsewhere/core"));
  assert.equal(coreRepositoryRoot({ FLUXIQ_CORE_ROOT: "  " }, REPO), path.resolve(REPO, "..", "!FluxIQ"));
});

test("a scan counts every built file under packages/*/dist and names the newest", async () => {
  const root = await fakeCore({
    "contracts/dist/index.js": 1_000_000,
    "contracts/dist/nested/deep.js": 5_000_000,
    "fluxiq/dist/programs/automation-studio.js": 3_000_000,
    "fluxiq/src/not-output.ts": 9_000_000,
    "fluxiq/node_modules/@fluxiq/contracts/dist/linked.js": 9_000_000,
  });
  try {
    const scan = await scanCoreOutput(root);
    assert.equal(scan.files, 3, "sources and node_modules are not build output and are not walked");
    assert.equal(scan.newestMs, 5_000_000);
    assert.equal(scan.newestPath, path.join(root, "packages", "contracts", "dist", "nested", "deep.js"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a checkout with no built output is absent, not a reason to wait", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "fluxiq-core-watch-"));
  try {
    const guard = await waitForQuietCoreOutput(root, { quietMs: 30_000, now: () => 100_000 });
    assert.deepEqual([guard.status, guard.scan.files], ["absent", 0]);
    assert.equal(coreOutputChange(guard.scan, guard.scan), null);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

// The guard engaging, against a real filesystem: Core is mid-rebuild, so the
// wait blocks, and each poll re-scans, so it releases the moment the emit
// burst stops -- not on a fixed sleep.
test("the guard blocks while Core is emitting and releases once the burst stops", async () => {
  const root = await fakeCore({ "contracts/dist/index.js": 0 });
  try {
    let clock = 1_000_000;
    const waits = [];
    let polls = 0;
    const burst = [1_000_000 - 4_000, 1_000_000 - 2_000, 1_000_000];
    await emit(root, { "contracts/dist/index.js": burst[0] });
    const guard = await waitForQuietCoreOutput(root, {
      quietMs: 10_000,
      timeoutMs: 60_000,
      pollMs: 1_000,
      now: () => clock,
      onWait: (scan, quietMs) => waits.push([scan.files, quietMs]),
      sleep: async () => {
        clock += 1_000;
        polls += 1;
        // Two more files land while we wait, then the build goes quiet.
        if (polls <= 2) await emit(root, { [`contracts/dist/emitted-${polls}.js`]: burst[polls] });
      },
    });
    assert.equal(guard.status, "quiet");
    assert.deepEqual(waits, [[1, 10_000]], "the wait is announced once, not once per poll");
    assert.equal(guard.scan.files, 3, "the scan that released the wait saw the whole burst");
    // Quiet means 10s past the newest write, and the newest write was at
    // clock 1_000_000, so the wait cannot have ended before clock 1_010_000.
    assert.ok(clock - guard.scan.newestMs >= 10_000, `released at ${clock} with newest ${guard.scan.newestMs}`);
    assert.ok(guard.waitedMs >= 10_000, `waited ${guard.waitedMs}ms`);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a Core that never goes quiet times out rather than blocking forever, and says so", async () => {
  const root = await fakeCore({ "contracts/dist/index.js": 1_000_000 });
  try {
    let clock = 1_000_000;
    const guard = await waitForQuietCoreOutput(root, {
      quietMs: 30_000, timeoutMs: 5_000, pollMs: 1_000,
      now: () => clock,
      sleep: async () => { clock += 1_000; await emit(root, { "contracts/dist/index.js": clock }); },
    });
    assert.equal(guard.status, "timed-out");
    assert.ok(guard.waitedMs >= 5_000);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("quietMs 0 turns the wait off but still produces the scan the after-run check compares against", async () => {
  const root = await fakeCore({ "contracts/dist/index.js": Date.now() });
  try {
    const guard = await waitForQuietCoreOutput(root, { quietMs: 0 });
    assert.deepEqual([guard.status, guard.scan.files], ["disabled", 1]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

// The half the wait cannot cover: Core was quiet at the start and was rebuilt
// while the run was in flight. This is the exact shape of the incident -- a
// clean that removes files, then a burst that re-emits more of them.
test("a rebuild that lands during a run is detected afterwards, by both a newer write and a changed file count", async () => {
  const root = await fakeCore({ "contracts/dist/a.js": 1_000_000, "contracts/dist/b.js": 1_000_000 });
  try {
    const before = await scanCoreOutput(root);
    assert.equal(coreOutputChange(before, await scanCoreOutput(root)), null, "an untouched Core is not a change");

    await rm(path.join(root, "packages", "contracts", "dist"), { recursive: true, force: true });
    await emit(root, { "contracts/dist/a.js": 2_000_000, "contracts/dist/b.js": 2_000_000, "contracts/dist/c.js": 2_000_000 });
    const change = coreOutputChange(before, await scanCoreOutput(root));
    assert.ok(change !== null);
    assert.deepEqual([change.fileDelta, change.before.files, change.after.files], [1, 2, 3]);
    assert.ok(change.after.newestMs > change.before.newestMs);

    // A clean caught mid-flight removes files without moving any mtime, so
    // comparing timestamps alone would have called it quiet. The count is why
    // it does not.
    const emitted = await scanCoreOutput(root);
    await rm(path.join(root, "packages", "contracts", "dist", "c.js"));
    const cleaned = coreOutputChange(emitted, await scanCoreOutput(root));
    assert.ok(cleaned !== null, "a deletion with no newer write is still movement");
    assert.deepEqual([cleaned.fileDelta, cleaned.before.newestMs, cleaned.after.newestMs], [-1, 2_000_000, 2_000_000]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

// A read-only probe of the real sibling checkout: the guard must find FluxIQ
// Core's actual build output, or it guards nothing. Skipped when Core is not
// checked out beside this repository.
test("the probe finds the real FluxIQ Core checkout's build output", async (t) => {
  const root = coreRepositoryRoot(process.env, path.resolve(import.meta.dirname, "..", "..", ".."));
  const scan = await scanCoreOutput(root);
  if (scan.files === 0) {
    t.skip(`no FluxIQ Core build output under ${root}`);
    return;
  }
  assert.ok(scan.files > 100, `expected FluxIQ Core's built packages, found ${scan.files} files under ${root}`);
  assert.ok(scan.newestPath !== null && scan.newestPath.startsWith(root));
  assert.ok(scan.newestMs > 0 && scan.newestMs <= Date.now() + 60_000);
});
