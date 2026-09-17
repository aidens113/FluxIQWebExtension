import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { abandonTask } from "../abandon.mjs";
import { withRepository } from "../../worktree/tests/repository-fixture.mjs";

const BRANCH = "task/t042-in-place";

test("a task worked on in place is abandoned while HEAD is standing on its branch", async () => {
  // The cheap tier leaves this checkout ON the task branch, and git refuses to
  // delete the branch HEAD is on -- so abandoning the common case failed at its
  // last step, having already decided everything else was fine. Found by the
  // worker that mirrored this tooling into Core, and reproduced before fixing.
  await withRepository(async ({ ext, git }) => {
    git("checkout", "--quiet", "-b", BRANCH, "main");
    assert.equal(git("rev-parse", "--abbrev-ref", "HEAD"), BRANCH);

    const result = await abandonTask({ repositoryRoot: ext, id: "t042", integrationBranch: "main" });

    assert.equal(result.applied, true);
    assert.equal(git("rev-parse", "--abbrev-ref", "HEAD"), "main");
    assert.equal(git("branch", "--list", BRANCH), "");
  });
});

test("commits that never reached the integration branch are refused, and --force discards them", async () => {
  await withRepository(async ({ ext, git }) => {
    git("checkout", "--quiet", "-b", BRANCH, "main");
    await writeFile(path.join(ext, "work.txt"), "unmerged\n");
    git("add", ".");
    git("commit", "--quiet", "-m", "work nobody else has");

    await assert.rejects(
      abandonTask({ repositoryRoot: ext, id: "t042", integrationBranch: "main" }),
      /1 commit\(s\) that never reached main/u
    );
    assert.match(git("branch", "--list", BRANCH), /t042/u);

    const forced = await abandonTask({ repositoryRoot: ext, id: "t042", integrationBranch: "main", force: true });
    assert.equal(forced.unmerged, 1);
    assert.equal(git("branch", "--list", BRANCH), "");
  });
});

test("a dry run decides everything and deletes nothing", async () => {
  await withRepository(async ({ ext, git }) => {
    git("checkout", "--quiet", "-b", BRANCH, "main");

    const result = await abandonTask({ repositoryRoot: ext, id: "t042", integrationBranch: "main", dryRun: true });

    assert.equal(result.applied, false);
    assert.equal(result.branch, BRANCH);
    assert.equal(git("rev-parse", "--abbrev-ref", "HEAD"), BRANCH);
    assert.match(git("branch", "--list", BRANCH), /t042/u);
  });
});
