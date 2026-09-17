import assert from "node:assert/strict";
import { mkdir, stat, symlink } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { createWorktree } from "../create.mjs";
import { withRepository } from "./repository-fixture.mjs";

const quiet = () => {};
const DIRECTORY_LINK = process.platform === "win32" ? "junction" : "dir";

// What pnpm's install leaves behind, and nothing else: the extension side's
// `domain/node_modules/fluxiq` pointing at a package directory.
function installer(calls, linkTo = null) {
  return async (root, env, note, side) => {
    calls.push({ side, root });
    if (side !== "ext") return;
    const target = linkTo ?? path.join(path.dirname(root), "!FluxIQ", "packages", "fluxiq");
    await mkdir(path.join(root, "domain", "node_modules"), { recursive: true });
    await mkdir(target, { recursive: true });
    await symlink(target, path.join(root, "domain", "node_modules", "fluxiq"), DIRECTORY_LINK);
  };
}

async function present(target) {
  try {
    await stat(target);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

const base = (ext, core, trees, extra = {}) => ({
  repositoryRoot: ext, coreRepositoryRoot: core, branch: "task-a",
  root: path.join(trees, "task-a"), startPoint: "HEAD", note: quiet, ...extra,
});

test("a worktree is created on its branch, with a detached Core beside it, Core installed first", async () => {
  await withRepository(async ({ ext, core, trees, git, coreGit }) => {
    const calls = [];
    const result = await createWorktree(base(ext, core, trees, { runInstall: installer(calls) }));
    assert.deepEqual(calls.map((call) => call.side), ["core", "ext"]);
    assert.equal(path.resolve(calls[0].root), path.resolve(path.join(trees, "!FluxIQ")));
    assert.equal(result.coreCreated, true);
    assert.equal(path.resolve(result.coreRoot), path.resolve(path.join(trees, "!FluxIQ")));
    assert.match(git("worktree", "list"), /task-a/u);
    assert.equal(git("-C", result.root, "rev-parse", "--abbrev-ref", "HEAD"), "task-a");
    assert.equal(coreGit("-C", result.coreRoot, "rev-parse", "--abbrev-ref", "HEAD"), "HEAD");
    assert.equal(path.resolve(result.linkTarget), path.resolve(path.join(trees, "!FluxIQ", "packages", "fluxiq")));
  });
});

test("a Core sibling that is already there is used rather than added again", async () => {
  await withRepository(async ({ ext, core, trees, coreGit }) => {
    coreGit("worktree", "add", "--quiet", "--detach", path.join(trees, "!FluxIQ"), "HEAD");
    const result = await createWorktree(base(ext, core, trees, { runInstall: installer([]) }));
    assert.equal(result.coreCreated, false);
    assert.equal(path.resolve(result.coreRoot), path.resolve(path.join(trees, "!FluxIQ")));
  });
});

test("a link that lands outside the Core sibling is refused, whatever the install reported", async () => {
  await withRepository(async ({ ext, core, trees, root: fixtureRoot }) => {
    const elsewhere = path.join(fixtureRoot, "other-core", "packages", "fluxiq");
    await assert.rejects(
      createWorktree(base(ext, core, trees, { runInstall: installer([], elsewhere) })),
      /resolves to .*, not into this worktree's Core /u,
    );
  });
});

test("a path that is already occupied is refused before anything is created", async () => {
  await withRepository(async ({ ext, core, trees, git }) => {
    await mkdir(path.join(trees, "task-a"));
    await assert.rejects(createWorktree(base(ext, core, trees, { runInstall: installer([]) })), /something is there already/u);
    assert.doesNotMatch(git("worktree", "list"), /task-a/u);
  });
});

test("a branch that already exists is refused before anything is created", async () => {
  await withRepository(async ({ ext, core, trees, git }) => {
    git("branch", "task-a");
    await assert.rejects(createWorktree(base(ext, core, trees, { runInstall: installer([]) })), /the branch "task-a" already exists/u);
    assert.equal(await present(path.join(trees, "task-a")), false);
  });
});

test("a start point that names no commit is refused before anything is created", async () => {
  await withRepository(async ({ ext, core, trees, git }) => {
    await assert.rejects(
      createWorktree(base(ext, core, trees, { startPoint: "no-such-ref", runInstall: installer([]) })),
      /"no-such-ref" does not name a commit/u,
    );
    assert.equal(await present(path.join(trees, "task-a")), false);
    assert.doesNotMatch(git("branch", "--list"), /task-a/u);
  });
});

test("a Core that is not a git checkout is refused before anything is created", async () => {
  await withRepository(async ({ ext, trees, root: fixtureRoot }) => {
    const notCore = path.join(fixtureRoot, "not-core");
    await mkdir(notCore);
    await assert.rejects(
      createWorktree(base(ext, notCore, trees, { runInstall: installer([]) })),
      /its Core .* is not the top of a git checkout/u,
    );
    assert.equal(await present(path.join(trees, "task-a")), false);
  });
});

test("a Core-paired task gets a Core branch of its own, not the detached shared Core", async () => {
  // The detached default is right for a task that only builds against Core.
  // A task that CHANGES Core needs a branch there, or its Core side has no
  // merge boundary, no revert, and no way to carry the task id.
  await withRepository(async ({ ext, core, trees, coreGit }) => {
    const calls = [];
    const created = await createWorktree(base(ext, core, trees, {
      coreBranch: "task-a", coreStartPoint: "main", runInstall: installer(calls)
    }));

    assert.equal(created.coreBranch, "task-a");
    assert.equal(coreGit("-C", created.coreRoot, "rev-parse", "--abbrev-ref", "HEAD"), "task-a");
    assert.match(coreGit("branch", "--list", "task-a"), /task-a/u);
  });
});

test("without a Core branch the sibling stays detached, so tasks can share one Core", async () => {
  await withRepository(async ({ ext, core, trees, coreGit }) => {
    const created = await createWorktree(base(ext, core, trees, { runInstall: installer([]) }));

    assert.equal(created.coreBranch, null);
    assert.equal(coreGit("-C", created.coreRoot, "rev-parse", "--abbrev-ref", "HEAD"), "HEAD");
  });
});

test("a Core branch that already exists refuses the whole pair, leaving nothing behind", async () => {
  // Decided before `git worktree add`, because a Core branch clash discovered
  // afterwards would leave this repository's worktree and branch already made.
  await withRepository(async ({ ext, core, trees, git, coreGit }) => {
    coreGit("branch", "task-a", "main");

    await assert.rejects(
      createWorktree(base(ext, core, trees, { coreBranch: "task-a", coreStartPoint: "main", runInstall: installer([]) })),
      /already exists in Core/u
    );

    assert.equal(await present(path.join(trees, "task-a")), false);
    assert.equal(git("branch", "--list", "task-a"), "");
  });
});
