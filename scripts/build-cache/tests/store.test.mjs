import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readdir, readFile, rm, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import { pathToFileURL } from "node:url";
import { decideStep, entryDirectory, findEmbeddedPath, pathSpellings, pruneStore, storeDirectory } from "../index.mjs";
import { makeScratchWorkspace, putFile, runsIn, runScratch, SCRATCH_STEPS } from "./scratch-workspace.mjs";

let first;
let second;
let store;
beforeEach(async () => {
  first = await makeScratchWorkspace("build-store-one-");
  second = await makeScratchWorkspace("build-store-two-");
  store = await mkdtemp(path.join(os.tmpdir(), "build-store-dir-"));
});
afterEach(async () => {
  for (const dir of [first, second, store]) await rm(dir, { recursive: true, force: true });
});

async function entries() {
  const dir = path.join(store, "v1");
  return existsSync(dir) ? readdir(dir) : [];
}

test("the same inputs in two trees at different paths have one fingerprint", async () => {
  assert.notEqual(first, second);
  for (const step of Object.keys(SCRATCH_STEPS)) {
    const one = await decideStep(step, { repoRoot: first, steps: SCRATCH_STEPS, env: {} });
    const two = await decideStep(step, { repoRoot: second, steps: SCRATCH_STEPS, env: {} });
    assert.equal(one.fingerprint, two.fingerprint, step);
    const fingerprinted = JSON.stringify({ meta: one.resolved.meta, roots: one.resolved.roots.map((root) => root.label) }).toLowerCase();
    for (const spelling of pathSpellings([first])) assert.ok(!fingerprinted.includes(spelling), `${step} fingerprints ${spelling}`);
  }
});

test("a result built in one tree is restored in another, then reused from the local stamp", async () => {
  for (const step of ["a:build", "b:build", "a:check"]) {
    const built = await runScratch(first, step, store);
    assert.equal(built.result, "build", step);
    assert.match(built.reason, /^no stamp; stored in the shared store \(\d+ file\(s\), \d+ bytes\)$/u, step);
  }
  assert.equal((await entries()).length, 3);

  for (const step of ["a:build", "b:build", "a:check"]) {
    const restored = await runScratch(second, step, store);
    assert.deepEqual([restored.result, restored.source, restored.exitCode], ["reuse", "store", 0], step);
    assert.equal(restored.reason, "restored from the shared store (no stamp)", step);
    const again = await runScratch(second, step, store);
    assert.deepEqual([again.result, again.source], ["reuse", "stamp"], step);
  }
  assert.deepEqual(await runsIn(second), [], "nothing ran in the second tree");
  for (const pkg of ["a", "b"]) {
    const file = `packages/${pkg}/dist/out.txt`;
    assert.equal(await readFile(path.join(second, file), "utf8"), await readFile(path.join(first, file), "utf8"), file);
  }
});

test("an edit in the second tree builds there and stores a second entry", async () => {
  await runScratch(first, "a:build", store);
  await putFile(second, "packages/a/src/main.txt", "a source, edited\n");
  const built = await runScratch(second, "a:build", store);
  assert.equal(built.result, "build");
  assert.deepEqual(await runsIn(second), ["a"]);
  assert.equal((await entries()).length, 2);
});

