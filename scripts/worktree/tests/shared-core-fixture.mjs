// A shared Core beside a task worktree, one commit behind its repository's
// `main`, inside the throwaway repositories of `repository-fixture.mjs`.
//
// The Core gains what a real Core has and the plain fixture lacks: a committed
// `pnpm-lock.yaml`, which is how an install is decided, and ignore rules for
// `dist/` and `node_modules/`, where builds and markers go without making the
// Core look edited.

import { writeFile } from "node:fs/promises";
import path from "node:path";
import { withRepository } from "./repository-fixture.mjs";

/** @param {(fixture: { root: string, ext: string, core: string, trees: string, coreRoot: string, sharer: string, git: Function, coreGit: Function }) => Promise<void>} body */
export function withSharedCore(body) {
  return withRepository(async (fixture) => {
    const { ext, core, trees, git, coreGit } = fixture;
    await writeFile(path.join(core, ".gitignore"), "node_modules/\ndist/\n");
    await writeFile(path.join(core, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
    coreGit("add", ".");
    coreGit("commit", "--quiet", "-m", "lockfile");
    const coreRoot = path.join(trees, "!FluxIQ");
    coreGit("worktree", "add", "--quiet", "--detach", coreRoot, "HEAD");
    coreGit("commit", "--quiet", "--allow-empty", "-m", "moved on");
    const sharer = path.join(trees, "task-a");
    git("worktree", "add", "--quiet", "-b", "task-a", sharer, "HEAD");
    await body({ ...fixture, ext, coreRoot, sharer });
  });
}
