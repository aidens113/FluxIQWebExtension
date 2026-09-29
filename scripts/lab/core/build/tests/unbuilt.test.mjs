import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chmod, mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { coreBuildMissing, coreBuildStaleness, scanCoreBuildEntries, scanCoreOutput, scanCoreSources } from "../index.mjs";

/** A Core shaped like the real one: three packages, each promising `dist` files through `exports`. */
const PACKAGES = {
  contracts: { name: "@fluxiq/contracts", exports: { ".": { types: "./dist/index.d.ts", import: "./dist/index.js" }, "./automation-studio": { types: "./dist/automation-studio.d.ts", import: "./dist/automation-studio.js" } } },
  fluxiq: { name: "fluxiq", exports: { ".": { types: "./dist/index.d.ts", import: "./dist/index.js" }, "./automation-studio": { types: "./dist/programs/automation-studio/index.d.ts", import: "./dist/programs/automation-studio/index.js" } } },
  "client-gateway-websocket": { name: "@fluxiq/client-gateway-websocket", exports: { ".": { types: "./dist/index.d.ts", import: "./dist/index.js" } } }
};

async function withCore(shape, body) {
  const root = await mkdtemp(path.join(os.tmpdir(), "core-built-"));
  try {
    if (shape.installed) await mkdir(path.join(root, "node_modules"), { recursive: true });
    for (const [directory, manifest] of Object.entries(shape.packages ?? {})) {
      const packageRoot = path.join(root, "packages", directory);
      await mkdir(path.join(packageRoot, "src"), { recursive: true });
      await writeFile(path.join(packageRoot, "src", "index.ts"), "export const a = 1;\n");
      await writeFile(path.join(packageRoot, "package.json"), JSON.stringify({ scripts: { build: "tsc -b" }, ...manifest }));
      for (const built of shape.built?.[directory] ?? []) {
        await mkdir(path.dirname(path.join(packageRoot, built)), { recursive: true });
        await writeFile(path.join(packageRoot, built), "export {};\n");
      }
    }
    return await body(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

const everyEntry = directory => Object.values(PACKAGES[directory].exports).flatMap(value => Object.values(value));

test("a fresh checkout -- sources, no dist -- is refused as unbuilt, and the message names the build command", () => withCore({ installed: true, packages: PACKAGES }, async (root) => {
  const verdict = coreBuildMissing(await scanCoreBuildEntries(root));
  assert.equal(verdict.built, false);
  assert.equal(verdict.state, "unbuilt");
  assert.deepEqual(verdict.missing.map(item => item.package).sort(), ["@fluxiq/client-gateway-websocket", "@fluxiq/contracts", "fluxiq"]);
  assert.match(verdict.message, /has not been built/u);
  assert.match(verdict.message, /pnpm build/u);
  assert.match(verdict.message, /setup failure, not a run result/u);
  assert.ok(verdict.message.includes(root), "the message says which Core it looked at");
}));

test("the gap this closes: staleness still calls a never-built Core not stale, and this check refuses it", () => withCore({ installed: true, packages: PACKAGES }, async (root) => {
  // coreBuildStaleness keeps its contract -- nothing built is not "stale" --
  // which is exactly why a fresh checkout used to pass every guard.
  assert.equal(coreBuildStaleness(await scanCoreSources(root), await scanCoreOutput(root)).stale, false);
  assert.equal(coreBuildMissing(await scanCoreBuildEntries(root)).built, false);
}));

test("a Core whose dependencies were never installed is told to install before it builds", () => withCore({ installed: false, packages: PACKAGES }, async (root) => {
  const verdict = coreBuildMissing(await scanCoreBuildEntries(root));
  assert.equal(verdict.command, "pnpm install --frozen-lockfile && pnpm build");
  assert.match(verdict.message, /pnpm install --frozen-lockfile && pnpm build/u);
}));

test("one package built and the others not is incomplete, and names what is missing", () => withCore({
  installed: true, packages: PACKAGES, built: { contracts: everyEntry("contracts") }
}, async (root) => {
  const verdict = coreBuildMissing(await scanCoreBuildEntries(root));
  assert.equal(verdict.state, "incomplete");
  assert.deepEqual(verdict.missing.map(item => item.package).sort(), ["@fluxiq/client-gateway-websocket", "fluxiq"]);
  assert.match(verdict.message, /partly built: 6 of the 10/u);
}));

test("a dist that exists but lacks one declared entry point is incomplete, not built", () => withCore({
  // What a clean that emptied `dist` and a build that stopped halfway leave:
  // the directory is there, and the module a run imports is not.
  installed: true, packages: PACKAGES,
  built: { contracts: everyEntry("contracts"), fluxiq: ["dist/index.js", "dist/index.d.ts", "dist/programs/automation-studio/index.d.ts"], "client-gateway-websocket": everyEntry("client-gateway-websocket") }
}, async (root) => {
  const verdict = coreBuildMissing(await scanCoreBuildEntries(root));
  assert.equal(verdict.state, "incomplete");
  assert.deepEqual(verdict.missing, [{ package: "fluxiq", paths: [path.normalize("./dist/programs/automation-studio/index.js")] }]);
}));

test("every declared entry point present is built, with no message", () => withCore({
  installed: true, packages: PACKAGES,
  built: Object.fromEntries(Object.keys(PACKAGES).map(directory => [directory, everyEntry(directory)]))
}, async (root) => {
  const verdict = coreBuildMissing(await scanCoreBuildEntries(root));
  assert.deepEqual([verdict.built, verdict.state, verdict.message], [true, "built", null]);
}));

test("no Core at the root is refused as not found, pointing at FLUXIQ_CORE_ROOT", () => withCore({}, async (root) => {
  const scan = await scanCoreBuildEntries(path.join(root, "nowhere"));
  assert.equal(scan.packagesFound, false);
  const verdict = coreBuildMissing(scan);
  assert.equal(verdict.state, "not-found");
  assert.match(verdict.message, /FLUXIQ_CORE_ROOT/u);
  assert.match(verdict.message, /setup failure/u);
}));

test("entry points come from the manifest: bare main and bin count, pattern exports and packages with no build do not", () => withCore({
  installed: true,
  packages: {
    tool: { name: "tool", main: "dist/main.js", bin: { tool: "dist/cli.js" }, exports: { "./*": "./dist/*.js" } },
    docs: { name: "docs", scripts: {} }
  },
  built: { tool: ["dist/main.js"] }
}, async (root) => {
  const scan = await scanCoreBuildEntries(root);
  assert.deepEqual(scan.packages.map(item => item.name), ["tool"], "a package with no build script promises nothing");
  assert.deepEqual(scan.packages[0].expected, [path.normalize("./dist/cli.js"), path.normalize("./dist/main.js")]);
  assert.deepEqual(scan.packages[0].missing, [path.normalize("./dist/cli.js")]);
}));

test("a malformed Core manifest is an error naming the file, not a quiet pass", () => withCore({ installed: true, packages: { fluxiq: PACKAGES.fluxiq } }, async (root) => {
  await writeFile(path.join(root, "packages", "fluxiq", "package.json"), "{ not json");
  await assert.rejects(scanCoreBuildEntries(root), /package\.json is not valid JSON/u);
}));

test("the Lab entry point refuses an unbuilt Core before it builds or runs anything, as a setup failure", { timeout: 60_000 }, () => withCore({ installed: false, packages: PACKAGES }, async (root) => {
  // A stand-in `pnpm` first on PATH records that it was reached and fails, so
  // a regression here fails this test rather than starting a real build or a
  // Lab run. The first thing `run-lab.mjs` does after its Core guards is call
  // pnpm, so the marker is exactly "got past the guards".
  const fakeBin = path.join(root, "fake-bin");
  const marker = path.join(root, "pnpm-was-called");
  await mkdir(fakeBin, { recursive: true });
  await writeFile(path.join(fakeBin, "pnpm.cmd"), `@echo off\r\necho reached> "${marker}"\r\nexit /b 97\r\n`);
  await writeFile(path.join(fakeBin, "pnpm"), `#!/bin/sh\necho reached > '${marker}'\nexit 97\n`);
  await chmod(path.join(fakeBin, "pnpm"), 0o755);

  const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "run-lab.mjs");
  const pathKey = Object.keys(process.env).find(key => key.toUpperCase() === "PATH") ?? "PATH";
  const env = { ...process.env, [pathKey]: `${fakeBin}${path.delimiter}${process.env[pathKey] ?? ""}`, FLUXIQ_CORE_ROOT: root, FLUXIQ_LAB_CORE_QUIET_MS: "0",
    // This checkout's own builds are another guard's business; letting them pass
    // keeps the only thing that can stop the Lab here the check under test.
    FLUXIQ_LAB_ALLOW_STALE_BUILD: "1" };
  delete env.FLUXIQ_LAB_INSTANCE;
  const { code, stderr } = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, "matrix", "--all"], { env, stdio: ["ignore", "pipe", "pipe"] });
    let err = "";
    child.stderr.on("data", chunk => { err += chunk; });
    child.stdout.resume();
    child.once("error", reject);
    child.once("close", status => resolve({ code: status, stderr: err }));
  });

  assert.equal(code, 1, stderr);
  const reached = await stat(marker).then(() => true, error => { if (error?.code === "ENOENT") return false; throw error; });
  assert.equal(reached, false, "the Lab went on to call pnpm past an unbuilt Core");
  const refusal = stderr.split(/\r?\n/u).filter(line => line.startsWith("{")).map(line => JSON.parse(line)).find(line => line.lab === "core-build" && line.state === "unbuilt");
  assert.ok(refusal, stderr);
  assert.equal(refusal.failure, "setup");
  assert.match(refusal.why, /pnpm install --frozen-lockfile && pnpm build/u);
  assert.doesNotMatch(stderr, /environment\.missing/u, "a setup refusal is not written as a run's failure category");
}));