test("an output holding the tree's absolute path is not stored, and says why", async () => {
  await putFile(first, "packages/a/embed-path", "");
  const built = await runScratch(first, "a:build", store);
  assert.equal(built.exitCode, 0);
  assert.match(built.reason, /not stored: packages\/a\/dist\/out\.txt holds this tree's absolute path \(.+\), so it is not relocatable/u);
  assert.deepEqual(await entries(), []);
  assert.equal((await runScratch(first, "a:build", store)).source, "stamp", "the local stamp is still written");
});

test("every common spelling of the tree's path is found", async () => {
  const root = path.resolve(first);
  const forward = root.split(path.sep).join("/");
  const flipped = /^[a-z]:/iu.test(forward) ? (forward[0] === forward[0].toUpperCase() ? forward[0].toLowerCase() : forward[0].toUpperCase()) + forward.slice(1) : forward;
  const written = {
    native: root,
    forward,
    "drive case": flipped,
    backslash: flipped.split("/").join("\\"),
    "JSON-escaped": JSON.stringify(root).slice(1, -1),
    "file URL": pathToFileURL(root).href,
    "upper-cased": root.toUpperCase()
  };
  const spellings = pathSpellings([root]);
  for (const [how, text] of Object.entries(written)) {
    const file = path.join(store, `${how}.txt`);
    await writeFile(file, `prefix ${text}/packages/a/dist/out.txt suffix`);
    assert.notEqual(await findEmbeddedPath([file], spellings), null, `${how}: ${text}`);
  }
  const clean = path.join(store, "clean.txt");
  await writeFile(clean, "../../packages/a/src/main.txt and C:/somewhere/else");
  assert.equal(await findEmbeddedPath([clean], spellings), null);
});

test("an entry whose restored outputs do not match the stored digest is discarded and the step builds", async () => {
  await runScratch(first, "a:build", store);
  const [key] = await entries();
  await writeFile(path.join(entryDirectory(store, key), "files", "0"), "tampered\n");
  const outcome = await runScratch(second, "a:build", store);
  assert.equal(outcome.result, "build");
  assert.match(outcome.reason, /^no stamp; store entry discarded, because the restored outputs digest to [0-9a-f]{12}, not the stored [0-9a-f]{12}; stored in the shared store/u);
  assert.deepEqual(await runsIn(second), ["a"]);
  assert.equal(await readFile(path.join(second, "packages/a/dist/out.txt"), "utf8"), "a source\n");
  const third = await makeScratchWorkspace("build-store-three-");
  try {
    assert.equal((await runScratch(third, "a:build", store)).source, "store", "the rebuilt entry is good");
  } finally {
    await rm(third, { recursive: true, force: true });
  }
});

test("an entry with a missing blob is discarded", async () => {
  await runScratch(first, "a:build", store);
  const [key] = await entries();
  await rm(path.join(entryDirectory(store, key), "files", "0"));
  const outcome = await runScratch(second, "a:build", store);
  assert.equal(outcome.result, "build");
  assert.match(outcome.reason, /store entry discarded, because blob 0 \(packages\/a\/dist\/out\.txt\) is missing/u);
});

test("FLUXIQ_BUILD_FORCE=1 builds instead of restoring", async () => {
  await runScratch(first, "a:build", store);
  const forced = await runScratch(second, "a:build", store, { FLUXIQ_BUILD_FORCE: "1" });
  assert.equal(forced.result, "build");
  assert.match(forced.reason, /^FLUXIQ_BUILD_FORCE=1; already in the shared store$/u);
});

test("FLUXIQ_BUILD_CACHE_DIR=off stores nothing", async () => {
  const built = await runScratch(first, "a:build", "off");
  assert.equal(built.reason, "no stamp");
  assert.equal((await runScratch(second, "a:build", "off")).source, "command");
});

test("the store directory defaults to LOCALAPPDATA, and can be moved or switched off", () => {
  assert.equal(storeDirectory({ LOCALAPPDATA: path.join(store, "local") }), path.join(store, "local", "fluxiq-build-cache"));
  assert.equal(storeDirectory({ FLUXIQ_BUILD_CACHE_DIR: path.join(store, "mine"), LOCALAPPDATA: store }), path.join(store, "mine"));
  assert.equal(storeDirectory({ FLUXIQ_BUILD_CACHE_DIR: "off" }), null);
  assert.equal(storeDirectory({ FLUXIQ_BUILD_CACHE_DIR: " OFF " }), null);
});

test("pruning removes entries unused for 14 days, then the least recently used above the cap", async () => {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const make = async (name, ageDays, bytes) => {
    const dir = path.join(store, "v1", name.padEnd(64, "0"));
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "entry.json"), JSON.stringify({ bytes }));
    const used = new Date(now - ageDays * day);
    await utimes(path.join(dir, "entry.json"), used, used);
  };
  await make("a", 15, 10);
  await make("b", 3, 60);
  await make("c", 2, 60);
  await make("d", 1, 60);
  await mkdir(path.join(store, "v1", "e".padEnd(64, "0")), { recursive: true });
  const pruned = await pruneStore(store, { now, maxBytes: 130 });
  assert.deepEqual({ kept: pruned.kept, removed: pruned.removed, bytes: pruned.bytes }, { kept: 2, removed: 3, bytes: 120 });
  assert.deepEqual((await entries()).map((name) => name[0]).sort(), ["c", "d"]);
});
