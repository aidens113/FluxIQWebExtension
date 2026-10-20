// This repository's resolver (`workspace/resolve-step.mjs`) and Core library
// resolution (`workspace/resolve-core-library.mjs`), driven through Core's
// engine as `index.mjs` binds it. The engine's own behaviour -- stamps, the
// lock, the store, the stat cache -- is Core's and tested there; these cover
// what this repository decides: dependants and generated directories,
// relocatable output bases, linked Core packages, ignored run data, and its
// part of the shared store.
//
// A scratch checkout: `a` <- `b` (b depends on a), an unrelated `c`, and `b`
// linking a Core library `lib` from a scratch Core beside it. Each build
// copies its source (and a dependency's output) into its output and appends
// its name to a log, so a test can count runs.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readdir, readFile, rm, stat, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import { buildOrder, decideStep, fingerprintStep, openStatCache, resolveCoreLibrary, runStep } from "../index.mjs";

const BUILD_SCRIPT = `
import { appendFileSync, mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
const name = path.basename(process.cwd());
appendFileSync(process.env.RUN_LOG, name + "\\n");
const out = process.env.OUT_DIR ? path.resolve(process.env.OUT_DIR) : "dist";
mkdirSync(out, { recursive: true });
const dep = name === "b" && existsSync("../a/dist/out.txt") ? readFileSync("../a/dist/out.txt", "utf8") : "";
writeFileSync(path.join(out, "out.txt"), readFileSync("src/main.txt", "utf8") + dep);
`;

function buildStep(pkg, extra = {}) {
  return { package: `packages/${pkg}`, kind: "build", command: "node build.mjs", generated: ["dist"], outputs: [{ path: "." }], outputBase: { env: "OUT_DIR", default: "dist", trim: true }, required: ["out.txt"], env: ["NODE_ENV"], ...extra };
}
const STEPS = { "a:build": buildStep("a"), "b:build": buildStep("b"), "c:build": buildStep("c") };

let base;
let repo;
let core;
let store;

async function put(root, relative, text) {
  const file = path.join(root, relative);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, text);
}

async function makeCheckout(root) {
  await put(root, ".gitignore", "node_modules/\ndist/\ntest-runs/\nruns.log\n");
  await put(root, "pnpm-workspace.yaml", 'packages:\n  - "packages/*"\n');
  await put(root, "package.json", "{}");
  for (const [name, dependencies] of [["a", {}], ["b", { a: "workspace:*", lib: `link:${path.relative(path.join(root, "packages", "b"), path.join(core, "packages", "lib")).split(path.sep).join("/")}` }], ["c", {}]]) {
    await put(root, `packages/${name}/package.json`, JSON.stringify({ name, dependencies }));
    await put(root, `packages/${name}/src/main.txt`, `${name} source\n`);
    await put(root, `packages/${name}/build.mjs`, BUILD_SCRIPT);
  }
  execFileSync("git", ["init", "-q"], { cwd: root, stdio: "ignore" });
}

async function makeCore(root) {
  await put(root, "pnpm-workspace.yaml", 'packages:\n  - "packages/*"\n');
  await put(root, "package.json", "{}");
  await put(root, "packages/contracts/package.json", JSON.stringify({ name: "@scratch/contracts", scripts: { build: "tsc" } }));
  await put(root, "packages/contracts/src/index.ts", "export const contract = 1;\n");
  await put(root, "packages/lib/package.json", JSON.stringify({ name: "lib", dependencies: { "@scratch/contracts": "workspace:*" }, scripts: { build: "tsc" } }));
  await put(root, "packages/lib/src/index.ts", "export const lib = 1;\n");
  await put(root, "packages/lib/tsconfig.json", "{}\n");
}

function run(step, env = {}, root = repo) {
  return runStep(step, { repoRoot: root, steps: STEPS, stdio: "ignore", env: { ...process.env, RUN_LOG: path.join(root, "runs.log"), FLUXIQ_BUILD_FORCE: "", FLUXIQ_BUILD_CACHE_DIR: "off", OUT_DIR: "", ...env } });
}

async function runs(root = repo) {
  const log = path.join(root, "runs.log");
  return existsSync(log) ? (await readFile(log, "utf8")).split("\n").filter(Boolean) : [];
}

beforeEach(async () => {
  base = await mkdtemp(path.join(os.tmpdir(), "build-cache-resolve-"));
  repo = path.join(base, "ext");
  core = path.join(base, "core");
  store = path.join(base, "store");
  await makeCore(core);
  await makeCheckout(repo);
});
afterEach(async () => { await rm(base, { recursive: true, force: true }); });

test("a second run with identical inputs reuses the stamp and runs nothing", async () => {
  assert.deepEqual([(await run("a:build")).reason, (await run("a:build")).result], ["no stamp", "reuse"]);
  assert.deepEqual(await runs(), ["a"]);
});

