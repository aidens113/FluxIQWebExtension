import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { orphanedCores } from "../orphaned-cores.mjs";

const base = path.resolve("F:/fxwork");

test("the shared Core is orphaned once the last task beside it is gone", () => {
  const withTask = orphanedCores({
    base,
    extWorktrees: [path.join(base, "t042-flow-editor")],
    coreWorktrees: [path.join(base, "!FluxIQ")]
  });
  assert.deepEqual(withTask, []);

  const withoutTask = orphanedCores({ base, extWorktrees: [], coreWorktrees: [path.join(base, "!FluxIQ")] });
  assert.deepEqual(withoutTask, [path.join(base, "!FluxIQ")]);
});

test("one remaining task keeps the Core every task beside it shares", () => {
  // The flat layout's whole point: three tasks, one Core. Finishing two of them
  // must not reclaim the Core the third is still building against.
  const orphaned = orphanedCores({
    base,
    extWorktrees: [path.join(base, "t044-recorder")],
    coreWorktrees: [path.join(base, "!FluxIQ")]
  });
  assert.deepEqual(orphaned, []);
});

test("a Core-paired task's nested Core is judged against its own task directory", () => {
  const taskDir = path.join(base, "t050");
  const nestedCore = path.join(taskDir, "!FluxIQ");

  // Its own worktree is still there, so the nested Core is in use -- even
  // though nothing sits beside the shared Core one level up.
  assert.deepEqual(
    orphanedCores({ base, extWorktrees: [path.join(taskDir, "!FluxIQWebExtension")], coreWorktrees: [nestedCore] }),
    []
  );

  // And a flat task elsewhere under the base does not keep it alive: it is not
  // in the same directory, so it cannot be linking it.
  assert.deepEqual(
    orphanedCores({ base, extWorktrees: [path.join(base, "t051-other")], coreWorktrees: [nestedCore] }),
    [nestedCore]
  );
});

test("a Core outside the disposable base is never reported, whoever is using it", () => {
  // The real F:/!FluxIQ checkout is a worktree of the same repository and has
  // no task beside it by design. Reporting it would point a delete at the
  // user's own working copy.
  const real = path.resolve("F:/!FluxIQ");
  assert.deepEqual(orphanedCores({ base, extWorktrees: [], coreWorktrees: [real] }), []);
  assert.deepEqual(orphanedCores({ base, extWorktrees: [], coreWorktrees: [real, path.join(base, "!FluxIQ")] }), [path.join(base, "!FluxIQ")]);
});

test("paths are compared the way Windows compares them", () => {
  // git reports worktrees with forward slashes; resolveTaskRoots builds them
  // with backslashes. A case- or separator-sensitive comparison would call a
  // Core orphaned while its task is sitting right beside it.
  const orphaned = orphanedCores({
    base: "f:/FXWORK",
    extWorktrees: ["F:/fxwork/t042-flow-editor"],
    coreWorktrees: ["F:/fxwork/!FluxIQ"]
  });
  assert.deepEqual(orphaned, []);
});
