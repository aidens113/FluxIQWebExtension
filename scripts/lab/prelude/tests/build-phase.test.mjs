// The Lab prelude's build phase: its order, its failure path, when it builds
// the host bundle, and that a run with nothing changed spawns no build.

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, test } from "node:test";
import { buildOrder, runStep } from "../../../build-cache/index.mjs";
import { repositoryBuilds, staleRepositoryBuild } from "../../domain-build-staleness.mjs";
import { createStepTimer, runBuildPhase } from "../index.mjs";

// What `buildOrder` answers for this repository's registry.
const ORDERS = {
  "scenario-lab:build": ["test-contracts:build", "scenario-lab:build"],
  "extension:build": ["domain:build", "extension:build"],
  "test-runner:build": ["domain:build", "test-contracts:build", "test-evidence:build", "test-runner:build"]
};
const NON_INTERACTIVE = ["test-contracts:build", "scenario-lab:build", "domain:build", "extension:build", "test-evidence:build", "test-runner:build"];

/** A fake cache that records what it was asked and answers from `answers`. */
function fakeCache(answers = {}) {
  const calls = [];
  return {
    calls,
    runStep: async (step, options) => {
      calls.push({ step, env: options.env });
      return { result: "build", step, reason: "no stamp", ms: 1, exitCode: 0, ...answers[step] };
    }
  };
}

function phase(overrides) {
  const lines = [];
  const note = (line) => lines.push(line);
  const timer = createStepTimer(note);
  return {
    lines,
    timer,
    run: () => runBuildPhase({ interactive: false, instanced: false, env: { MARK: "lab" }, buildOrder: (step) => ORDERS[step], timer, note, ...overrides })
  };
}

describe("order", () => {
  test("a plain run builds what the four pnpm builds built, each step once, the domain before the extension", async () => {
    const cache = fakeCache();
    const { run, lines } = phase({ runStep: cache.runStep });
    const outcomes = await run();
    assert.deepEqual(cache.calls.map((call) => call.step), NON_INTERACTIVE);
    assert.deepEqual(outcomes.map((outcome) => outcome.step), NON_INTERACTIVE);
    // The Lab's environment reaches every step, so FLUXIQ_LAB_* moves the outputs.
    assert.ok(cache.calls.every((call) => call.env.MARK === "lab"));
    // One cache line and one timer line per step.
    assert.deepEqual(lines.filter((line) => "build-cache" in line).map((line) => line.step), NON_INTERACTIVE);
    assert.deepEqual(lines.filter((line) => line.lab === "prelude").map((line) => [line.step, line.action]), NON_INTERACTIVE.map((step) => [step, "rebuilt"]));
  });

  for (const mode of [{ interactive: true, instanced: false }, { interactive: false, instanced: true }]) {
    test(`the host bundle is built before the domain and the extension when ${mode.interactive ? "interactive" : "instanced"}`, async () => {
      const cache = fakeCache();
      const copies = [];
      const { run, timer } = phase({ runStep: cache.runStep, ...mode, copyHostModule: async () => { copies.push(cache.calls.length); } });
      await run();
      const steps = cache.calls.map((call) => call.step);
      assert.deepEqual(steps, ["test-contracts:build", "scenario-lab:build", "domain:host-build", "domain:build", "extension:build", "test-evidence:build", "test-runner:build"]);
      // An instance copies the host bundle after every build, and only an instance does.
      assert.deepEqual(copies, mode.instanced ? [steps.length] : []);
      assert.equal(timer.rows.at(-1).step, mode.instanced ? "host-copy" : "test-runner:build");
    });
  }

  test("a plain run neither builds nor copies the host bundle", async () => {
    const cache = fakeCache();
    let copied = false;
    await phase({ runStep: cache.runStep, copyHostModule: async () => { copied = true; } }).run();
    assert.equal(cache.calls.some((call) => call.step === "domain:host-build"), false);
    assert.equal(copied, false);
  });
});

