import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { removeWorktree } from "../remove.mjs";
import { withRepository } from "./repository-fixture.mjs";

const quiet = () => {};

async function addWorktree(git, trees, name) {
  const root = path.join(trees, name);
  git("worktree", "add", "--quiet", "-b", name, root, "HEAD");
  // What defeats `git worktree remove --force`: an installed worktree.
  await mkdir(path.join(root, "node_modules", "fluxiq"), { recursive: true });
  await writeFile(path.join(root, "node_modules", "fluxiq", "index.js"), "module.exports = {};\n");
  return root;
}

async function missing(target) {
  try {
    await stat(target);
    return false;
  } catch (error) {
    if (error?.code === "ENOENT") return true;
    throw error;
  }
}

test("a clean worktree with node_modules is deleted and pruned from the repository's list", async () => {
  await withRepository(async ({ ext, trees, git }) => {
    const root = await addWorktree(git, trees, "task-a");
    assert.match(git("worktree", "list"), /task-a/u);
    const result = await removeWorktree({ repositoryRoot: ext, root, note: quiet });
    assert.deepEqual({ removed: result.removed, dirtyLines: result.dirtyLines }, { removed: true, dirtyLines: [] });
    assert.equal(await missing(root), true);
    assert.doesNotMatch(git("worktree", "list"), /task-a/u);
  });
});

test("a worktree with uncommitted or untracked work is refused, and is still there afterwards", async () => {
  await withRepository(async ({ ext, trees, git }) => {
    const root = await addWorktree(git, trees, "task-a");
    await writeFile(path.join(root, "pnpm-lock.yaml"), "edited\n");
    await assert.rejects(removeWorktree({ repositoryRoot: ext, root, note: quiet }), /has 1 uncommitted or untracked change\(s\).*pnpm-lock\.yaml/u);
    assert.equal(await missing(root), false);

    git("-C", root, "checkout", "--quiet", "--", "pnpm-lock.yaml");
    await writeFile(path.join(root, "stray.txt"), "x\n");
    await assert.rejects(removeWorktree({ repositoryRoot: ext, root, note: quiet }), /uncommitted or untracked change\(s\).*stray\.txt/u);
    assert.equal(await missing(root), false);
  });
});

test("the main checkout and a worktree of another repository are both refused", async () => {
  await withRepository(async ({ ext, core, trees, git, coreGit }) => {
    await assert.rejects(removeWorktree({ repositoryRoot: ext, root: ext, note: quiet }), /it is the checkout this process runs from/u);
    const other = path.join(trees, "core-tree");
    coreGit("worktree", "add", "--quiet", "--detach", other, "HEAD");
    await assert.rejects(removeWorktree({ repositoryRoot: ext, root: other, note: quiet }), /it is a worktree of .*, not of /u);
    assert.equal(await missing(other), false);
    // The same repository, reached as its main checkout rather than a link.
    await assert.rejects(removeWorktree({ repositoryRoot: core, root: core, note: quiet }), /it is the checkout this process runs from/u);
    await assert.rejects(removeWorktree({ repositoryRoot: path.join(trees, ".."), root: core, note: quiet }), /is not the top of a git checkout/u);
    git("worktree", "add", "--quiet", "-b", "task-b", path.join(trees, "task-b"), "HEAD");
    await assert.rejects(removeWorktree({ repositoryRoot: path.join(trees, "task-b"), root: ext, note: quiet }), /it is the repository's main checkout/u);
  });
});

test("a directory inside a worktree is refused, although git answers for the worktree enclosing it", async () => {
  await withRepository(async ({ ext, trees, git }) => {
    const root = await addWorktree(git, trees, "task-a");
    const inside = path.join(root, "domain");
    await assert.rejects(removeWorktree({ repositoryRoot: ext, root: inside, note: quiet }), /is not the top of a git checkout/u);
    assert.equal(await missing(inside), false);
  });
});

test("a path with nothing at it is refused rather than reported as removed", async () => {
  await withRepository(async ({ ext, trees }) => {
    await assert.rejects(removeWorktree({ repositoryRoot: ext, root: path.join(trees, "never-existed"), note: quiet }), /there is no directory there/u);
  });
});

test("a process running below the root blocks the delete until allowRunning says otherwise", async () => {
  await withRepository(async ({ ext, trees, git }) => {
    const root = await addWorktree(git, trees, "task-a");
    // Its command line names a path below the root, which is how a Lab run, a
    // browser or a build shows up. Nothing is written into the worktree, so
    // the dirty check cannot be what refuses.
    const child = spawn(process.execPath, ["-e", "setTimeout(() => {}, 30000)", path.join(root, "apps", "extension", "marker")], { stdio: "ignore", windowsHide: true });
    try {
      await assert.rejects(removeWorktree({ repositoryRoot: ext, root, note: quiet }), /running process\(es\) are working inside it/u);
      assert.equal(await missing(root), false);
    } finally {
      child.kill();
    }
    const result = await removeWorktree({ repositoryRoot: ext, root, allowRunning: true, note: quiet });
    assert.equal(result.removed, true);
    assert.equal(await missing(root), true);
  });
});
