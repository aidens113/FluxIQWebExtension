import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { CORE_LIBRARY_STEPS, installSummary, PANEL_HOST_STEP, prepareWorkspace, taskToolCoreChecks } from "../index.mjs";

// The launcher's preparation with every command faked: the order, what each
// step runs and where, the one line each prints, and a failure stopping it.

const record = (step, outcome) => JSON.stringify({ "build-cache": outcome, step, reason: "dummy" });

const ownCore = async () => "own";
const sharedCore = async () => "shared";

function fakeRun(answers) {
  const calls = [];
  const run = async (options) => {
    calls.push(options);
    return answers[calls.length - 1] ?? { code: 0, lines: [] };
  };
  return { run, calls };
}

test("installs both repositories, then Core's libraries, then the panel host, one line each, all current", async () => {
  const { run, calls } = fakeRun([
    { code: 0, lines: ["Lockfile is up to date, resolution step is skipped", "Already up to date"] },
    { code: 0, lines: ["Already up to date"] },
    { code: 0, lines: CORE_LIBRARY_STEPS.map((step) => record(step, "reuse")) },
    { code: 0, lines: [record(PANEL_HOST_STEP, "reuse")] }
  ]);
  const printed = [];
  await prepareWorkspace({ repoRoot: "C:/ext", coreRoot: "C:/core", env: { MARK: "1" }, log: (line) => printed.push(line), run, inspectCore: ownCore });
  assert.deepEqual(printed, ["Dependencies (extension): current.", "Dependencies (FluxIQ Core): current.", "Core libraries: current.", "Panel host: current."]);
  assert.deepEqual(calls.map((call) => [call.command, call.args, call.cwd]), [
    ["pnpm", ["install", "--frozen-lockfile", "--prefer-offline"], "C:/ext"],
    ["pnpm", ["install", "--frozen-lockfile", "--prefer-offline"], "C:/core"],
    [process.execPath, [path.join("C:/core", "scripts", "build-cache", "cli.mjs"), ...CORE_LIBRARY_STEPS], "C:/core"],
    [process.execPath, [path.join("C:/ext", "scripts", "build-cache", "cli.mjs"), PANEL_HOST_STEP], "C:/ext"]
  ]);
  for (const call of calls) assert.deepEqual(call.env, { MARK: "1" });
});

test("says what it did when something was out of date", async () => {
  const { run } = fakeRun([
    { code: 0, lines: ["Packages: +12", "Done in 4.1s"] },
    { code: 0, lines: ["Already up to date"] },
    { code: 0, lines: [record("contracts:build", "reuse"), record("fluxiq:build", "build")] },
    { code: 0, lines: [record(PANEL_HOST_STEP, "build")] }
  ]);
  const printed = [];
  await prepareWorkspace({ repoRoot: "C:/ext", coreRoot: "C:/core", log: (line) => printed.push(line), run, inspectCore: ownCore });
  assert.deepEqual(printed, [
    "Dependencies (extension): installed from the lockfile.",
    "Dependencies (FluxIQ Core): current.",
    "Core libraries: rebuilt fluxiq (they were out of date).",
    "Panel host: rebuilt domain:host-build (they were out of date)."
  ]);
});

test("a failing step prints its output, names the step, and nothing after it runs", async () => {
  const { run, calls } = fakeRun([
    { code: 0, lines: ["Already up to date"] },
    { code: 0, lines: ["Already up to date"] },
    { code: 1, lines: ["error TS2305: dummy compile error"] }
  ]);
  const errors = [];
  const original = console.error;
  console.error = (line) => errors.push(line);
  try {
    await assert.rejects(prepareWorkspace({ repoRoot: "C:/ext", coreRoot: "C:/core", log: () => undefined, run, inspectCore: ownCore }), /Core libraries failed \(exit code 1\)/u);
  } finally {
    console.error = original;
  }
  assert.deepEqual(errors, ["error TS2305: dummy compile error"]);
  assert.equal(calls.length, 3);
});

test("pnpm's own words decide whether an install was current", () => {
  assert.equal(installSummary("Dependencies (extension)", ["Already up to date"]), "Dependencies (extension): current.");
  assert.equal(installSummary("Dependencies (extension)", ["Progress: resolved 1, reused 1"]), "Dependencies (extension): installed from the lockfile.");
});

test("a shared Core that is current is only checked: no install or build in it, one line, then the panel host", async () => {
  const { run, calls } = fakeRun([
    { code: 0, lines: ["Already up to date"] },
    { code: 0, lines: [record(PANEL_HOST_STEP, "reuse")] }
  ]);
  const checked = [];
  const printed = [];
  await prepareWorkspace({
    repoRoot: "C:/ext", coreRoot: "C:/fxwork/!FluxIQ", env: { MARK: "1" }, log: (line) => printed.push(line), run, inspectCore: sharedCore,
    sharedCoreChecks: async (input) => {
      checked.push(input);
      return null;
    }
  });
  assert.deepEqual(checked, [{ repoRoot: "C:/ext", coreRoot: "C:/fxwork/!FluxIQ", env: { MARK: "1" } }]);
  assert.deepEqual(calls.map((call) => call.cwd), ["C:/ext", "C:/ext"], "nothing runs inside the shared Core");
  assert.deepEqual(printed, [
    "Dependencies (extension): current.",
    "FluxIQ Core: current (shared with other task worktrees, so only checked, never installed into or rebuilt).",
    "Panel host: current."
  ]);
});

test("a shared Core that is out of date stops the launcher with one line naming pnpm task sync-core, changing nothing", async () => {
  const { run, calls } = fakeRun([{ code: 0, lines: ["Already up to date"] }]);
  const error = await prepareWorkspace({
    repoRoot: "C:/ext", coreRoot: "C:/fxwork/!FluxIQ", log: () => undefined, run, inspectCore: sharedCore,
    sharedCoreChecks: async () => "is 3 commit(s) behind Core's dev"
  }).then(() => null, (caught) => caught);
  assert.ok(error, "the launcher stops");
  assert.equal(error.message.includes("\n"), false, "one line");
  assert.match(error.message, /C:\/fxwork\/!FluxIQ is shared with other task worktrees and is 3 commit\(s\) behind Core's dev/u);
  assert.match(error.message, /run pnpm task sync-core in C:\/ext, then start again/u);
  assert.equal(calls.length, 1, "only the extension's install ran");
});

const currentCore = async () => ({ behind: 0, integrationBranch: "dev", refusal: null });
const freshBuild = async () => ({ fresh: true, message: null });

test("the task tool's checks: a Core behind Core's dev, or built from older source, is out of date", async () => {
  const input = { repoRoot: "C:/ext", coreRoot: "C:/fxwork/!FluxIQ", env: {} };
  let asked = null;
  const behind = async (question) => {
    asked = question;
    return { behind: 2, integrationBranch: "dev", refusal: "dummy refusal" };
  };
  assert.equal(await taskToolCoreChecks({ ...input, checks: { currency: behind, freshness: freshBuild } }), "is 2 commit(s) behind Core's dev");
  assert.deepEqual(asked, { workRoot: "C:/ext", coreRepositoryRoot: "C:/fxwork/!FluxIQ" });
  const staleBuild = async () => ({ fresh: false, message: "dummy\nmulti-line" });
  assert.equal(await taskToolCoreChecks({ ...input, checks: { currency: currentCore, freshness: staleBuild } }), "its build is missing or older than its source");
  assert.equal(await taskToolCoreChecks({ ...input, checks: { currency: currentCore, freshness: freshBuild } }), null);
});
