import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { findScratchRoots } from "../scratch-roots.mjs";

async function fixture(directories) {
  const root = await mkdtemp(path.join(os.tmpdir(), "scratch-roots-"));
  for (const relative of directories) await mkdir(path.join(root, relative), { recursive: true });
  return root;
}

test("both scratch names are found under any workspace package", async (t) => {
  // Discovered rather than listed, because a package added later would
  // otherwise leak build output nothing ever reclaims.
  const root = await fixture([
    "apps/extension/.test-build-scratch/a-label",
    "apps/extension/.lab-instances/lab-a",
    "domain/.test-build-scratch/d1",
    "packages/a-package-added-later/.lab-instances/lab-b",
    "apps/extension/src/content"
  ]);
  t.after(() => rm(root, { recursive: true, force: true }));

  const found = await findScratchRoots(root);

  assert.deepEqual(found.map((entry) => path.relative(root, entry).replaceAll("\\", "/")), [
    "apps/extension/.lab-instances",
    "apps/extension/.test-build-scratch",
    "domain/.test-build-scratch",
    "packages/a-package-added-later/.lab-instances"
  ]);
});

test("node_modules and test-runs are never descended", async (t) => {
  // node_modules holds a copy of every workspace package, so descending it
  // would report a linked package's scratch root as if it were its own -- and
  // then point a recursive delete through a symlink. test-runs is evidence,
  // which this command deliberately does not touch.
  const root = await fixture([
    "node_modules/@fluxiq-web-extension/domain/.test-build-scratch/d1",
    "test-runs/run-1/.lab-instances/lab-a",
    "domain/.test-build-scratch/d1"
  ]);
  t.after(() => rm(root, { recursive: true, force: true }));

  const found = await findScratchRoots(root);

  assert.deepEqual(found.map((entry) => path.relative(root, entry).replaceAll("\\", "/")), ["domain/.test-build-scratch"]);
});

test("a match is not descended, so a root inside a root is not reported twice", async (t) => {
  const root = await fixture(["domain/.test-build-scratch/d1/.lab-instances/nested"]);
  t.after(() => rm(root, { recursive: true, force: true }));

  const found = await findScratchRoots(root);

  assert.deepEqual(found.map((entry) => path.relative(root, entry).replaceAll("\\", "/")), ["domain/.test-build-scratch"]);
});

test("the walk is bounded, so it cannot wander the whole tree", async (t) => {
  const root = await fixture(["a/b/c/d/e/.lab-instances/lab-a", "a/.lab-instances/lab-b"]);
  t.after(() => rm(root, { recursive: true, force: true }));

  const found = await findScratchRoots(root);

  assert.deepEqual(found.map((entry) => path.relative(root, entry).replaceAll("\\", "/")), ["a/.lab-instances"]);
});

test("a repository with nothing to prune yields no roots rather than failing", async (t) => {
  const root = await fixture(["apps/extension/src"]);
  t.after(() => rm(root, { recursive: true, force: true }));

  assert.deepEqual(await findScratchRoots(root), []);
});
