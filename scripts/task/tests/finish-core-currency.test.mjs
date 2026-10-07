import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { finishTask } from "../finish.mjs";
import { withRepository } from "../../worktree/tests/repository-fixture.mjs";

// finish must refuse before any gate runs when the Core the task tree builds
// against does not contain Core's integration branch: on 2026-10-07 a shared
// Core behind Core's dev made the extension suite report false failures, and a
// stale Core can as easily give a false pass. The fixture's integration branch
// is `main` on both sides.
const BRANCH = "task/t042-gateway-contract";

/** A flat task worktree at `<trees>/t042-x`, whose Core sibling is `<trees>/!FluxIQ`. */
function openTask({ trees, git }) {
  const extRoot = path.join(trees, "t042-x");
  git("worktree", "add", "--quiet", "-b", BRANCH, extRoot, "main");
  return extRoot;
}

async function advanceCoreMain({ core, coreGit }) {
  await writeFile(path.join(core, "newer.txt"), "Core moved on\n");
  coreGit("add", ".");
  coreGit("commit", "--quiet", "-m", "Core dev moves on");
  return coreGit("rev-parse", "main");
}

const finish = (fixture, extra = {}) => finishTask({ repositoryRoot: fixture.ext, coreRepositoryRoot: fixture.core, id: "t042", integrationBranch: "main", coreIntegrationBranch: "main", ...extra });

test("a stale shared Core is refused at finish, naming both commits and pnpm task sync-core, and nothing is merged", async () => {
  await withRepository(async (fixture) => {
    const { trees, git, coreGit } = fixture;
    openTask(fixture);
    const coreRoot = path.join(trees, "!FluxIQ");
    coreGit("worktree", "add", "--quiet", "--detach", coreRoot, "main");
    const stale = coreGit("rev-parse", "main");
    const current = await advanceCoreMain(fixture);
    const mainBefore = git("rev-parse", "main");

    await assert.rejects(finish(fixture, { skipChecks: true }), (error) => {
      assert.match(error.message, /1 commit\(s\) behind Core's main/u);
      assert.ok(error.message.includes(stale.slice(0, 8)), "names the stale Core commit");
      assert.ok(error.message.includes(current.slice(0, 8)), "names Core's integration commit");
      assert.match(error.message, /pnpm task sync-core/u);
      return true;
    });
    assert.equal(git("rev-parse", "main"), mainBefore, "the integration branch did not move");
    assert.match(git("branch", "--list", BRANCH), /t042/u, "the task branch still exists");
    assert.equal(coreGit("-C", coreRoot, "rev-parse", "HEAD"), stale, "nothing was checked out in Core");
  });
});

test("a dry run reports the same refusal", async () => {
  await withRepository(async (fixture) => {
    openTask(fixture);
    fixture.coreGit("worktree", "add", "--quiet", "--detach", path.join(fixture.trees, "!FluxIQ"), "main");
    await advanceCoreMain(fixture);

    await assert.rejects(finish(fixture, { dryRun: true }), /behind Core's main.*pnpm task sync-core/su);
  });
});

test("a Core-paired task whose own Core branch is behind Core's integration branch is refused, naming the merge that fixes it", async () => {
  await withRepository(async (fixture) => {
    openTask(fixture);
    const coreRoot = path.join(fixture.trees, "!FluxIQ");
    fixture.coreGit("worktree", "add", "--quiet", "-b", BRANCH, coreRoot, "main");
    await advanceCoreMain(fixture);

    await assert.rejects(finish(fixture, { dryRun: true }), (error) => {
      assert.match(error.message, new RegExp(`on "${BRANCH}"`, "u"));
      assert.ok(error.message.includes(`git -C "${coreRoot}" merge main`), error.message);
      return true;
    });
  });
});

test("a current shared Core passes, and the dry run says which Core it checked", async () => {
  await withRepository(async (fixture) => {
    openTask(fixture);
    const coreRoot = path.join(fixture.trees, "!FluxIQ");
    fixture.coreGit("worktree", "add", "--quiet", "--detach", coreRoot, "main");

    const result = await finish(fixture, { dryRun: true });

    assert.equal(result.applied, false);
    assert.equal(result.coreChecked.root, coreRoot);
    assert.equal(result.coreChecked.head, result.coreChecked.target);
  });
});

test("a Core-paired branch that contains Core's integration branch and is ahead of it passes", async () => {
  await withRepository(async (fixture) => {
    openTask(fixture);
    const coreRoot = path.join(fixture.trees, "!FluxIQ");
    fixture.coreGit("worktree", "add", "--quiet", "-b", BRANCH, coreRoot, "main");
    await writeFile(path.join(coreRoot, "work.txt"), "core side\n");
    fixture.coreGit("-C", coreRoot, "add", ".");
    fixture.coreGit("-C", coreRoot, "commit", "--quiet", "-m", "core side of the task");

    const result = await finish(fixture, { dryRun: true });

    assert.equal(result.applied, false);
    assert.equal(result.core.branch, BRANCH);
    assert.equal(result.coreChecked.root, coreRoot);
  });
});

test("no Core beside the task tree is not a refusal, so the command works on a machine without one", async () => {
  await withRepository(async (fixture) => {
    openTask(fixture);

    const result = await finish(fixture, { dryRun: true });

    assert.equal(result.coreChecked, null);
  });
});
