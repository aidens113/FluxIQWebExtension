// A throwaway pair of git repositories to exercise worktree operations
// against, with this machine's git configuration kept out so a fixture
// neither depends on it nor is affected by it.
//
// The "ext" repository carries the one file every operation here reads out of
// a worktree: `domain/package.json`, whose `link:` decides where that
// worktree's Core sibling is. Worktrees are added under `<root>/trees/`, so a
// worktree's sibling resolves to `<root>/trees/!FluxIQ` -- which is where a
// worktree of the "core" repository goes, and where a test that wants the
// wrong Core puts something else instead.

import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const MANIFEST = JSON.stringify({ name: "@fixture/domain", dependencies: { fluxiq: "link:../../!FluxIQ/packages/fluxiq" } }, null, 2);

/** @param {(fixture: { root: string, ext: string, core: string, trees: string, git: Function, coreGit: Function }) => Promise<void>} body */
export async function withRepository(body) {
  const root = await mkdtemp(path.join(tmpdir(), "worktree-fixture-"));
  const saved = { ...process.env };
  Object.assign(process.env, {
    GIT_CONFIG_GLOBAL: path.join(root, "gitconfig"), GIT_CONFIG_NOSYSTEM: "1",
    GIT_AUTHOR_NAME: "fixture", GIT_AUTHOR_EMAIL: "fixture@example.invalid",
    GIT_COMMITTER_NAME: "fixture", GIT_COMMITTER_EMAIL: "fixture@example.invalid",
  });
  const ext = path.join(root, "repo");
  const core = path.join(root, "core");
  const trees = path.join(root, "trees");
  const runner = (where) => (...args) => execFileSync("git", ["-C", where, ...args], { encoding: "utf8", windowsHide: true }).trim();
  const git = runner(ext);
  const coreGit = runner(core);
  try {
    await writeFile(process.env.GIT_CONFIG_GLOBAL, "");
    await mkdir(path.join(ext, "domain"), { recursive: true });
    await mkdir(path.join(core, "packages", "fluxiq"), { recursive: true });
    await mkdir(trees);
    await writeFile(path.join(ext, ".gitignore"), "node_modules/\n");
    await writeFile(path.join(ext, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
    await writeFile(path.join(ext, "domain", "package.json"), `${MANIFEST}\n`);
    git("init", "--quiet", "--initial-branch", "main");
    git("add", ".");
    git("commit", "--quiet", "-m", "first");
    await writeFile(path.join(core, "packages", "fluxiq", "package.json"), `${JSON.stringify({ name: "fluxiq", version: "0.0.0" })}\n`);
    coreGit("init", "--quiet", "--initial-branch", "main");
    coreGit("add", ".");
    coreGit("commit", "--quiet", "-m", "first");
    await body({ root, ext, core, trees, git, coreGit });
  } finally {
    for (const name of Object.keys(process.env)) if (!(name in saved)) delete process.env[name];
    Object.assign(process.env, saved);
    await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}
