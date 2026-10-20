import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { abandonTask } from "../abandon.mjs";
import { startTask } from "../start.mjs";

const run = promisify(execFile);

// A throwaway repository on `dev` with one seed commit, plus one merge subject
// per id in `merged`. The lockfile is there because a branch-only start reads
// which lockfile its start point holds.
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

const refAt = async (root, id) => (await run("git", ["-C", root, "rev-parse", "--verify", `refs/fluxiq/task-ids/${id}`])).stdout.trim();
const head = async (root, rev = "dev") => (await run("git", ["-C", root, "rev-parse", "--verify", rev])).stdout.trim();
const removeAll = (...roots) => Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));

test("starting a task records its id as a ref at the commit it started from", async (t) => {
  const root = await repository("start-id-");
  t.after(() => removeAll(root));

  const started = await startTask({ repositoryRoot: root, slug: "first" });

  assert.equal(started.id, "t001");
  assert.equal(await refAt(root, "t001"), await head(root));
});

test("a dry run allocates but records nothing", async (t) => {
  const root = await repository("start-id-");
  t.after(() => removeAll(root));

  const planned = await startTask({ repositoryRoot: root, slug: "first", dryRun: true });

  assert.equal(planned.id, "t001");
  await assert.rejects(refAt(root, "t001"));
});

// The defect: t616 was abandoned at 19:10 on 2026-10-14 and its number handed
// to the next start seconds later.
test("start, abandon, start again: the second task gets a new id", async (t) => {
  const root = await repository("start-id-");
  t.after(() => removeAll(root));

  const first = await startTask({ repositoryRoot: root, slug: "first" });
  const abandoned = await abandonTask({ repositoryRoot: root, id: first.id });
  assert.equal(abandoned.applied, true);
  const second = await startTask({ repositoryRoot: root, slug: "second" });

  assert.equal(first.id, "t001");
  assert.equal(second.id, "t002");
  assert.equal(await refAt(root, "t001"), await head(root), "abandon leaves the ref in place");
});

// A paired start must allocate against Core as well (Core's allocator, handed
// Core as a paired repository): on 2026-09-24 this repository's next free id
// was t122 while Core had already merged its own t122 and t123. A real paired
// start provisions worktrees and runs pnpm, so the dry run proves the choice.
test("a paired start clears ids already spent in Core, and an unpaired one does not read Core", async (t) => {
  const here = await repository("start-id-here-", { merged: ["t121"] });
  const core = await repository("start-id-core-", { merged: ["t122", "t123"] });
  const base = await mkdtemp(path.join(os.tmpdir(), "start-id-base-"));
  t.after(() => removeAll(here, core, base));

  const unpaired = await startTask({ repositoryRoot: here, coreRepositoryRoot: core, slug: "solo", dryRun: true });
  const paired = await startTask({ repositoryRoot: here, coreRepositoryRoot: core, slug: "paired", worktree: true, core: true, base, dryRun: true });

  assert.equal(unpaired.id, "t122");
  assert.equal(paired.id, "t124");
  assert.equal(paired.coreBranch, "task/t124-paired");
});

test("a paired start clears an id recorded only in Core", async (t) => {
  const here = await repository("start-id-here-");
  const core = await repository("start-id-core-");
  const base = await mkdtemp(path.join(os.tmpdir(), "start-id-base-"));
  t.after(() => removeAll(here, core, base));
  await run("git", ["-C", core, "update-ref", "refs/fluxiq/task-ids/t007", "dev"]);

  const paired = await startTask({ repositoryRoot: here, coreRepositoryRoot: core, slug: "paired", worktree: true, core: true, base, dryRun: true });

  assert.equal(paired.id, "t008");
});
