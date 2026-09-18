import assert from "node:assert/strict";
import test from "node:test";
import { applyMove } from "../apply-move.mjs";
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
  await withSharedCore(async ({ ext, coreRoot }) => {
    const plan = await planSharedCoreMove({ coreRoot, repositoryRoot: ext, target: "main", ...nobodyRunning });
    await assert.rejects(applyMove(plan, {
      env: {}, note: quiet,
      runInstall: async () => {},
      runBuild: async () => { throw new Error("tsc died"); },
    }), /tsc died/u);
    assert.equal(await readMarker(coreRoot, "build"), null);

    const again = await planSharedCoreMove({ coreRoot, repositoryRoot: ext, target: "main", ...nobodyRunning });
    assert.deepEqual([again.checkout, again.install, again.build], [false, false, true]);
  });
});