describe("failure", () => {
  test("a failed step stops the phase, and the error names the step and the cache's reason", async () => {
    const cache = fakeCache({ "extension:build": { exitCode: 2, reason: "inputs changed: apps/extension; the command failed with exit code 2, so it is not stamped" } });
    const { run, timer, lines } = phase({ runStep: cache.runStep });
    await assert.rejects(run(), /build step extension:build failed with exit code 2 \(inputs changed: apps\/extension; the command failed/u);
    assert.deepEqual(cache.calls.map((call) => call.step), ["test-contracts:build", "scenario-lab:build", "domain:build", "extension:build"]);
    assert.equal(timer.rows.at(-1).action, "failed");
    // The cache's line for the failed step is still printed, so the reader sees why.
    assert.equal(lines.filter((line) => "build-cache" in line).at(-1).step, "extension:build");
  });

  test("an error thrown by the cache fails the phase too", async () => {
    const { run } = phase({ runStep: async () => { throw new Error('build-cache: unknown step "domain:host-build"'); }, interactive: true });
    await assert.rejects(run(), /unknown step/u);
  });

  test("an instanced phase without a host copy refuses rather than running without one", async () => {
    await assert.rejects(phase({ runStep: fakeCache().runStep, instanced: true }).run(), /needs copyHostModule/u);
  });
});

// The real cache against a scratch workspace shaped like this repository.
// Every build appends its package's name to a log outside every input, so the
// log is the list of builds that were spawned.
describe("the real cache", () => {
  let repo;
  const log = () => path.join(repo, "runs.log");
  const BUILD_SCRIPT = `
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
appendFileSync(process.env.RUN_LOG, path.basename(process.cwd()) + "\\n");
const out = process.argv[2];
mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, "index.js"), readFileSync("src/main.ts", "utf8"));
`;
  const PACKAGES = [
    ["packages/test-contracts", "test-contracts", []],
    ["apps/scenario-lab", "scenario-lab", ["test-contracts"]],
    ["domain", "domain", []],
    ["apps/extension", "extension", ["domain"]],
    ["packages/test-evidence", "test-evidence", ["test-contracts"]],
    ["packages/test-runner", "test-runner", ["domain", "test-contracts", "test-evidence"]]
  ];
  // The extension writes where the Lab loads it from, so the staleness guard
  // is asked of the real output root.
  const outOf = (name) => (name === "extension" ? "dist/e2e-chromium" : "dist");
  const STEPS = Object.fromEntries(PACKAGES.map(([dir, name]) => [`${name}:build`, {
    package: dir, kind: "build", command: `node build.mjs ${outOf(name)}`, generated: ["dist"],
    outputs: [{ path: "dist" }], required: [`${outOf(name)}/index.js`], env: []
  }]));

  async function put(relative, text) {
    const file = path.join(repo, relative);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, text);
  }
  async function runs() {
    return existsSync(log()) ? (await readFile(log(), "utf8")).split("\n").filter(Boolean) : [];
  }
  function pass() {
    const lines = [];
    const note = (line) => lines.push(line);
    const timer = createStepTimer(note);
    const outcomes = runBuildPhase({
      interactive: false, instanced: false,
      // The machine-wide shared store is off: a scratch run must neither read
      // another test run's entries nor leave its own behind.
      env: { ...process.env, RUN_LOG: log(), FLUXIQ_BUILD_FORCE: "", FLUXIQ_BUILD_CACHE_DIR: "off" },
      runStep: (step, options) => runStep(step, { ...options, repoRoot: repo, steps: STEPS, stdio: "ignore" }),
      buildOrder: (step) => buildOrder(step, { repoRoot: repo, steps: STEPS }),
      timer, note
    });
    return outcomes.then((result) => ({ outcomes: result, total: (timer.finish(), lines.at(-1)) }));
  }
  const guard = () => staleRepositoryBuild(repositoryBuilds(repo, path.join(repo, "apps", "extension")));

  beforeEach(async () => {
    repo = await mkdtemp(path.join(os.tmpdir(), "lab-build-phase-"));
    await put("pnpm-workspace.yaml", 'packages:\n  - "apps/*"\n  - "packages/*"\n  - "domain"\n');
    await put("package.json", "{}");
    for (const [dir, name, deps] of PACKAGES) {
      await put(`${dir}/package.json`, JSON.stringify({ name, dependencies: Object.fromEntries(deps.map((dep) => [dep, "workspace:*"])) }));
      await put(`${dir}/src/main.ts`, `export const name = "${name}";\n`);
      await put(`${dir}/build.mjs`, BUILD_SCRIPT);
    }
  });
  afterEach(async () => { await rm(repo, { recursive: true, force: true }); });

  test("a second pass with nothing changed reuses every step and spawns no build", async () => {
    const first = await pass();
    assert.deepEqual(first.outcomes.map((outcome) => outcome.result), NON_INTERACTIVE.map(() => "build"));
    assert.equal((await runs()).length, NON_INTERACTIVE.length);

    const second = await pass();
    assert.deepEqual(second.outcomes.map((outcome) => outcome.result), NON_INTERACTIVE.map(() => "reuse"));
    assert.equal((await runs()).length, NON_INTERACTIVE.length, "a reuse spawns nothing");
    assert.deepEqual(second.total.rebuilt, []);
    assert.deepEqual(second.total.reused, NON_INTERACTIVE);
  });

  test("a reused build satisfies the staleness guard even when its outputs were older than their source", async () => {
    await pass();
    // Same contents, older outputs: what a checkout or a copy leaves behind.
    const old = new Date(Date.now() - 10 * 60_000);
    for (const file of ["domain/dist/index.js", "apps/extension/dist/e2e-chromium/index.js"]) await utimes(path.join(repo, file), old, old);
    const stale = await guard();
    assert.ok(stale, "before the phase, the guard sees an output older than its source");
    assert.equal(stale.name, "domain");

    const outcomes = (await pass()).outcomes;
    assert.ok(outcomes.every((outcome) => outcome.result === "reuse"));
    assert.equal(await guard(), null, "a reuse touches its outputs, so the guard agrees with the cache");
  });

  test("an edited domain is rebuilt with its dependants, and the guard asked afterwards passes", async () => {
    await pass();
    await put("domain/src/main.ts", 'export const name = "domain, edited";\n');
    const outcomes = (await pass()).outcomes;
    const rebuilt = outcomes.filter((outcome) => outcome.result === "build").map((outcome) => outcome.step);
    assert.deepEqual(rebuilt, ["domain:build", "extension:build", "test-runner:build"]);
    assert.deepEqual((await runs()).slice(NON_INTERACTIVE.length), ["domain", "extension", "test-runner"]);
    assert.equal(await guard(), null);

    // One pass settles it. With the extension built before the domain, the
    // extension was fingerprinted against the domain output the next step
    // replaced, and this pass rebuilt it again.
    const after = (await pass()).outcomes;
    assert.deepEqual(after.map((outcome) => outcome.result), NON_INTERACTIVE.map(() => "reuse"));
  });
});
