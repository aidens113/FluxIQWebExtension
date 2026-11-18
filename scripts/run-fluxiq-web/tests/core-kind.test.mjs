import assert from "node:assert/strict";
import test from "node:test";

import { coreKind } from "../index.mjs";

// Which Core the launcher may prepare: decided from git, as the task tool
// decides it (`scripts/worktree/shared-core-move.mjs`), with git faked.

function fakeGit({ branch, gitDir, commonDir }) {
  return async (_cwd, args) => {
    if (args[0] === "symbolic-ref") {
      if (branch) return branch;
      // What runGit rejects with when git exits non-zero.
      throw new Error("git symbolic-ref failed: fatal: ref HEAD is not a symbolic ref", { cause: { code: 1 } });
    }
    if (args.includes("--git-dir")) return gitDir;
    if (args.includes("--git-common-dir")) return commonDir;
    throw new Error(`unexpected git ${args.join(" ")}`);
  };
}

test("the main Core checkout, on a branch, is the launcher's own to prepare", async () => {
  const git = fakeGit({ branch: "dev", gitDir: "C:/FluxStuff/!FluxIQ/.git", commonDir: "C:/FluxStuff/!FluxIQ/.git" });
  assert.equal(await coreKind("C:/FluxStuff/!FluxIQ", { git }), "own");
});

test("a Core-paired task's own Core, a linked worktree on the task's branch, is prepared too", async () => {
  const git = fakeGit({ branch: "task/t927-first-sign-in", gitDir: "C:/FluxStuff/!FluxIQ/.git/worktrees/!FluxIQ1", commonDir: "C:/FluxStuff/!FluxIQ/.git" });
  assert.equal(await coreKind("C:/FluxStuff/fxwork/t927/!FluxIQ", { git }), "own");
});

test("the task tool's shared Core, a linked worktree on a detached HEAD, is shared", async () => {
  const git = fakeGit({ branch: null, gitDir: "C:\FluxStuff\!FluxIQ\.git\worktrees\!FluxIQ", commonDir: "C:/FluxStuff/!FluxIQ/.git" });
  assert.equal(await coreKind("C:/FluxStuff/fxwork/!FluxIQ", { git }), "shared");
});

test("a main checkout someone detached is still their own, not the shared Core", async () => {
  const git = fakeGit({ branch: null, gitDir: "C:/FluxStuff/!FluxIQ/.git", commonDir: "C:/FluxStuff/!FluxIQ/.git/" });
  assert.equal(await coreKind("C:/FluxStuff/!FluxIQ", { git }), "own");
});

test("git failing to run is an error, not an answer", async () => {
  const git = async () => { throw new Error("spawn git ENOENT", { cause: { code: "ENOENT" } }); };
  await assert.rejects(coreKind("C:/core", { git }), /ENOENT/u);
});
