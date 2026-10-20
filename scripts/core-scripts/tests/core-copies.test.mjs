// The task primitives this directory copies from FluxIQ Core (see `index.mjs`
// for why they are copies) must stay byte-for-byte Core's, line endings aside.
// Compared against the Core beside this checkout; a Core that predates them
// has nothing to compare, and the test says so rather than passing silently.

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { coreRootOf, gitAnsweredNo, pathInside, runGit, samePath } from "../index.mjs";

const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPOSITORY_ROOT = path.resolve(HERE, "..", "..");
const COPIES = ["git-answered-no.mjs", "git-command.mjs", "path-identity.mjs", "path-inside.mjs"];

const normalise = (text) => text.replaceAll("\r\n", "\n");

for (const name of COPIES) {
  test(`${name} is Core's scripts/task/${name}, unchanged`, async (t) => {
    const theirs = path.join(coreRootOf(REPOSITORY_ROOT), "scripts", "task", name);
    if (!existsSync(theirs)) {
      t.skip(`the Core beside this checkout has no scripts/task/${name} to compare with`);
      return;
    }
    const [mine, core] = await Promise.all([readFile(path.join(HERE, name), "utf8"), readFile(theirs, "utf8")]);
    assert.equal(normalise(mine), normalise(core), `scripts/core-scripts/${name} has drifted from Core's scripts/task/${name}: change Core's first, then copy it here verbatim.`);
  });
}

test("the copies work without any Core: a git runner that tells an answer from a failure, and path identity", async () => {
  assert.equal(await runGit(REPOSITORY_ROOT, ["rev-parse", "--is-inside-work-tree"]), "true");
  const refusal = await runGit(REPOSITORY_ROOT, ["rev-parse", "--verify", "--quiet", "refs/heads/no-such-branch-t735"]).then(() => null, (error) => error);
  assert.equal(gitAnsweredNo(refusal), true);
  assert.equal(gitAnsweredNo(new Error("spawn git ENOENT", { cause: { code: "ENOENT" } })), false);
  assert.equal(samePath(path.join(REPOSITORY_ROOT, "scripts"), `${REPOSITORY_ROOT}${path.sep}scripts${path.sep}`), true);
  assert.equal(pathInside(REPOSITORY_ROOT, path.join(REPOSITORY_ROOT, "scripts", "task")), true);
  assert.equal(pathInside(path.join(REPOSITORY_ROOT, "scripts"), `${path.join(REPOSITORY_ROOT, "scripts")}-old`), false);
});
