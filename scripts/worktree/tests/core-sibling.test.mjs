import assert from "node:assert/strict";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { resolveCoreSibling } from "../core-sibling.mjs";
import { withRepository } from "./repository-fixture.mjs";

async function manifestIn(root, spec) {
  await mkdir(path.join(root, "domain"), { recursive: true });
  const dependencies = spec === null ? {} : { fluxiq: spec };
  await writeFile(path.join(root, "domain", "package.json"), `${JSON.stringify({ name: "@fixture/domain", dependencies })}\n`);
}

test("a worktree without a readable domain manifest is not a checkout of this repository", async () => {
  await withRepository(async ({ trees }) => {
    await assert.rejects(resolveCoreSibling(path.join(trees, "nothing-here")), /is not a checkout of this repository/u);
  });
});

test("a fluxiq dependency that is not a link:, or links somewhere else, is refused by name", async () => {
  await withRepository(async ({ trees }) => {
    const root = path.join(trees, "w");
    await manifestIn(root, "^1.2.3");
    await assert.rejects(resolveCoreSibling(root), /does not depend on fluxiq through link: \(found "\^1\.2\.3"\)/u);
    await manifestIn(root, null);
    await assert.rejects(resolveCoreSibling(root), /does not depend on fluxiq through link: \(found null\)/u);
    await manifestIn(root, "link:../../!FluxIQ/packages/other");
    await assert.rejects(resolveCoreSibling(root), /which is not <core>\/packages\/fluxiq/u);
  });
});

test("the sibling is the directory beside the worktree the link lands in, reported absent when it is not there", async () => {
  await withRepository(async ({ trees, git }) => {
    const root = path.join(trees, "task-a");
    git("worktree", "add", "--quiet", "-b", "task-a", root, "HEAD");
    const found = await resolveCoreSibling(root);
    assert.equal(path.resolve(found.root), path.resolve(path.join(trees, "!FluxIQ")));
    assert.deepEqual({ present: found.present, verified: found.verified }, { present: false, verified: false });
  });
});

test("a sibling that is a worktree of the expected Core is verified", async () => {
  await withRepository(async ({ trees, git, coreGit, core }) => {
    const root = path.join(trees, "task-a");
    git("worktree", "add", "--quiet", "-b", "task-a", root, "HEAD");
    coreGit("worktree", "add", "--quiet", "--detach", path.join(trees, "!FluxIQ"), "HEAD");
    const found = await resolveCoreSibling(root, { coreRepositoryRoot: core });
    assert.deepEqual({ present: found.present, verified: found.verified }, { present: true, verified: true });
  });
});

test("a sibling that is a checkout of some other repository is refused, which lab:pair does not catch", async () => {
  await withRepository(async ({ trees, git, core, ext }) => {
    const root = path.join(trees, "task-a");
    git("worktree", "add", "--quiet", "-b", "task-a", root, "HEAD");
    // The top of a real checkout, so "is this a git checkout?" is not the
    // question that separates it from the Core the caller meant.
    git("worktree", "add", "--quiet", "--detach", path.join(trees, "!FluxIQ"), "HEAD");
    const found = await resolveCoreSibling(root);
    assert.deepEqual({ present: found.present, verified: found.verified }, { present: true, verified: false });
    await assert.rejects(resolveCoreSibling(root, { coreRepositoryRoot: core }), /is a worktree of .*, not of /u);
    await assert.rejects(resolveCoreSibling(root, { coreRepositoryRoot: core }), (error) => error.message.includes(path.resolve(ext).replaceAll("\\", "/")) || error.message.includes(path.resolve(ext)));
  });
});

test("a sibling that is a plain directory is refused, although git answers for the checkout enclosing it", async () => {
  await withRepository(async ({ trees, git, core }) => {
    const root = path.join(trees, "task-a");
    git("worktree", "add", "--quiet", "-b", "task-a", root, "HEAD");
    await mkdir(path.join(trees, "!FluxIQ", "packages"), { recursive: true });
    await assert.rejects(resolveCoreSibling(root, { coreRepositoryRoot: core }), /is not the top of a git checkout/u);
    await rm(path.join(trees, "!FluxIQ"), { recursive: true, force: true });
    assert.equal((await resolveCoreSibling(root, { coreRepositoryRoot: core })).present, false);
  });
});
