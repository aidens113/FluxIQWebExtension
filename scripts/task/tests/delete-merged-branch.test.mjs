import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { deleteMergedBranch } from "../delete-merged-branch.mjs";
import { withRepository } from "../../worktree/tests/repository-fixture.mjs";

const BRANCH = "task/t042-gateway-contract";

test("a pushed branch whose upstream lacks the integration merge is deleted once main contains it", async () => {
  await withRepository(async ({ root, ext, git }) => {
    const remote = path.join(root, "remote.git");
    git("init", "--bare", "--quiet", remote);
    git("remote", "add", "origin", remote);
    git("checkout", "--quiet", "-b", BRANCH);
    await writeFile(path.join(ext, "work.txt"), "work\n");
    git("add", ".");
    git("commit", "--quiet", "-m", "work");
    git("push", "--quiet", "-u", "origin", BRANCH);
    git("checkout", "--quiet", "main");
    await writeFile(path.join(ext, "dev.txt"), "dev\n");
    git("add", ".");
    git("commit", "--quiet", "-m", "main moves");
    git("checkout", "--quiet", BRANCH);
    git("merge", "--quiet", "--no-edit", "main");
    git("checkout", "--quiet", "main");
    git("merge", "--quiet", "--no-ff", "-m", "Merge task", BRANCH);

    await deleteMergedBranch({ repositoryRoot: ext, branch: BRANCH, integrationBranch: "main" });

    assert.equal(git("branch", "--list", BRANCH), "");
  });
});

test("a branch main does not contain is refused and kept", async () => {
  await withRepository(async ({ ext, git }) => {
    git("checkout", "--quiet", "-b", BRANCH);
    await writeFile(path.join(ext, "work.txt"), "work\n");
    git("add", ".");
    git("commit", "--quiet", "-m", "work");
    git("checkout", "--quiet", "main");

    await assert.rejects(deleteMergedBranch({ repositoryRoot: ext, branch: BRANCH, integrationBranch: "main" }), /does not contain all of its commits/u);
    assert.equal(git("branch", "--list", BRANCH).trim(), BRANCH);
  });
});
