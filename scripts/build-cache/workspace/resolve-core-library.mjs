// One FluxIQ Core library package (`packages/<directory>` of a Core checkout)
// resolved as a build step, in the shape `resolveStep` returns, so
// `runStep` can decide, lock, restore from the shared store and stamp it like
// any step of this repository. `scripts/worktree/core-build.mjs` runs it with
// the same `pnpm --filter <name> build` it always ran.
//
// Inputs, each labelled relative to the Core root so two Core checkouts with
// the same content fingerprint the same:
//   - the package's `src/`, `package.json` and every `tsconfig*.json`;
//   - every script its `build` script runs with `node <path>` (Core's
//     `scripts/rewrite-declaration-imports.mjs`);
//   - the `dist/` of every Core workspace package it depends on, transitively
//     -- what its compiler reads of them;
//   - Core's root `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`,
//     `tsconfig*.json` and installed `node_modules/.pnpm/lock.yaml`;
//   - this repository's build-cache sources.
// Outputs: `dist/` and the `tsconfig.build.tsbuildinfo` the build writes
// beside it. Stamp, lock and stat cache live under Core's `node_modules/.cache`,
// which is build state, not Core source.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { REPOSITORY_ROOT } from "../repository-root.mjs";
import { STAMP_VERSION } from "../stamp/index.mjs";
import { readWorkspacePackages } from "./workspace-packages.mjs";

const ROOT_FILES = ["package.json", "pnpm-workspace.yaml", "pnpm-lock.yaml", "node_modules/.pnpm/lock.yaml"];
const TSCONFIG = /^tsconfig.*\.json$/u;
const NODE_SCRIPT = /\bnode\s+(\S+\.m?js)\b/gu;
const CACHE_DIRECTORY = path.join("node_modules", ".cache", "fluxiq-build");

/**
 * @param {string} coreRoot a FluxIQ Core checkout
 * @param {string} directory the package's directory under `packages/`
 * @param {{ env?: NodeJS.ProcessEnv, repoRoot?: string }} [options] `repoRoot` is the checkout whose build-cache sources are hashed
 */
export function resolveCoreLibrary(coreRoot, directory, options = {}) {
  const root = path.resolve(coreRoot);
  const env = options.env ?? process.env;
  const repoRoot = path.resolve(options.repoRoot ?? REPOSITORY_ROOT);
  const packageDir = path.join(root, "packages", directory);
  const packages = readWorkspacePackages(root);
  const own = [...packages.values()].find((candidate) => samePath(candidate.dir, packageDir));
  if (own === undefined) throw new Error(`build-cache: ${packageDir} is not a package of the Core workspace at ${root}`);
  const manifest = JSON.parse(readFileSync(path.join(packageDir, "package.json"), "utf8"));
  const buildScript = manifest.scripts?.build;
  if (typeof buildScript !== "string") throw new Error(`build-cache: ${own.name} has no build script`);

  const roots = [];
  const add = (target) => roots.push({ label: `core:${label(root, target)}`, path: target, exclude: [] });
  add(path.join(packageDir, "src"));
  add(path.join(packageDir, "package.json"));
  for (const config of tsconfigsIn(packageDir)) add(path.join(packageDir, config));
  for (const [, script] of buildScript.matchAll(NODE_SCRIPT)) add(path.resolve(packageDir, script));
  for (const dependency of transitiveDependencies(own, packages)) add(path.join(dependency.dir, "dist"));
  for (const file of [...ROOT_FILES, ...tsconfigsIn(root)]) add(path.join(root, file));
  const cacheSources = path.join(repoRoot, "scripts", "build-cache");
  roots.push({ label: "build-cache:scripts/build-cache", path: cacheSources, exclude: [path.join(cacheSources, "tests")] });

  const outputs = ["dist", "tsconfig.build.tsbuildinfo"].map((entry) => ({ label: label(root, path.join(packageDir, entry)), path: path.join(packageDir, entry), match: null }));
  const name = `core:${own.name}:build`;
  const command = `pnpm --filter ${own.name} build`;
  return {
    name,
    kind: "build",
    command,
    repoRoot: root,
    packageDir,
    roots,
    outputs,
    outputBase: packageDir,
    required: ["dist/index.js", "dist/index.d.ts"].map((file) => path.join(packageDir, file)),
    tsconfigs: [],
    bundles: false,
    stampPath: path.join(packageDir, CACHE_DIRECTORY, "build.json"),
    statCachePath: path.join(root, CACHE_DIRECTORY, "stat-cache.json"),
    relocationRoots: [root],
    meta: {
      version: STAMP_VERSION,
      step: name,
      command,
      script: buildScript,
      node: process.version,
      platform: process.platform,
      env: { NODE_ENV: env.NODE_ENV ?? null },
      outputs: outputs.map((output) => output.label)
    }
  };
}

function transitiveDependencies(own, packages) {
  const found = new Map();
  const pending = [...own.workspaceDeps];
  while (pending.length > 0) {
    const name = pending.pop();
    if (found.has(name) || name === own.name) continue;
    const dependency = packages.get(name);
    if (dependency === undefined) throw new Error(`build-cache: ${own.name} depends on workspace package ${name}, which Core does not contain`);
    found.set(name, dependency);
    pending.push(...dependency.workspaceDeps);
  }
  return [...found.values()].sort((left, right) => (left.dir < right.dir ? -1 : left.dir > right.dir ? 1 : 0));
}

function tsconfigsIn(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && TSCONFIG.test(entry.name))
    .map((entry) => entry.name)
    .sort();
}

function label(base, target) {
  const relative = path.relative(base, target);
  return (relative === "" ? "." : relative).split(path.sep).join("/");
}

function samePath(left, right) {
  const a = path.resolve(left);
  const b = path.resolve(right);
  return process.platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b;
}
