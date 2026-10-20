// `pnpm task sync-core` exists to bring an outdated shared Core up to Core's
// `dev`, so it must run against exactly the Core that is too old to provide the
// tooling every other command loads from it (build-cache engine, task rules).
// Since t727 it did not: `run-task.mjs` loaded Core's engine and task rules at
// import time and refused with "that Core predates the shared tooling" before
// the move could begin.
//
// These run the real entry point as a child process from a checkout whose own
// Core sibling is such a Core, because only a fresh process proves that nothing
// on the path imports from that Core before it has been moved: in this test
// process every module is already loaded against this checkout's current Core.
// The checkout is a throwaway worktree holding a copy of this repository's
// task tooling; its Core is a throwaway repository whose target commit carries
// a stand-in for Core's own build CLI, which is all a moved Core's build runs.

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { writeMarker } from "../../worktree/index.mjs";
import { withRepository } from "../../worktree/tests/repository-fixture.mjs";

const run = promisify(execFile);
const SCRIPTS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const TOOLING = ["task", "worktree", "core-scripts", "build-cache", "provider-secret-environment.mjs"];

const LIBRARIES = [
  { name: "@fluxiq/contracts", directory: "packages/contracts" },
  { name: "fluxiq", directory: "packages/fluxiq" },
  { name: "@fluxiq/client-gateway-websocket", directory: "packages/client-gateway-websocket" },
  { name: "@fluxiq/web", directory: "apps/web" },
];

// What the Core of the fixture gains at its target: a workspace whose packages
// build through Core's own build CLI, and the module whose absence is how a
// downstream import recognises a Core that predates the shared tooling.
const CLI = [
  'import { appendFileSync } from "node:fs";',
  'import path from "node:path";',
  'appendFileSync(path.resolve(process.cwd(), "..", "..", "built-steps.txt"), `${process.argv[2]}\\n`);',
  'console.log(JSON.stringify({ "build-cache": "built", step: process.argv[2], reason: "fixture", ms: 0 }));',
].join("\n");

async function addSharedTooling(core) {
  await writeFile(path.join(core, "pnpm-workspace.yaml"), 'packages:\n  - "packages/*"\n  - "apps/*"\n');
  await writeFile(path.join(core, "package.json"), `${JSON.stringify({ name: "core-fixture", private: true })}\n`);
  for (const { name, directory } of LIBRARIES) {
    await mkdir(path.join(core, directory), { recursive: true });
    const scripts = { build: `node ../../scripts/build-cache/cli.mjs ${path.basename(directory)}:build` };
    await writeFile(path.join(core, directory, "package.json"), `${JSON.stringify({ name, version: "0.0.0", scripts })}\n`);
  }
  await mkdir(path.join(core, "scripts", "build-cache"), { recursive: true });
  await writeFile(path.join(core, "scripts", "build-cache", "cli.mjs"), `${CLI}\n`);
  await writeFile(path.join(core, "scripts", "build-cache", "build-cache-for.mjs"), 'export function buildCacheFor() {\n  throw new Error("the move never binds the engine");\n}\n');
}

/** A task worktree with a copy of this repository's task tooling, beside a shared Core that predates it. */
function withOutdatedSharedCore(body) {
  return withRepository(async (fixture) => {
    const { core, trees, git, coreGit } = fixture;
    await writeFile(path.join(core, ".gitignore"), "node_modules/\ndist/\nbuilt-steps.txt\n");
    await writeFile(path.join(core, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
    coreGit("add", ".");
    coreGit("commit", "--quiet", "-m", "lockfile");
    const coreRoot = path.join(trees, "!FluxIQ");
    coreGit("worktree", "add", "--quiet", "--detach", coreRoot, "HEAD");
    // The Core was installed at its own commit; the lockfile does not change,
    // so the move needs a checkout and a build but no install.
    await writeMarker(coreRoot, "install", coreGit("rev-parse", "HEAD:pnpm-lock.yaml"));
    await addSharedTooling(core);
    coreGit("add", ".");
    coreGit("commit", "--quiet", "-m", "shared tooling");

    const checkout = path.join(trees, "t900-fixture");
    git("worktree", "add", "--quiet", "-b", "task/t900-fixture", checkout, "HEAD");
    for (const entry of TOOLING) {
      await cp(path.join(SCRIPTS, entry), path.join(checkout, "scripts", entry), { recursive: true, filter: (source) => path.basename(source) !== "tests" });
    }
    const task = (...argv) => run(process.execPath, [path.join(checkout, "scripts", "task", "run-task.mjs"), ...argv], { env: process.env, windowsHide: true, timeout: 120_000 })
      .then(({ stdout }) => JSON.parse(stdout.trim().split(/\r?\n/u).at(-1)));
    await body({ ...fixture, coreRoot, checkout, task });
  });
}

test("sync-core moves and builds a shared Core that predates the shared tooling, loading nothing from it first", async () => {
  await withOutdatedSharedCore(async ({ coreRoot, coreGit, task }) => {
    const target = coreGit("rev-parse", "main");
    const before = coreGit("-C", coreRoot, "rev-parse", "HEAD");

    const planned = await task("sync-core", "--to", "main", "--allow-running", "--dry-run");
    assert.deepEqual(
      { command: planned.command, from: planned.from, target: planned.target, behind: planned.behind, checkout: planned.checkout, install: planned.install, build: planned.build, applied: planned.applied },
      { command: "sync-core", from: before, target, behind: 1, checkout: true, install: false, build: true, applied: false },
    );
    assert.equal(coreGit("-C", coreRoot, "rev-parse", "HEAD"), before);

    const moved = await task("sync-core", "--to", "main", "--allow-running");
    assert.equal(moved.applied, true);
    assert.equal(coreGit("-C", coreRoot, "rev-parse", "HEAD"), target);
    // Built by the moved Core's own scripts, every package of Core's root build, in order.
    const built = (await readFile(path.join(coreRoot, "built-steps.txt"), "utf8")).trim().split(/\r?\n/u);
    assert.deepEqual(built, ["contracts:build", "fluxiq:build", "client-gateway-websocket:build", "web:build"]);
    assert.equal((await readFile(path.join(coreRoot, "node_modules", ".lab-pair-built-commit"), "utf8")).trim(), target);
  });
});

test("every other command still refuses a Core that predates the shared tooling, and says what to do", async () => {
  await withOutdatedSharedCore(async ({ task }) => {
    for (const argv of [["list"], ["start", "anything", "--dry-run"], ["finish", "t900"], ["abandon", "t900", "--dry-run"], ["prune", "--dry-run"]]) {
      await assert.rejects(task(...argv), (error) => {
        assert.match(error.stderr, /has no scripts\/task\/[a-z-]+\.mjs: that Core predates the shared tooling this checkout imports\. Merge Core's dev into it/u, argv.join(" "));
        return true;
      });
    }
  });
});
