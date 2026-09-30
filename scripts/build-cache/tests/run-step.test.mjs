import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, stat, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import { buildOrder, decideStep, runStep } from "../index.mjs";

// A scratch workspace: `a` <- `b` (b depends on a), and an unrelated `c`.
// Each build copies its source (and a dependency's output) into dist/out.txt
// and appends its name to a log outside every input, so a test can count runs.

let repo;
const log = () => path.join(repo, "runs.log");

const BUILD = "node build.mjs";
const BUILD_SCRIPT = `
import { appendFileSync, mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
const name = path.basename(process.cwd());
appendFileSync(process.env.RUN_LOG, name + "\\n");
if (existsSync("fail")) process.exit(3);
if (existsSync("touch-input")) writeFileSync("src/during.txt", String(Date.now()));
mkdirSync(process.env.OUT_DIR ? path.resolve(process.env.OUT_DIR) : "dist", { recursive: true });
const dep = existsSync("../a/dist/out.txt") && name === "b" ? readFileSync("../a/dist/out.txt", "utf8") : "";
writeFileSync(path.join(process.env.OUT_DIR ? path.resolve(process.env.OUT_DIR) : "dist", "out.txt"), readFileSync("src/main.txt", "utf8") + dep);
`;

function buildStep(pkg, extra = {}) {
  return { package: `packages/${pkg}`, kind: "build", command: BUILD, generated: ["dist"], outputs: [{ path: "." }], outputBase: { env: "OUT_DIR", default: "dist", trim: true }, required: ["out.txt"], env: ["NODE_ENV"], ...extra };
}
const STEPS = {
  "a:build": buildStep("a"),
  "b:build": buildStep("b"),
  "c:build": buildStep("c"),
  "a:check": { package: "packages/a", kind: "check", command: "node check.mjs", generated: ["dist"], env: [] }
};

async function put(relative, text) {
  const file = path.join(repo, relative);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, text);
}

async function runs() {
  if (!existsSync(log())) return [];
  return (await readFile(log(), "utf8")).split("\n").filter(Boolean);
}

function run(step, env = {}) {
  return runStep(step, { repoRoot: repo, steps: STEPS, stdio: "ignore", env: { ...process.env, RUN_LOG: log(), FLUXIQ_BUILD_FORCE: "", FLUXIQ_BUILD_CACHE_DIR: "off", OUT_DIR: "", ...env } });
}

beforeEach(async () => {
  repo = await mkdtemp(path.join(os.tmpdir(), "build-cache-run-"));
  await put("pnpm-workspace.yaml", 'packages:\n  - "packages/*"\n');
  await put("package.json", "{}");
  for (const [name, deps] of [["a", {}], ["b", { a: "workspace:*" }], ["c", {}]]) {
    await put(`packages/${name}/package.json`, JSON.stringify({ name, dependencies: deps }));
    await put(`packages/${name}/src/main.txt`, `${name} source\n`);
    await put(`packages/${name}/build.mjs`, BUILD_SCRIPT);
  }
  await put("packages/a/check.mjs", "import { existsSync } from 'node:fs'; process.exit(existsSync('check-fails') ? 1 : 0);");
});
afterEach(async () => { await rm(repo, { recursive: true, force: true }); });

test("a second run with identical inputs reuses the stamp and runs nothing", async () => {
  const first = await run("a:build");
  assert.equal(first.result, "build");
  assert.equal(first.reason, "no stamp");
  const second = await run("a:build");
  assert.equal(second.result, "reuse");
  assert.equal(second.exitCode, 0);
  assert.deepEqual(await runs(), ["a"]);
});

test("an edit rebuilds the package and its dependants, and nothing unrelated", async () => {
  for (const step of ["a:build", "b:build", "c:build"]) await run(step);
  await put("packages/a/src/main.txt", "a source, edited\n");
  const outcomes = [];
  for (const step of ["a:build", "b:build", "c:build"]) outcomes.push(await run(step));
  assert.deepEqual(outcomes.map((outcome) => outcome.result), ["build", "build", "reuse"]);
  assert.match(outcomes[0].reason, /inputs changed: packages\/a/);
  assert.match(outcomes[1].reason, /inputs changed: packages\/a/);
  assert.deepEqual(await runs(), ["a", "b", "c", "a", "b"]);
});

