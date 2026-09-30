import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import { pathSpellings, resolveCoreLibrary } from "../../build-cache/index.mjs";
import { buildCore, CORE_PACKAGES, FULL_CORE_PACKAGES } from "../core-build.mjs";

// A scratch Core with the three library packages (fluxiq and the websocket
// gateway depend on contracts) and the web app. The injected pnpm "builds" a
// library by writing its source, followed by its dependencies' output, into
// dist/, so a change to contracts' source changes what its dependants read.

const DEPENDS_ON = { contracts: [], fluxiq: ["contracts"], "client-gateway-websocket": ["contracts"] };
const BUILD = "tsc -b tsconfig.build.json --clean && tsc -b tsconfig.build.json && node ../../scripts/rewrite-declaration-imports.mjs dist";

let cores;
let store;
beforeEach(async () => {
  cores = [await makeCore("core-build-one-"), await makeCore("core-build-two-")];
  store = await mkdtemp(path.join(os.tmpdir(), "core-build-store-"));
});
afterEach(async () => {
  for (const dir of [...cores, store]) await rm(dir, { recursive: true, force: true });
});

async function put(root, relative, text) {
  const file = path.join(root, relative);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, text);
}

async function makeCore(prefix) {
  const root = await mkdtemp(path.join(os.tmpdir(), prefix));
  await put(root, "pnpm-workspace.yaml", 'packages:\n  - "apps/*"\n  - "packages/*"\n');
  await put(root, "package.json", "{}");
  await put(root, "pnpm-lock.yaml", "lockfileVersion: '9.0'\n");
  await put(root, "tsconfig.base.json", "{}");
  await put(root, "scripts/rewrite-declaration-imports.mjs", "// rewrites\n");
  for (const item of CORE_PACKAGES) {
    const dependencies = Object.fromEntries(DEPENDS_ON[item.directory].map((directory) => [CORE_PACKAGES.find((other) => other.directory === directory).filter, "workspace:*"]));
    await put(root, `packages/${item.directory}/package.json`, JSON.stringify({ name: item.filter, scripts: { build: BUILD }, dependencies }));
    await put(root, `packages/${item.directory}/tsconfig.build.json`, "{}");
    await put(root, `packages/${item.directory}/src/index.ts`, `export const name = "${item.filter}";\n`);
  }
  await put(root, "apps/web/package.json", JSON.stringify({ name: "@fluxiq/web", scripts: { build: "next build" } }));
  return root;
}

function fakePnpm(calls) {
  return async (root, args, options) => {
    assert.ok(options.env, "pnpm is given an environment");
    assert.deepEqual([args[0], args[2]], ["--filter", "build"]);
    calls.push(args[1]);
    const item = CORE_PACKAGES.find((candidate) => candidate.filter === args[1]);
    if (item === undefined) return;
    const dir = path.join(root, "packages", item.directory);
    const dependencies = await Promise.all(DEPENDS_ON[item.directory].map((directory) => readFile(path.join(root, "packages", directory, "dist", "index.js"), "utf8")));
    const source = await readFile(path.join(dir, "src", "index.ts"), "utf8");
    await put(dir, "dist/index.js", [source, ...dependencies].join(""));
    await put(dir, "dist/index.d.ts", "export declare const name: string;\n");
    await put(dir, "tsconfig.build.tsbuildinfo", '{"root":["./src/index.ts"]}');
  };
}

function build(root, calls, notes = [], packages = CORE_PACKAGES) {
  const env = { ...process.env, FLUXIQ_BUILD_CACHE_DIR: store, FLUXIQ_BUILD_FORCE: "" };
  return buildCore(root, { env, packages, pnpm: fakePnpm(calls), note: (line) => notes.push(line) });
}

const outcomes = (notes) => notes.filter((line) => line.step === "build-core-package").map((line) => `${line.package}:${line.source}`);

