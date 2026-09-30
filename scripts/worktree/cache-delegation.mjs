// Whether a Core checkout caches one package's build itself.
//
// Core gained its own content-fingerprint build cache (`scripts/build-cache/
// cli.mjs`, which each library's `build` script runs). Wrapping that build in
// this repository's cache as well fingerprints the same build twice, under two
// different fingerprints, and a downstream reuse sets Core's `dist` mtimes to
// now, which the Lab's Core guards read as a Core rebuild that never happened.
// So when Core's cache owns a package's build, `buildCore` runs exactly Core's
// command and lets Core decide.
//
// Decided per checkout and per package, from what is on disk: an existing
// worktree at an older Core commit has neither the CLI nor scripts that call
// it, and keeps being built the way it always was.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const CLI = "scripts/build-cache/cli.mjs";

/**
 * @param {string} coreRoot
 * @param {{ filter: string, directory: string }} item
 * @returns {boolean} true when Core has the CLI and this package's `build` script runs it
 */
export function coreCacheOwnsBuild(coreRoot, item) {
  if (!existsSync(path.join(coreRoot, ...CLI.split("/")))) return false;
  const manifest = ["packages", "apps"].map((parent) => path.join(coreRoot, parent, item.directory, "package.json")).find((file) => existsSync(file));
  if (manifest === undefined) return false;
  const pkg = JSON.parse(readFileSync(manifest, "utf8"));
  if (pkg.name !== item.filter) throw new Error(`${path.relative(coreRoot, path.dirname(manifest))} in ${coreRoot} is ${pkg.name}, not ${item.filter}`);
  const build = pkg.scripts?.build;
  return typeof build === "string" && build.includes(CLI);
}