test("an edit rebuilds the package and its dependants, and nothing unrelated", async () => {
  for (const step of ["a:build", "b:build", "c:build"]) await run(step);
  await put(repo, "packages/a/src/main.txt", "a source, edited\n");
  const outcomes = [];
  for (const step of ["a:build", "b:build", "c:build"]) outcomes.push(await run(step));
  assert.deepEqual(outcomes.map((outcome) => outcome.result), ["build", "build", "reuse"]);
  assert.match(outcomes[0].reason, /inputs changed: packages\/a/u);
  // b reads a's sources and a's generated dist/, which git ignores and is walked.
  assert.match(outcomes[1].reason, /inputs changed: packages\/a, packages\/a\/dist/u);
  assert.deepEqual(await runs(), ["a", "b", "c", "a", "b"]);
});

test("run data in an ignored directory of a package invalidates nothing; an untracked visible file does", async () => {
  await run("a:build");
  await put(repo, "packages/a/test-runs/run-1/evidence.json", "{}");
  assert.equal((await run("a:build")).result, "reuse");
  await put(repo, "packages/a/notes.txt", "visible\n");
  assert.match((await run("a:build")).reason, /inputs changed: packages\/a/u);
});

test("a change in a linked Core package rebuilds the step that links it, labelled by its place in Core", async () => {
  await run("a:build");
  await run("b:build");
  await put(core, "packages/lib/src/index.ts", "export const lib = 2;\n");
  assert.equal((await run("a:build")).result, "reuse");
  assert.match((await run("b:build")).reason, /inputs changed: core:packages\/lib\/src/u);
});

test("a redirected output base has its own stamp; one that resolves to the default shares it", async () => {
  await run("a:build");
  const instance = path.join(repo, "packages/a/.lab-instances/one/dist");
  assert.equal((await run("a:build", { OUT_DIR: instance })).result, "build");
  assert.equal((await run("a:build", { OUT_DIR: instance })).result, "reuse");
  assert.equal((await run("a:build")).result, "reuse");
  assert.equal((await run("a:build", { OUT_DIR: ` ${path.join(repo, "packages/a/dist")} ` })).result, "reuse");
});

test("a reuse whose inputs are all older than its outputs leaves the outputs' timestamps alone", async () => {
  await run("a:build");
  const output = path.join(repo, "packages/a/dist/out.txt");
  const future = new Date(Date.now() + 3_600_000);
  await utimes(output, future, future);
  assert.equal((await run("a:build")).result, "reuse");
  assert.equal(Math.round((await stat(output)).mtimeMs / 1000), Math.round(future.getTime() / 1000));
});

test("entries go to the shared store's top, never Core's core/, and another tree restores them", async () => {
  const other = path.join(base, "elsewhere", "ext");
  await makeCheckout(other);
  assert.equal((await run("a:build", { FLUXIQ_BUILD_CACHE_DIR: store })).result, "build");
  assert.equal((await readdir(path.join(store, "v1"))).length, 1);
  assert.equal(existsSync(path.join(store, "core")), false);
  const one = await decideStep("a:build", { repoRoot: repo, steps: STEPS, env: {} });
  const two = await decideStep("a:build", { repoRoot: other, steps: STEPS, env: {} });
  assert.equal(one.fingerprint, two.fingerprint);
  const restored = await run("a:build", { FLUXIQ_BUILD_CACHE_DIR: store }, other);
  assert.deepEqual([restored.result, restored.source], ["reuse", "store"]);
  assert.deepEqual(await runs(other), []);
});

test("buildOrder lists dependencies before dependants", () => {
  assert.deepEqual(buildOrder("b:build", { repoRoot: repo, steps: STEPS }), ["a:build", "b:build"]);
  assert.deepEqual(buildOrder("c:build", { repoRoot: repo, steps: STEPS }), ["c:build"]);
});

test("a Core library resolves with labels relative to its Core, so two Cores with the same content fingerprint the same", async () => {
  const twin = path.join(base, "twin", "core");
  await makeCore(twin);
  const fingerprint = async (root) => {
    const resolved = resolveCoreLibrary(root, "lib", { env: {} });
    return { resolved, ...(await fingerprintStep(resolved, { statCache: await openStatCache(null) })) };
  };
  const one = await fingerprint(core);
  const two = await fingerprint(twin);
  assert.equal(one.resolved.name, "core:lib:build");
  assert.ok(one.resolved.roots.some((root) => root.label === "core:packages/contracts/dist"), "a dependency's dist is an input");
  assert.ok(one.resolved.roots.every((root) => root.label.startsWith("core:") || root.label.startsWith("build-cache:")), one.resolved.roots.map((root) => root.label).join(", "));
  assert.equal(one.fingerprint, two.fingerprint);
  await put(twin, "packages/lib/src/index.ts", "export const lib = 3;\n");
  assert.notEqual((await fingerprint(twin)).fingerprint, one.fingerprint);
});
