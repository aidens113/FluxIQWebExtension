// Every downstream script that compiles, bundles or runs code against FluxIQ
// Core's compiled `dist/` must refuse a stale or missing Core first.
//
// Until 2026-10-06 only `check` and `test` were gated. The 2026-10-05 sweep's
// `pnpm build` then failed test-runner's tsc with nine TS errors that were
// nothing but exports missing from an old Core dist, and an extension built
// against an old Core would have bundled it without a word. This holds every
// such script to the gate, so a new one cannot be added without it.

import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

/** Scripts that only show an existing report and load no Core. */
const UNGATED = new Set(["test:e2e:report"]);

function packageDirectories() {
  const directories = ["domain"];
  for (const parent of ["apps", "packages"]) {
    for (const entry of readdirSync(path.join(repositoryRoot, parent), { withFileTypes: true })) {
      if (entry.isDirectory() && existsSync(path.join(repositoryRoot, parent, entry.name, "package.json"))) directories.push(`${parent}/${entry.name}`);
    }
  }
  return directories;
}

function linksCore(manifest) {
  return Object.keys({ ...manifest.dependencies, ...manifest.devDependencies }).some((name) => name === "fluxiq" || name.startsWith("@fluxiq/"));
}

function gated(name) {
  return !UNGATED.has(name) && (name === "build" || name === "check" || name === "test" || name.startsWith("test:"));
}

test("every build, check and test script of a package that links Core refuses a stale Core first", () => {
  const ungated = [];
  let checked = 0;
  for (const directory of packageDirectories()) {
    const manifest = JSON.parse(readFileSync(path.join(repositoryRoot, directory, "package.json"), "utf8"));
    if (!linksCore(manifest)) continue;
    const gate = `node ${path.posix.relative(directory, "scripts/check/core-build.mjs")} && `;
    for (const [name, script] of Object.entries(manifest.scripts ?? {})) {
      if (!gated(name)) continue;
      checked += 1;
      if (!script.startsWith(gate)) ungated.push(`${directory} "${name}": ${script}`);
    }
  }
  assert.ok(checked > 0, "found the packages that link Core");
  assert.deepEqual(ungated, [], `these scripts compile or run against Core's dist without the gate (start them with the core-build gate):\n${ungated.join("\n")}`);
});
