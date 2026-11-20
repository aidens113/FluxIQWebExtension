import assert from "node:assert/strict";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { applyMove } from "../apply-move.mjs";
import { coreDistPaths, fullCoreDistPaths } from "../core-build.mjs";
import { readMarker } from "../markers.mjs";
import { planSharedCoreMove } from "../shared-core-move.mjs";
import { withSharedCore } from "./shared-core-fixture.mjs";

const quiet = () => {};
const nobodyRunning = { processes: [], selfPid: 1 };

test("a planned move checks out, installs, then builds, and records each step once it succeeded", async () => {
  await withSharedCore(async ({ ext, coreRoot, coreGit }) => {
    const plan = await planSharedCoreMove({ coreRoot, repositoryRoot: ext, target: "main", ...nobodyRunning });
    const calls = [];
    await applyMove(plan, {
      env: {}, note: quiet,
      runInstall: async (root, { side }) => { calls.push({ step: "install", side, head: coreGit("-C", root, "rev-parse", "HEAD") }); },
      runBuild: async (root) => { calls.push({ step: "build", head: coreGit("-C", root, "rev-parse", "HEAD") }); },
    });
    const main = coreGit("rev-parse", "main");
    // Both run against the commit the Core was moved to, never the one it left.
    assert.deepEqual(calls, [{ step: "install", side: "core", head: main }, { step: "build", head: main }]);
    assert.equal(coreGit("-C", coreRoot, "rev-parse", "HEAD"), main);
    assert.equal(await readMarker(coreRoot, "install"), coreGit("rev-parse", "main:pnpm-lock.yaml"));
    assert.equal(await readMarker(coreRoot, "build"), main);
  });
});

test("a build that dies leaves only the install recorded, so running the same move again finishes it", async () => {
  await withSharedCore(async ({ ext, coreRoot, coreGit }) => {
    const plan = await planSharedCoreMove({ coreRoot, repositoryRoot: ext, target: "main", ...nobodyRunning });
    await assert.rejects(applyMove(plan, {
      env: {}, note: quiet,
      runInstall: async () => {},
      runBuild: async () => { throw new Error("tsc died"); },
    }), /tsc died/u);
    assert.equal(await readMarker(coreRoot, "build"), `incomplete:${coreGit("rev-parse", "main")}`);

    const again = await planSharedCoreMove({ coreRoot, repositoryRoot: ext, target: "main", ...nobodyRunning });
    assert.deepEqual([again.checkout, again.install, again.build], [false, false, true]);
  });
});

test("a build that dies with the old output still in place is finished by the next move all the same", async () => {
  await withSharedCore(async ({ ext, coreRoot }) => {
    // As on 2026-11-19: every library's output (and the panel's) was left by an earlier build, so only
    // the marker can say the build at this commit never finished.
    for (const output of fullCoreDistPaths(coreRoot)) {
      await mkdir(path.dirname(output), { recursive: true });
      await writeFile(output, "");
    }
    const plan = await planSharedCoreMove({ coreRoot, repositoryRoot: ext, target: "main", ...nobodyRunning });
    await assert.rejects(applyMove(plan, {
      env: {}, note: quiet,
      runInstall: async () => {},
      runBuild: async () => { throw new Error("next build died"); },
    }), /next build died/u);

    const again = await planSharedCoreMove({ coreRoot, repositoryRoot: ext, target: "main", ...nobodyRunning });
    assert.deepEqual([again.checkout, again.install, again.build], [false, false, true]);
  });
});

test("a panel whose Next output has no BUILD_ID is not built, however current its libraries are", async () => {
  await withSharedCore(async ({ ext, coreRoot }) => {
    for (const output of fullCoreDistPaths(coreRoot)) await mkdir(path.dirname(output), { recursive: true });
    for (const output of coreDistPaths(coreRoot)) await writeFile(output, "");
    // A failed Next build leaves `.next` with its cache and partial output, but no BUILD_ID.
    await mkdir(path.join(coreRoot, "apps", "web", ".next", "cache"), { recursive: true });
    await applyMove(await planSharedCoreMove({ coreRoot, repositoryRoot: ext, target: "main", ...nobodyRunning }), { env: {}, note: quiet, runInstall: async () => {}, runBuild: async () => {} });
    await rm(path.join(coreRoot, "node_modules", ".lab-pair-built-commit"), { force: true });

    const plan = await planSharedCoreMove({ coreRoot, repositoryRoot: ext, target: "main", ...nobodyRunning });
    assert.equal(plan.build, true);
  });
});
