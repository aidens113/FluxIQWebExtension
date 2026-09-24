import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { nextTaskId } from "../task-id.mjs";

const run = promisify(execFile);

// A throwaway repository on `dev`, with one merge subject per id in `merged`
// and one open branch per id in `open`.
async function repository({ merged = [], open = [] } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "task-id-"));
  const git = (...args) => run("git", ["-C", root, ...args]);

  await git("init", "--initial-branch=dev", "--quiet");
  await git("config", "user.email", "test@example.com");
  await git("config", "user.name", "Test");
  await writeFile(path.join(root, "seed"), "seed");
  await git("add", ".");
  await git("commit", "--quiet", "--no-gpg-sign", "-m", "seed");

  for (const id of merged) {
    await git("commit", "--quiet", "--no-gpg-sign", "--allow-empty", "-m", `Merge task ${id}: something`);
  }
  for (const id of open) {
    await git("branch", `task/${id}-something`);
  }
  return root;
}

test("an id clears both open branches and merged history", async (t) => {
  const root = await repository({ merged: ["t003"], open: ["t007"] });
  t.after(() => rm(root, { recursive: true, force: true }));

  assert.equal(await nextTaskId(root), "t008");
});

test("the first id in an empty repository is t001", async (t) => {
  const root = await repository();
  t.after(() => rm(root, { recursive: true, force: true }));

  assert.equal(await nextTaskId(root), "t001");
});

// The defect this guards: the allocator scanned only this repository, so a
// Core-paired task could be handed an id Core had already spent on different
// work, putting two meanings under one `Merge task t122:` in Core's own log.
test("a Core-paired id clears ids already spent in Core", async (t) => {
  const here = await repository({ merged: ["t121"] });
  const core = await repository({ merged: ["t122", "t123"] });
  t.after(() => Promise.all([rm(here, { recursive: true, force: true }), rm(core, { recursive: true, force: true })]));

  assert.equal(await nextTaskId(here), "t122", "unpaired allocation stays local");
  assert.equal(await nextTaskId(here, { coreRepositoryRoot: core }), "t124", "a paired allocation clears Core too");
});

test("a Core-paired id still clears this repository when Core is behind", async (t) => {
  const here = await repository({ merged: ["t050"] });
  const core = await repository({ merged: ["t004"] });
  t.after(() => Promise.all([rm(here, { recursive: true, force: true }), rm(core, { recursive: true, force: true })]));

  assert.equal(await nextTaskId(here, { coreRepositoryRoot: core }), "t051");
});
