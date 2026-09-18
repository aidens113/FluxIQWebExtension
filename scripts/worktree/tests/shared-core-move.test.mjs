import assert from "node:assert/strict";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fullCoreDistPaths } from "../core-build.mjs";
import { writeMarker } from "../markers.mjs";
import { planSharedCoreMove } from "../shared-core-move.mjs";
import { withSharedCore } from "./shared-core-fixture.mjs";

const nobodyRunning = { processes: [], selfPid: 1 };
const running = (commandLine) => ({ processes: [{ pid: 42, parentPid: 1, name: "node.exe", commandLine }], selfPid: 7 });

test("a shared Core behind its target is planned to move, and counts every worktree that shares it", async () => {
  await withSharedCore(async ({ ext, coreRoot, sharer, coreGit }) => {
    const plan = await planSharedCoreMove({ coreRoot, repositoryRoot: ext, target: "main", ...nobodyRunning });
    assert.equal(plan.refusal, null);
    assert.equal(plan.to, coreGit("rev-parse", "main"));
    assert.equal(plan.behind, 1);
    assert.deepEqual([plan.checkout, plan.install, plan.build], [true, true, true]);
    // The main checkout is not beside the shared Core, so a process in it
    // cannot be using that Core and must not hold up the move.
    assert.deepEqual(plan.sharers.map((root) => path.resolve(root)), [path.resolve(sharer)]);
  });
});

test("a Core already at its target, installed and built there, needs nothing and asks nobody", async () => {
  await withSharedCore(async ({ ext, coreRoot, coreGit }) => {
    coreGit("-C", coreRoot, "checkout", "--quiet", "--detach", "main");
    await writeMarker(coreRoot, "install", coreGit("rev-parse", "main:pnpm-lock.yaml"));
    await writeMarker(coreRoot, "build", coreGit("rev-parse", "main"));
    for (const dist of fullCoreDistPaths(coreRoot)) await mkdir(dist, { recursive: true });
    // Something is running beside it, and that is fine: nothing is changing.
    const plan = await planSharedCoreMove({ coreRoot, repositoryRoot: ext, target: "main", ...running(`node ${path.join(coreRoot, "x.mjs")}`) });
    assert.equal(plan.refusal, null);
    assert.deepEqual([plan.checkout, plan.install, plan.build, plan.behind], [false, false, false, 0]);
  });
});

test("a Core at its target with output but no build marker is left alone, which is how every hand-built Core arrives", async () => {
  await withSharedCore(async ({ ext, coreRoot, coreGit }) => {
    // What `git worktree add` plus `pnpm --filter fluxiq build` leaves behind,
    // and what every Core on this machine looked like on 2026-09-18: output
    // present, nothing recording which commit made it. Honouring the absent
    // marker rebuilt a correct Core on every call and refused the whole move
    // whenever anything was running beside it.
    coreGit("-C", coreRoot, "checkout", "--quiet", "--detach", "main");
    for (const dist of fullCoreDistPaths(coreRoot)) await mkdir(dist, { recursive: true });
    await mkdir(path.join(coreRoot, "node_modules", ".pnpm"), { recursive: true });
    await copyFile(path.join(coreRoot, "pnpm-lock.yaml"), path.join(coreRoot, "node_modules", ".pnpm", "lock.yaml"));
    const plan = await planSharedCoreMove({ coreRoot, repositoryRoot: ext, target: "main", ...running(`node ${path.join(coreRoot, "x.mjs")}`) });
    assert.equal(plan.refusal, null);
    assert.deepEqual([plan.checkout, plan.install, plan.build], [false, false, false]);
  });
});

test("a Core it does move is rebuilt, marker or no marker, because the checkout invalidates the old output", async () => {
  await withSharedCore(async ({ ext, coreRoot, coreGit }) => {
    for (const dist of fullCoreDistPaths(coreRoot)) await mkdir(dist, { recursive: true });
    await writeMarker(coreRoot, "build", coreGit("-C", coreRoot, "rev-parse", "HEAD"));
    const plan = await planSharedCoreMove({ coreRoot, repositoryRoot: ext, target: "main", ...nobodyRunning });
    assert.deepEqual([plan.checkout, plan.build], [true, true]);
  });
});

test("a Core on a branch is somebody's checkout and is never moved", async () => {
  await withSharedCore(async ({ ext, core }) => {
    const plan = await planSharedCoreMove({ coreRoot: core, repositoryRoot: ext, target: "main", ...nobodyRunning });
    assert.match(plan.refusal, /is on the branch "main", so it is somebody's working checkout/u);
  });
});

test("a shared Core with changes in it refuses the move", async () => {
  await withSharedCore(async ({ ext, coreRoot }) => {
    await writeFile(path.join(coreRoot, "notes.txt"), "mine\n");
    const plan = await planSharedCoreMove({ coreRoot, repositoryRoot: ext, target: "main", ...nobodyRunning });
    assert.match(plan.refusal, /1 uncommitted or untracked change\(s\) \(\?\? notes\.txt\)/u);
  });
});

test("a shared Core on a commit nothing else holds refuses the move rather than strand it", async () => {
  await withSharedCore(async ({ ext, coreRoot, coreGit }) => {
    coreGit("-C", coreRoot, "commit", "--quiet", "--allow-empty", "-m", "made on the detached Core");
    const plan = await planSharedCoreMove({ coreRoot, repositoryRoot: ext, target: "main", ...nobodyRunning });
    assert.match(plan.refusal, /which no branch or tag contains; moving it to main would leave that commit reachable from nothing/u);
  });
});

test("a process working in a worktree that shares the Core refuses the move, unless running is allowed", async () => {
  await withSharedCore(async ({ ext, coreRoot, sharer }) => {
    const lab = running(`node ${path.join(sharer, "scripts", "lab", "run-lab.mjs")} run x`);
    const refused = await planSharedCoreMove({ coreRoot, repositoryRoot: ext, target: "main", ...lab });
    // The refusal names what the move would actually do, not how far behind the
    // Core is: a Core nought commits behind can still need a rebuild, and
    // "0 commit(s) behind and has to be moved" is what it used to say.
    assert.match(refused.refusal, /needs a checkout, an install and a rebuild, but 1 running process\(es\).*node\.exe \(pid 42\)/u);
    assert.match(refused.refusal, /--allow-running, or open the task under another --base/u);
    assert.deepEqual(refused.busy, [{ pid: 42, name: "node.exe" }]);

    const allowed = await planSharedCoreMove({ coreRoot, repositoryRoot: ext, target: "main", allowRunning: true, ...lab });
    assert.equal(allowed.refusal, null);
  });
});

test("a process running Core's own files refuses the move; one in an unrelated directory does not", async () => {
  await withSharedCore(async ({ ext, root, coreRoot }) => {
    const next = running(`"${path.join(coreRoot, "apps", "web", "node_modules", ".bin", "next.cmd")}" start --port 3000`);
    assert.match((await planSharedCoreMove({ coreRoot, repositoryRoot: ext, target: "main", ...next })).refusal, /1 running process\(es\)/u);

    const elsewhere = running(`node ${path.join(root, "elsewhere", "server.mjs")}`);
    assert.equal((await planSharedCoreMove({ coreRoot, repositoryRoot: ext, target: "main", ...elsewhere })).refusal, null);
  });
});
