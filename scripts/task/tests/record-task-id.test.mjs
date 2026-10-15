import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { abandonTask } from "../abandon.mjs";
import { recordTaskId } from "../record-task-id.mjs";
import { startTask } from "../start.mjs";
import { nextTaskId } from "../task-id.mjs";

const run = promisify(execFile);

// A throwaway repository on `dev` with one seed commit. The lockfile is there
// because a branch-only start reads which lockfile its start point holds.
async function repository(prefix) {
  const root = await mkdtemp(path.join(os.tmpdir(), prefix));
  const git = (...args) => run("git", ["-C", root, ...args]);
  await git("init", "--initial-branch=dev", "--quiet");
  await git("config", "user.email", "test@example.com");
  await git("config", "user.name", "Test");
  await writeFile(path.join(root, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
  await git("add", ".");
  await git("commit", "--quiet", "--no-gpg-sign", "-m", "seed");
  return root;
}

const refAt = async (root, id) => (await run("git", ["-C", root, "rev-parse", "--verify", `refs/fluxiq/task-ids/${id}`])).stdout.trim();
const head = async (root, rev = "dev") => (await run("git", ["-C", root, "rev-parse", "--verify", rev])).stdout.trim();

test("starting a task records its id as a ref at the commit it started from", async (t) => {
  const root = await repository("record-id-");
  t.after(() => rm(root, { recursive: true, force: true }));

  const started = await startTask({ repositoryRoot: root, slug: "first" });

  assert.equal(started.id, "t001");
  assert.equal(await refAt(root, "t001"), await head(root));
});

test("a dry run allocates but records nothing", async (t) => {
  const root = await repository("record-id-");
  t.after(() => rm(root, { recursive: true, force: true }));

  const planned = await startTask({ repositoryRoot: root, slug: "first", dryRun: true });

  assert.equal(planned.id, "t001");
  await assert.rejects(refAt(root, "t001"));
});

// The defect: t616 was abandoned at 19:10 on 2026-10-14 and its number handed
// to the next start seconds later.
test("start, abandon, start again: the second task gets a new id", async (t) => {
  const root = await repository("record-id-");
  t.after(() => rm(root, { recursive: true, force: true }));

  const first = await startTask({ repositoryRoot: root, slug: "first" });
  const abandoned = await abandonTask({ repositoryRoot: root, id: first.id });
  assert.equal(abandoned.applied, true);
  const second = await startTask({ repositoryRoot: root, slug: "second" });

  assert.equal(first.id, "t001");
  assert.equal(second.id, "t002");
  assert.equal(await refAt(root, "t001"), await head(root), "abandon leaves the ref in place");
});

// A paired start records the id on both sides (start.mjs) and a paired abandon
// deletes both branches (abandon.mjs). A real paired start provisions worktrees
// and runs pnpm install and build, so this drives the same recording and the
// same branch deletion directly against two throwaway repositories.
test("a paired id recorded on both sides stays spent after both branches are deleted", async (t) => {
  const here = await repository("record-id-here-");
  const core = await repository("record-id-core-");
  t.after(() => Promise.all([rm(here, { recursive: true, force: true }), rm(core, { recursive: true, force: true })]));

  const id = await nextTaskId(here, { coreRepositoryRoot: core });
  await recordTaskId(here, id, "dev");
  await recordTaskId(core, id, "dev");
  for (const root of [here, core]) {
    await run("git", ["-C", root, "branch", `task/${id}-paired`, "dev"]);
    await run("git", ["-C", root, "branch", "-D", `task/${id}-paired`]);
  }

  assert.equal(id, "t001");
  assert.equal(await nextTaskId(here, { coreRepositoryRoot: core }), "t002");
  assert.equal(await refAt(core, id), await head(core));
});

test("a Core-only ref still blocks a paired allocation here", async (t) => {
  const here = await repository("record-id-here-");
  const core = await repository("record-id-core-");
  t.after(() => Promise.all([rm(here, { recursive: true, force: true }), rm(core, { recursive: true, force: true })]));

  await recordTaskId(core, "t007", "dev");

  assert.equal(await nextTaskId(here, { coreRepositoryRoot: core }), "t008");
});

test("recording an id twice is refused, so two racing starts cannot share one", async (t) => {
  const root = await repository("record-id-");
  t.after(() => rm(root, { recursive: true, force: true }));

  await recordTaskId(root, "t005", "dev");
  await assert.rejects(recordTaskId(root, "t005", "dev"), /claimed .* by another start at the same moment/u);
});