test("a deleted or edited output is rebuilt, never trusted", async () => {
  await run("a:build");
  await rm(path.join(repo, "packages/a/dist/out.txt"));
  const missing = await run("a:build");
  assert.equal(missing.result, "build");
  assert.match(missing.reason, /required output missing: packages\/a\/dist\/out.txt/);
  await put("packages/a/dist/out.txt", "tampered");
  const edited = await run("a:build");
  assert.equal(edited.reason, "outputs changed since they were stamped");
  assert.equal((await run("a:build")).result, "reuse");
});

test("FLUXIQ_BUILD_FORCE=1 always builds", async () => {
  await run("a:build");
  const forced = await run("a:build", { FLUXIQ_BUILD_FORCE: "1" });
  assert.equal(forced.result, "build");
  assert.equal(forced.reason, "FLUXIQ_BUILD_FORCE=1");
});

test("a failed build returns its exit code and leaves no stamp", async () => {
  await run("a:build");
  await put("packages/a/src/main.txt", "changed\n");
  await put("packages/a/fail", "");
  const failed = await run("a:build");
  assert.equal(failed.exitCode, 3);
  assert.equal(existsSync(path.join(repo, "packages/a/node_modules/.cache/fluxiq-build/build.json")), false);
  await rm(path.join(repo, "packages/a/fail"));
  assert.equal((await run("a:build")).reason, "no stamp");
});

test("a check is stamped only when it passed", async () => {
  await put("packages/a/check-fails", "");
  assert.equal((await run("a:check")).exitCode, 1);
  assert.equal((await run("a:check")).result, "build");
  await rm(path.join(repo, "packages/a/check-fails"));
  assert.equal((await run("a:check")).exitCode, 0);
  assert.equal((await run("a:check")).result, "reuse");
});

test("an input that changes while the step runs is not stamped", async () => {
  await put("packages/a/touch-input", "");
  const outcome = await run("a:build");
  assert.equal(outcome.exitCode, 0);
  assert.match(outcome.reason, /not stamped, because inputs changed while it ran \(packages\/a\)/);
  assert.equal((await decideStep("a:build", { repoRoot: repo, steps: STEPS, env: {} })).decision, "build");
});

test("a fingerprinted environment variable changes the decision", async () => {
  await run("a:build", { NODE_ENV: "production" });
  const other = await run("a:build", { NODE_ENV: "development" });
  assert.equal(other.result, "build");
  assert.match(other.reason, /command, Node version, platform or environment/);
});

test("a redirected output base has its own stamp; one that resolves to the default shares it", async () => {
  await run("a:build");
  const redirected = await run("a:build", { OUT_DIR: path.join(repo, "packages/a/.lab-instances/one/dist") });
  assert.equal(redirected.result, "build");
  assert.equal((await run("a:build", { OUT_DIR: path.join(repo, "packages/a/.lab-instances/one/dist") })).result, "reuse");
  assert.equal((await run("a:build")).result, "reuse");
  assert.equal((await run("a:build", { OUT_DIR: ` ${path.join(repo, "packages/a/dist")} ` })).result, "reuse");
});

test("a reuse moves the outputs' modification time to now", async () => {
  await run("a:build");
  const output = path.join(repo, "packages/a/dist/out.txt");
  const past = new Date(Date.now() - 3_600_000);
  await utimes(output, past, past);
  const before = Date.now();
  assert.equal((await run("a:build")).result, "reuse");
  assert.ok((await stat(output)).mtimeMs >= before - 1000);
});

test("buildOrder lists dependencies before dependants", () => {
  assert.deepEqual(buildOrder("b:build", { repoRoot: repo, steps: STEPS }), ["a:build", "b:build"]);
  assert.deepEqual(buildOrder("c:build", { repoRoot: repo, steps: STEPS }), ["c:build"]);
});
