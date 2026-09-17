import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { writeMarker } from "../markers.mjs";
import { readSideState } from "../side-state.mjs";

// A throwaway repository, with this machine's git configuration kept out so
// the fixture neither depends on it nor is affected by it.
async function withRepository(body) {
  const root = await mkdtemp(path.join(tmpdir(), "lab-pair-side-"));
  const saved = { ...process.env };
  Object.assign(process.env, {
    GIT_CONFIG_GLOBAL: path.join(root, "gitconfig"), GIT_CONFIG_NOSYSTEM: "1",
    GIT_AUTHOR_NAME: "fixture", GIT_AUTHOR_EMAIL: "fixture@example.invalid",
    GIT_COMMITTER_NAME: "fixture", GIT_COMMITTER_EMAIL: "fixture@example.invalid",
  });
  const repo = path.join(root, "repo");
  const git = (...args) => execFileSync("git", ["-C", repo, ...args], { encoding: "utf8", windowsHide: true }).trim();
  try {
    await writeFile(process.env.GIT_CONFIG_GLOBAL, "");
    await mkdir(repo);
    git("init", "--quiet", "--initial-branch", "main");
    await writeFile(path.join(repo, ".gitignore"), "node_modules/\n");
    await writeFile(path.join(repo, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
    git("add", ".");
    git("commit", "--quiet", "-m", "first");
    const first = git("rev-parse", "HEAD");
    await writeFile(path.join(repo, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n# changed\n");
    git("commit", "--quiet", "-am", "second");
    const second = git("rev-parse", "HEAD");
    git("tag", "second-tag");
    git("checkout", "--quiet", "--detach", first);
    await body({ repo, git, first, second });
  } finally {
    for (const name of Object.keys(process.env)) if (!(name in saved)) delete process.env[name];
    Object.assign(process.env, saved);
    await rm(root, { recursive: true, force: true });
  }
}

test("a clean worktree reports its head, the resolved target and the target's lockfile", async () => {
  await withRepository(async ({ repo, git, first, second }) => {
    const state = await readSideState({ side: "core", root: repo, target: "second-tag", buildable: true, distPaths: [path.join(repo, "packages", "x", "dist")] });
    assert.deepEqual(state, {
      side: "core", root: repo, head: first, target: second, dirtyLines: [],
      targetLock: git("rev-parse", `${second}:pnpm-lock.yaml`), installedLock: null,
      buildable: true, builtCommit: null, distPresent: false,
    });
    assert.notEqual(state.targetLock, git("rev-parse", `${first}:pnpm-lock.yaml`));
  });
});

test("no target means the side stays at HEAD; markers and dist are read back", async () => {
  await withRepository(async ({ repo, first }) => {
    await writeMarker(repo, "install", "lock-x");
    await writeMarker(repo, "build", first);
    await mkdir(path.join(repo, "dist"));
    const state = await readSideState({ side: "core", root: repo, target: null, buildable: true, distPaths: [path.join(repo, "dist")] });
    assert.equal(state.target, first);
    assert.equal(state.installedLock, "lock-x");
    assert.equal(state.builtCommit, first);
    assert.equal(state.distPresent, true);
    const ext = await readSideState({ side: "ext", root: repo, target: null, buildable: false, distPaths: [] });
    assert.equal(ext.builtCommit, null);
    assert.deepEqual(ext.dirtyLines, []);
  });
});

test("modified and untracked files are reported; ignored ones are not", async () => {
  await withRepository(async ({ repo }) => {
    await writeFile(path.join(repo, "pnpm-lock.yaml"), "edited\n");
    await writeFile(path.join(repo, "stray.txt"), "x\n");
    await mkdir(path.join(repo, "node_modules"), { recursive: true });
    await writeFile(path.join(repo, "node_modules", "ignored.txt"), "x\n");
    const state = await readSideState({ side: "ext", root: repo, target: null, buildable: false, distPaths: [] });
    assert.deepEqual(state.dirtyLines, [" M pnpm-lock.yaml", "?? stray.txt"]);
  });
});

test("a revision that names no commit, or a directory below the checkout top, is refused", async () => {
  await withRepository(async ({ repo }) => {
    await assert.rejects(readSideState({ side: "ext", root: repo, target: "no-such-branch", buildable: false, distPaths: [] }), /ext revision "no-such-branch" does not name a commit/u);
    await mkdir(path.join(repo, "sub"));
    await assert.rejects(readSideState({ side: "core", root: path.join(repo, "sub"), target: null, buildable: true, distPaths: [] }), /is not the top of a git checkout/u);
  });
});
