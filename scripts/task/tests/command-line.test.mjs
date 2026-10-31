// What `pnpm task` prints is read by agents running other lanes at the same
// time, so its result objects, id spelling and branch names are a contract.
// These pin them through the dispatcher `run-task.mjs` serialises, against
// throwaway repositories (never this checkout).

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { runTaskCommandLine } from "../command-line.mjs";

const run = promisify(execFile);

async function repository(prefix, { merged = [] } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), prefix));
  const git = (...args) => run("git", ["-C", root, ...args]);
  await git("init", "--initial-branch=dev", "--quiet");
  await git("config", "user.email", "test@example.com");
  await git("config", "user.name", "Test");
  await writeFile(path.join(root, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
  await git("add", ".");
  await git("commit", "--quiet", "--no-gpg-sign", "-m", "seed");
  for (const id of merged) await git("commit", "--quiet", "--no-gpg-sign", "--allow-empty", "-m", `Merge task ${id}: something`);
  return root;
}

const git = async (root, ...args) => (await run("git", ["-C", root, ...args])).stdout.trim();
const removeAll = (...roots) => Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
const command = (repositoryRoot, argv, coreRepositoryRoot) => runTaskCommandLine({ argv, repositoryRoot, coreRepositoryRoot });

test("start --dry-run reports the id and branch it would use, and creates nothing", async (t) => {
  const root = await repository("task-cli-", { merged: ["t041"] });
  t.after(() => removeAll(root));

  const result = await command(root, ["start", "flow-editor-cleanup", "--dry-run"]);

  assert.deepEqual(result, {
    command: "start", id: "t042", branch: "task/t042-flow-editor-cleanup", from: "dev",
    worktree: null, core: null, coreBranch: null, sharedCore: null, workspaceBuild: "not-required", applied: false
  });
  assert.equal(await git(root, "branch", "--list", "task/*"), "");
});

test("start opens the branch here and reports it; list then shows it", async (t) => {
  const root = await repository("task-cli-");
  t.after(() => removeAll(root));

  const started = await command(root, ["start", "first"]);
  assert.deepEqual(started, { command: "start", id: "t001", branch: "task/t001-first", from: "dev", worktree: null, core: null, coreBranch: null, workspaceBuild: "not-required", applied: true });
  assert.equal(await git(root, "rev-parse", "--abbrev-ref", "HEAD"), "task/t001-first");

  await git(root, "commit", "--quiet", "--no-gpg-sign", "--allow-empty", "-m", "work\n\nTask: t001");
  const listed = await command(root, ["list"]);
  assert.deepEqual(listed, { command: "list", tasks: [{ id: "t001", slug: "first", branch: "task/t001-first", worktree: null, ahead: 1, behind: 0 }] });
});

test("a paired start --dry-run names the nested worktree, Core and one branch name for both sides", async (t) => {
  const here = await repository("task-cli-here-", { merged: ["t121"] });
  const core = await repository("task-cli-core-", { merged: ["t122", "t123"] });
  const base = await mkdtemp(path.join(os.tmpdir(), "task-cli-base-"));
  t.after(() => removeAll(here, core, base));

  const result = await command(here, ["start", "paired-work", "--worktree", "--core", "--base", base, "--dry-run"], core);

  assert.deepEqual(result, {
    command: "start", id: "t124", branch: "task/t124-paired-work", from: "dev",
    worktree: path.join(base, "t124", path.basename(here)), core: path.join(base, "t124", "!FluxIQ"),
    coreBranch: "task/t124-paired-work", sharedCore: null, workspaceBuild: "planned", applied: false
  });
});

test("a slug that cannot be a ref is refused before anything is allocated", async (t) => {
  const root = await repository("task-cli-");
  t.after(() => removeAll(root));

  await assert.rejects(command(root, ["start", "Not_A_Slug"]), /not a usable task slug/u);
  assert.equal(await git(root, "for-each-ref", "refs/fluxiq/task-ids/"), "");
});

test("abandon --dry-run then abandon report the task, and the id stays spent", async (t) => {
  const root = await repository("task-cli-");
  t.after(() => removeAll(root));
  await command(root, ["start", "first"]);

  const planned = await command(root, ["abandon", "t001", "--dry-run"]);
  assert.equal(planned.command, "abandon");
  assert.equal(planned.applied, false);
  const abandoned = await command(root, ["abandon", "t001"]);
  assert.equal(abandoned.applied, true);
  assert.equal(await git(root, "branch", "--list", "task/*"), "");

  const next = await command(root, ["start", "second", "--dry-run"]);
  assert.equal(next.id, "t002");
});


test("start forwards workspace-build skipping and reports its dry-run plan", async (t) => {
  const root = await repository("task-cli-");
  const base = await mkdtemp(path.join(os.tmpdir(), "task-cli-base-"));
  t.after(() => removeAll(root, base));
  const planned = await command(root, ["start", "narrow", "--worktree", "--base", base, "--skip-workspace-build", "--dry-run"]);
  assert.equal(planned.workspaceBuild, "skipped");
  assert.equal(planned.applied, false);
  assert.equal(await git(root, "branch", "--list", "task/*"), "");
});