test("a miss runs today's pnpm build for each library, in order, and a second call runs none", async () => {
  const calls = [];
  const notes = [];
  await build(cores[0], calls, notes);
  assert.deepEqual(calls, CORE_PACKAGES.map((item) => item.filter));
  assert.deepEqual(outcomes(notes), CORE_PACKAGES.map((item) => `${item.filter}:command`));
  const again = [];
  const hitNotes = [];
  await build(cores[0], again, hitNotes);
  assert.deepEqual(again, []);
  assert.deepEqual(outcomes(hitNotes), CORE_PACKAGES.map((item) => `${item.filter}:stamp`));
});

test("a contracts edit rebuilds contracts and every library that reads its dist", async () => {
  await build(cores[0], []);
  await put(cores[0], "packages/contracts/src/index.ts", 'export const name = "contracts, edited";\n');
  const calls = [];
  await build(cores[0], calls);
  assert.deepEqual(calls, ["@fluxiq/contracts", "fluxiq", "@fluxiq/client-gateway-websocket"]);
  await put(cores[0], "packages/fluxiq/src/index.ts", 'export const name = "fluxiq, edited";\n');
  const only = [];
  await build(cores[0], only);
  assert.deepEqual(only, ["fluxiq"]);
});

test("a second Core checkout at another path restores all three from the store", async () => {
  await build(cores[0], []);
  const calls = [];
  const notes = [];
  await build(cores[1], calls, notes);
  assert.deepEqual(calls, []);
  assert.deepEqual(outcomes(notes), CORE_PACKAGES.map((item) => `${item.filter}:store`));
  for (const item of CORE_PACKAGES) {
    const file = `packages/${item.directory}/dist/index.js`;
    assert.equal(await readFile(path.join(cores[1], file), "utf8"), await readFile(path.join(cores[0], file), "utf8"), file);
  }
});

test("the web panel is built exactly as before, every time", async () => {
  const calls = [];
  await build(cores[0], calls, [], FULL_CORE_PACKAGES);
  await build(cores[0], calls, [], FULL_CORE_PACKAGES);
  assert.deepEqual(calls, [...CORE_PACKAGES.map((item) => item.filter), "@fluxiq/web", "@fluxiq/web"]);
});

test("a failed library build rejects as pnpm did and runs nothing after it", async () => {
  const calls = [];
  const failing = async (root, args) => {
    calls.push(args[1]);
    throw new Error(`pnpm ${args.join(" ")} in ${root} exited with 2`);
  };
  const env = { ...process.env, FLUXIQ_BUILD_CACHE_DIR: store };
  await assert.rejects(buildCore(cores[0], { env, pnpm: failing, note: () => {} }), /exited with 2/u);
  assert.deepEqual(calls, ["@fluxiq/contracts"]);
});

test("a Core library's fingerprint names no absolute path and covers its dependencies' dist", () => {
  const fluxiq = resolveCoreLibrary(cores[0], "fluxiq", { env: {} });
  const labels = fluxiq.roots.map((root) => root.label);
  for (const expected of ["core:packages/fluxiq/src", "core:packages/fluxiq/tsconfig.build.json", "core:packages/contracts/dist", "core:scripts/rewrite-declaration-imports.mjs", "core:pnpm-lock.yaml", "core:node_modules/.pnpm/lock.yaml"]) {
    assert.ok(labels.includes(expected), `${expected} missing from ${labels.join(", ")}`);
  }
  const fingerprinted = JSON.stringify({ meta: fluxiq.meta, labels }).toLowerCase();
  for (const spelling of pathSpellings([cores[0]])) assert.ok(!fingerprinted.includes(spelling), spelling);
  assert.equal(fluxiq.command, "pnpm --filter fluxiq build");
});

// Core with its own build cache: `scripts/build-cache/cli.mjs` exists and a
// library's `build` script runs it. Such a package is built with exactly Core's
// `pnpm --filter <name> build`, never through this repository's cache, and the
// note carries Core's own outcome line. Decided per package of each checkout.

const CORE_CLI_BUILD = (directory) => `node ../../scripts/build-cache/cli.mjs ${directory}:build -- "${BUILD}"`;

