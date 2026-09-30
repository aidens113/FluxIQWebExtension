#!/usr/bin/env node
// node scripts/build-cache/prove-inputs.mjs [--json] [step ...]
//
// The coverage proof: every file a registered step's compiler or bundler
// actually loads is inside that step's fingerprint, or under node_modules
// (which the lockfiles stand for). It asks the tools rather than the configs:
//   - `tsc -p <config> --listFilesOnly` for every project a step names, with
//     the step's own pinned compiler;
//   - esbuild's metafile, for every browser entry of a step that bundles,
//     through `bundleExtensionEntry` with `write: false`, so nothing on disk
//     changes.
// A file outside both fails the proof, naming the step and the file. The cheap
// static counterpart that runs in `pnpm check` is tests/registry.test.mjs;
// this is the expensive one, run whenever the registry or a project's shape
// changes, and its result is recorded in the task report.

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { isInsideRoots } from "./fingerprint/index.mjs";
import { resolveStep } from "./workspace/index.mjs";
import { STEPS } from "./steps.mjs";

const asJson = process.argv.includes("--json");
const only = process.argv.slice(2).filter((argument) => argument !== "--json");
for (const name of only) if (!Object.hasOwn(STEPS, name)) throw new Error(`prove-inputs: unknown step "${name}"`);
const listings = new Map();
const bundles = new Map();
const results = [];

for (const stepName of only.length > 0 ? only : Object.keys(STEPS)) {
  const resolved = resolveStep(stepName);
  for (const config of resolved.tsconfigs) results.push(classify(stepName, `tsc ${path.relative(resolved.packageDir, config)}`, listProject(resolved.packageDir, config), resolved));
  if (resolved.bundles) {
    for (const [entry, files] of await bundleInputs(resolved.packageDir)) results.push(classify(stepName, `esbuild ${entry}`, files, resolved));
  }
}

const failed = results.filter((result) => result.outside.length > 0);
if (asJson) {
  process.stdout.write(`${JSON.stringify({ passed: failed.length === 0, results }, null, 2)}\n`);
} else {
  for (const result of results) {
    const where = Object.entries(result.nodeModules).map(([top, count]) => `${top}: ${count}`).join(", ");
    process.stdout.write(`${result.outside.length === 0 ? "ok  " : "FAIL"} ${result.step.padEnd(26)} ${result.project.padEnd(36)} ${String(result.files).padStart(5)} files, ${String(result.inside).padStart(5)} fingerprinted, ${String(result.files - result.inside - result.outside.length).padStart(5)} under node_modules (${where || "none"})\n`);
    for (const file of result.outside) process.stdout.write(`       outside every input root: ${file}\n`);
  }
  process.stdout.write(failed.length === 0 ? `inputs proved complete for ${results.length} project(s)\n` : `${failed.length} project(s) read files no fingerprint covers\n`);
}
process.exit(failed.length === 0 ? 0 : 1);

function listProject(packageDir, config) {
  if (listings.has(config)) return listings.get(config);
  const compiler = createRequire(path.join(packageDir, "package.json")).resolve("typescript/lib/tsc.js");
  const run = spawnSync(process.execPath, [compiler, "-p", config, "--listFilesOnly"], { cwd: packageDir, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  if (run.error) throw run.error;
  if (run.status !== 0) throw new Error(`tsc --listFilesOnly -p ${config} exited ${run.status}:\n${run.stdout}${run.stderr}`);
  const files = run.stdout.split(/\r?\n/u).map((line) => line.trim()).filter((line) => line !== "").map((line) => path.resolve(line));
  listings.set(config, files);
  return files;
}

async function bundleInputs(packageDir) {
  if (bundles.has(packageDir)) return bundles.get(packageDir);
  const script = path.join(packageDir, "scripts", "build-extension.mjs");
  const { EXTENSION_ENTRY_NAMES, bundleExtensionEntry } = await import(pathToFileURL(script).href);
  const scratch = mkdtempSync(path.join(os.tmpdir(), "build-cache-proof-"));
  const found = [];
  try {
    for (const entry of EXTENSION_ENTRY_NAMES) {
      const inputs = new Set();
      await bundleExtensionEntry(entry, scratch, { logLevel: "error", write: false, inputs });
      found.push([entry, [...inputs]]);
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
  bundles.set(packageDir, found);
  return found;
}

function classify(step, project, files, resolved) {
  const result = { step, project, files: files.length, inside: 0, nodeModules: {}, outside: [] };
  for (const file of files) {
    if (isInsideRoots(file, resolved)) {
      result.inside += 1;
      continue;
    }
    const segments = file.split(path.sep);
    const index = segments.indexOf("node_modules");
    if (index === -1) {
      result.outside.push(file);
      continue;
    }
    // Only the installs a hashed lockfile describes: this repository's and
    // each linked Core's. Any other node_modules is outside the fingerprint.
    const owner = segments.slice(0, index).join(path.sep);
    if (!lockedInstalls(resolved).has(key(owner))) {
      result.outside.push(file);
      continue;
    }
    const top = path.relative(resolved.repoRoot, path.join(owner, "node_modules")).split(path.sep).join("/");
    result.nodeModules[top] = (result.nodeModules[top] ?? 0) + 1;
  }
  return result;
}

/** The directories whose node_modules a fingerprinted lockfile describes. */
function lockedInstalls(resolved) {
  const owners = new Set([key(resolved.repoRoot)]);
  for (const root of resolved.roots) {
    if (root.label === "core:node_modules/.pnpm/lock.yaml") owners.add(key(path.resolve(root.path, "..", "..", "..")));
  }
  return owners;
}

function key(target) {
  const resolved = path.resolve(target);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}
