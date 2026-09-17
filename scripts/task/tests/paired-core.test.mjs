import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { pairedCore } from "../paired-core.mjs";
import { withRepository } from "../../worktree/tests/repository-fixture.mjs";

// The fixture's integration branch is `main`; the repository's is `dev`. What
// matters here is the pairing, not the name, so the name is passed in.
const BRANCH = "task/t042-gateway-contract";

/** A task worktree at `<trees>/t042-x`, whose Core sibling is `<trees>/!FluxIQ`. */
function open({ trees, git }) {
  const extRoot = path.join(trees, "t042-x");
  git("worktree", "add", "--quiet", "-b", BRANCH, extRoot, "main");
  return extRoot;
}

test("a Core worktree on the task's own branch is the task's Core side", async () => {
  await withRepository(async ({ ext, core, trees, git, coreGit }) => {
    const extWorktreeRoot = open({ trees, git });
    coreGit("worktree", "add", "--quiet", "-b", BRANCH, path.join(trees, "!FluxIQ"), "main");

    const found = await pairedCore({ coreRepositoryRoot: core, extWorktreeRoot, branch: BRANCH, integrationBranch: "main" });

    assert.equal(found.branch, BRANCH);
    assert.equal(found.root, path.join(trees, "!FluxIQ"));
    assert.equal(found.unmerged, 0);
    assert.ok(ext);
  });
});

test("a detached Core sibling is not the task's Core side, because every task beside it shares it", async () => {
  // This is the distinction the module exists for. Treating the shared Core as
  // paired would delete a branch -- or a checkout -- in another repository on
  // behalf of a task that never touched Core.
  await withRepository(async ({ core, trees, git, coreGit }) => {
    const extWorktreeRoot = open({ trees, git });
    coreGit("worktree", "add", "--quiet", "--detach", path.join(trees, "!FluxIQ"), "main");

    assert.equal(await pairedCore({ coreRepositoryRoot: core, extWorktreeRoot, branch: BRANCH, integrationBranch: "main" }), null);
  });
});

test("a Core sibling on somebody else's branch is not the task's Core side either", async () => {
  await withRepository(async ({ core, trees, git, coreGit }) => {
    const extWorktreeRoot = open({ trees, git });
    coreGit("worktree", "add", "--quiet", "-b", "task/t099-unrelated", path.join(trees, "!FluxIQ"), "main");

    assert.equal(await pairedCore({ coreRepositoryRoot: core, extWorktreeRoot, branch: BRANCH, integrationBranch: "main" }), null);
  });
});

test("no Core beside the worktree at all is reported as unpaired, never as an error", async () => {
  // A task whose Core sibling was already reclaimed must still be abandonable
  // on this side; refusing the whole command over a missing directory would
  // make the safety valve the thing that jams.
  await withRepository(async ({ core, trees, git }) => {
    const extWorktreeRoot = open({ trees, git });

    assert.equal(await pairedCore({ coreRepositoryRoot: core, extWorktreeRoot, branch: BRANCH, integrationBranch: "main" }), null);
  });
});

test("commits that never reached the integration branch are counted, so abandoning can refuse", async () => {
  await withRepository(async ({ core, trees, git, coreGit }) => {
    const extWorktreeRoot = open({ trees, git });
    const coreRoot = path.join(trees, "!FluxIQ");
    coreGit("worktree", "add", "--quiet", "-b", BRANCH, coreRoot, "main");
    await writeFile(path.join(coreRoot, "work.txt"), "core side\n");
    coreGit("-C", coreRoot, "add", ".");
    coreGit("-C", coreRoot, "commit", "--quiet", "-m", "core side of the task");

    const found = await pairedCore({ coreRepositoryRoot: core, extWorktreeRoot, branch: BRANCH, integrationBranch: "main" });

    assert.equal(found.unmerged, 1);
  });
});

test("no Core checkout named at all is unpaired, so the command works on a machine without one", async () => {
  await withRepository(async ({ trees, git }) => {
    const extWorktreeRoot = open({ trees, git });

    assert.equal(await pairedCore({ coreRepositoryRoot: undefined, extWorktreeRoot, branch: BRANCH }), null);
  });
});