async function giveCoreItsCache(root, directories, { cli = true } = {}) {
  if (cli) await put(root, "scripts/build-cache/cli.mjs", "// Core's cache\n");
  for (const directory of directories) {
    const file = path.join(root, "packages", directory, "package.json");
    const pkg = JSON.parse(await readFile(file, "utf8"));
    await writeFile(file, JSON.stringify({ ...pkg, scripts: { build: CORE_CLI_BUILD(directory) } }));
  }
}

function coreCachedPnpm(calls) {
  const inner = fakePnpm(calls);
  return async (root, args, options) => {
    await inner(root, args, options);
    if (options.onLine) {
      options.onLine("> tsc -b tsconfig.build.json");
      options.onLine(JSON.stringify({ "build-cache": "reuse", step: `${args[1]}:build`, reason: "stamp matches", ms: 3, source: "stamp" }));
    }
  };
}

function buildWithSpy(root, calls, notes, steps) {
  const env = { ...process.env, FLUXIQ_BUILD_CACHE_DIR: store, FLUXIQ_BUILD_FORCE: "" };
  const step = async (resolved, options) => {
    steps.push(resolved.command);
    await options.run();
    return { result: "build", source: "command", reason: "spy", ms: 0, exitCode: 0 };
  };
  return buildCore(root, { env, pnpm: coreCachedPnpm(calls), step, note: (line) => notes.push(line) });
}

test("a Core whose build scripts run its own cache is built with Core's command, never the downstream wrapper", async () => {
  await giveCoreItsCache(cores[0], CORE_PACKAGES.map((item) => item.directory));
  const calls = [];
  const notes = [];
  const steps = [];
  await buildWithSpy(cores[0], calls, notes, steps);
  assert.deepEqual(steps, []);
  assert.deepEqual(calls, CORE_PACKAGES.map((item) => item.filter));
  const packageNotes = notes.filter((line) => line.step === "build-core-package");
  assert.deepEqual(packageNotes.map((line) => `${line.package}:${line["build-cache"]}:${line.core?.["build-cache"]}:${line.core?.source}`), CORE_PACKAGES.map((item) => `${item.filter}:delegated:reuse:stamp`));
  const env = { ...process.env, FLUXIQ_BUILD_CACHE_DIR: store, FLUXIQ_BUILD_FORCE: "" };
  await buildCore(cores[0], { env, pnpm: coreCachedPnpm([]), note: () => {} });
  for (const item of CORE_PACKAGES) {
    await assert.rejects(readdir(path.join(cores[0], "packages", item.directory, "node_modules", ".cache", "fluxiq-build")), { code: "ENOENT" }, `no downstream stamp for ${item.filter}`);
  }
  assert.deepEqual(await readdir(store), [], "nothing entered the downstream store");
});

test("a Core without the CLI keeps today's path, even when a script names it", async () => {
  await giveCoreItsCache(cores[0], CORE_PACKAGES.map((item) => item.directory), { cli: false });
  const calls = [];
  const notes = [];
  const steps = [];
  await buildWithSpy(cores[0], calls, notes, steps);
  assert.deepEqual(steps, CORE_PACKAGES.map((item) => `pnpm --filter ${item.filter} build`));
  assert.deepEqual(calls, CORE_PACKAGES.map((item) => item.filter));
  assert.ok(notes.every((line) => line["build-cache"] !== "delegated"));
});

test("delegation is decided per package script and per Core checkout", async () => {
  await giveCoreItsCache(cores[0], ["contracts"]);
  const calls = [];
  const notes = [];
  const steps = [];
  await buildWithSpy(cores[0], calls, notes, steps);
  assert.deepEqual(calls, CORE_PACKAGES.map((item) => item.filter));
  assert.deepEqual(steps, ["pnpm --filter fluxiq build", "pnpm --filter @fluxiq/client-gateway-websocket build"]);
  const cache = Object.fromEntries(notes.filter((line) => line.step === "build-core-package").map((line) => [line.package, line["build-cache"]]));
  assert.deepEqual(cache, { "@fluxiq/contracts": "delegated", fluxiq: "build", "@fluxiq/client-gateway-websocket": "build" });
  const other = [];
  await buildWithSpy(cores[1], [], [], other);
  assert.equal(other.length, CORE_PACKAGES.length, "the other checkout, without Core's cache, is not delegated");
});
